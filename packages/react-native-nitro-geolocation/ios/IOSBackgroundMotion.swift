import CoreLocation
import CoreMotion
import Foundation
import NitroModules

internal func motionActivityType(_ activity: CMMotionActivity) -> DetectedActivityType {
    if activity.automotive {
        return .invehicle
    }
    if activity.cycling {
        return .onbicycle
    }
    if activity.running {
        return .running
    }
    if activity.walking {
        return .walking
    }
    if activity.stationary {
        return .still
    }
    return .unknown
}

internal func motionConfidence(_ confidence: CMMotionActivityConfidence) -> Double {
    switch confidence {
    case .low:
        return 25
    case .medium:
        return 60
    case .high:
        return 95
    @unknown default:
        return 0
    }
}

internal func mapActivityType(_ activityType: IOSBackgroundActivityType?) -> CLActivityType {
    switch activityType {
    case .automotivenavigation:
        return .automotiveNavigation
    case .fitness:
        return .fitness
    case .othernavigation:
        return .otherNavigation
    case .airborne:
        if #available(iOS 12.0, *) {
            return .airborne
        }
        return .other
    case .other, nil:
        return .other
    @unknown default:
        return .other
    }
}

extension NitroBackgroundLocation {
    func validateMotionAccessBeforeStarting() throws {
        guard CMMotionActivityManager.isActivityAvailable() else {
            throw RuntimeError.error(withMessage: "Core Motion activity recognition is not available")
        }
        switch CMMotionActivityManager.authorizationStatus() {
        case .denied:
            throw RuntimeError.error(withMessage: "Core Motion activity permission is denied")
        case .restricted:
            throw RuntimeError.error(withMessage: "Core Motion activity permission is restricted")
        case .authorized, .notDetermined:
            return
        @unknown default:
            throw RuntimeError.error(withMessage: "Core Motion activity permission is unavailable")
        }
    }

    func awaitMotionAuthorization(timeout: TimeInterval = 60) throws {
        let deadline = Date().addingTimeInterval(timeout)
        var status = CMMotionActivityManager.authorizationStatus()
        while status == .notDetermined && Date() < deadline {
            Thread.sleep(forTimeInterval: 0.05)
            status = CMMotionActivityManager.authorizationStatus()
        }
        switch status {
        case .authorized:
            return
        case .denied:
            throw RuntimeError.error(withMessage: "Core Motion activity permission is denied")
        case .restricted:
            throw RuntimeError.error(withMessage: "Core Motion activity permission is restricted")
        case .notDetermined:
            throw RuntimeError.error(withMessage: "Core Motion activity permission request timed out")
        @unknown default:
            throw RuntimeError.error(withMessage: "Core Motion activity permission is unavailable")
        }
    }

    func settleMotionAuthorization() throws {
        try validateMotionAccessBeforeStarting()
        guard CMMotionActivityManager.authorizationStatus() == .notDetermined else { return }

        let authorizationManager = CMMotionActivityManager()
        let authorizationQueue = OperationQueue()
        authorizationManager.startActivityUpdates(to: authorizationQueue) { _ in }
        defer { authorizationManager.stopActivityUpdates() }
        try awaitMotionAuthorization()
    }

    func startMotionUpdatesIfAvailable() {
        guard CMMotionActivityManager.isActivityAvailable(), !isMotionUpdatesRunning else { return }
        let generations = withStoreLock {
            motionRegistrationGeneration &+= 1
            motionRegistrationActive = true
            return (storeGeneration, motionRegistrationGeneration)
        }
        motionManager.startActivityUpdates(to: motionQueue) { [weak self] activity in
            guard let self, let activity else { return }
            self.handleMotionActivity(
                activity,
                runGeneration: generations.0,
                motionRegistrationGeneration: generations.1
            )
        }
        isMotionUpdatesRunning = true
    }

    func stopMotionUpdatesIfRunning() {
        guard isMotionUpdatesRunning else { return }
        withStoreLock {
            motionRegistrationActive = false
            motionRegistrationGeneration &+= 1
        }
        motionManager.stopActivityUpdates()
        isMotionUpdatesRunning = false
    }

    func updateMotionUpdates() {
        if backgroundMotionRequested || standaloneMotionRequested {
            startMotionUpdatesIfAvailable()
        } else {
            stopMotionUpdatesIfRunning()
        }
    }

    private func handleMotionActivity(
        _ activity: CMMotionActivity,
        runGeneration: UInt64,
        motionRegistrationGeneration: UInt64
    ) {
        guard isCurrentMotionRegistration(
            runGeneration,
            motionRegistrationGeneration
        ) else { return }
        let detected = DetectedActivity(
            type: motionActivityType(activity),
            confidence: motionConfidence(activity.confidence),
            timestamp: activity.startDate.timeIntervalSince1970 * 1000
        )
        let event = BackgroundEventEnvelope(
            location: nil,
            geofence: nil,
            activity: detected,
            providerStatus: nil,
            lifecycle: nil,
            result: nil,
            error: nil,
            id: UUID().uuidString,
            type: .activity,
            timestamp: Date().timeIntervalSince1970 * 1000,
            deliveredToJS: false
        )
        let storedForRun: Bool = withStoreLock {
            guard runGeneration == storeGeneration,
                self.motionRegistrationGeneration == motionRegistrationGeneration,
                motionRegistrationActive
            else { return false }
            appendStoredEvent(
                StoredBackgroundEventEnvelope(
                    event: event,
                    createdAt: Date().timeIntervalSince1970 * 1000,
                    id: event.id,
                    type: event.type,
                    timestamp: event.timestamp,
                    deliveredToJS: false
                ),
                allowUnconfigured: true
            )
            persistStore()
            return true
        }
        guard storedForRun else { return }
        dispatchInProcess(
            event: event,
            runGeneration: runGeneration,
            motionRegistrationGeneration: motionRegistrationGeneration
        )
        applyActivityAwareTracking(
            detected,
            runGeneration: runGeneration,
            motionRegistrationGeneration: motionRegistrationGeneration
        )
    }
}
