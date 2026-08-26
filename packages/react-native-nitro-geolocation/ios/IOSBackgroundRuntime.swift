import CoreLocation
import Foundation

extension NitroBackgroundLocation {
    func addBackgroundEventListener(listener: @escaping (BackgroundEventEnvelope) -> Void) throws -> String {
        let eventToken = UUID().uuidString
        withListenerLock { eventListeners[eventToken] = listener }
        let providerToken = unifiedProviderStatusWatcher.watch { [weak self] status in
            self?.dispatchProviderStatus(status, to: eventToken)
        }
        withListenerLock { providerListenerTokens[eventToken] = providerToken }
        return eventToken
    }

    func removeBackgroundEventListener(token: String) throws {
        let providerToken = withListenerLock { () -> String? in
            eventListeners.removeValue(forKey: token)
            return providerListenerTokens.removeValue(forKey: token)
        }
        if let providerToken {
            unifiedProviderStatusWatcher.unwatch(token: providerToken)
        }
    }

    private func dispatchProviderStatus(
        _ status: LocationProviderStatus,
        to eventToken: String
    ) {
        let event = BackgroundEventEnvelope(
            location: nil,
            geofence: nil,
            activity: nil,
            providerStatus: status,
            lifecycle: nil,
            result: nil,
            error: nil,
            id: UUID().uuidString,
            type: .providerchange,
            timestamp: Date().timeIntervalSince1970 * 1000,
            deliveredToJS: false
        )
        withListenerLock { eventListeners[eventToken]?(event) }
    }

    func addBackgroundLocationListener(listener: @escaping (BackgroundLocation) -> Void) throws -> String {
        let token = UUID().uuidString
        withListenerLock { locationListeners[token] = listener }
        return token
    }

    func removeBackgroundLocationListener(token: String) throws {
        _ = withListenerLock { locationListeners.removeValue(forKey: token) }
    }

    func addBackgroundErrorListener(listener: @escaping (LocationError) -> Void) throws -> String {
        let token = UUID().uuidString
        withListenerLock { errorListeners[token] = listener }
        return token
    }

    func removeBackgroundErrorListener(token: String) throws {
        _ = withListenerLock { errorListeners.removeValue(forKey: token) }
    }

    func handleAuthorizationChange(
        runGeneration: UInt64,
        status: CLAuthorizationStatus
    ) {
        withStoreLock {
            guard runGeneration == storeGeneration else { return }
            permissionRequest?.authorizationDidChange(to: status)
        }
    }

    func handleError(
        _ error: Error,
        runGeneration: UInt64,
        locationSessionGeneration: UInt64
    ) {
        // Location unknown is transient and Core Location continues trying.
        if let clError = error as? CLError, clError.code == .locationUnknown {
            return
        }
        let locationError = LocationError(
            code: .internalerror,
            message: error.localizedDescription
        )
        withListenerLock {
            guard withStoreLock({
                runGeneration == storeGeneration &&
                    self.locationSessionGeneration == locationSessionGeneration &&
                    locationSessionActive
            }) else { return }
            for listener in Array(errorListeners.values) {
                listener(locationError)
            }
        }
    }

    func dispatchInProcess(
        event: BackgroundEventEnvelope,
        location: BackgroundLocation? = nil,
        runGeneration: UInt64,
        locationSessionGeneration: UInt64? = nil,
        motionRegistrationGeneration: UInt64? = nil
    ) {
        withListenerLock {
            guard withStoreLock({
                guard runGeneration == storeGeneration else { return false }
                if let locationSessionGeneration {
                    guard self.locationSessionGeneration == locationSessionGeneration,
                        locationSessionActive
                    else { return false }
                }
                if let motionRegistrationGeneration {
                    guard self.motionRegistrationGeneration == motionRegistrationGeneration,
                        motionRegistrationActive
                    else { return false }
                }
                return true
            }) else { return }
            for listener in Array(eventListeners.values) {
                listener(event)
            }
            if let location {
                for listener in Array(locationListeners.values) {
                    listener(location)
                }
            }
        }
    }

    func applyActivityAwareTracking(
        _ activity: DetectedActivity,
        runGeneration: UInt64,
        motionRegistrationGeneration: UInt64
    ) {
        withLifecycleLock {
            guard isCurrentMotionRegistration(
                runGeneration,
                motionRegistrationGeneration
            ) else { return }
            let snapshot = withStoreLock { (options, isRunning) }
            guard let options = snapshot.0 else { return }
            let activityOptions = options.activityRecognition
            guard options.trackingMode == .activityaware ||
                activityOptions?.stopOnStill == true else { return }
            guard activity.confidence >= (activityOptions?.minimumConfidence ?? 0) else { return }
            let stopOnStill = activityOptions?.stopOnStill ?? (options.trackingMode == .activityaware)
            if activity.type == .still && stopOnStill {
                guard !activityPausedLocationUpdates else { return }
                activityPausedLocationUpdates = true
                runOnMainSync {
                    self.manager?.stopUpdatingLocation()
                    self.manager?.stopMonitoringSignificantLocationChanges()
                }
                return
            }
            if activity.type != .still && activity.type != .unknown && snapshot.1 &&
                activityPausedLocationUpdates {
                activityPausedLocationUpdates = false
                runOnMainSync {
                    if options.trackingMode == .significantchanges ||
                        options.ios?.useSignificantChanges == true {
                        self.manager?.startMonitoringSignificantLocationChanges()
                    } else {
                        self.manager?.startUpdatingLocation()
                    }
                }
            }
        }
    }

    func ensureManager() {
        if manager != nil { return }
        if Thread.isMainThread == false {
            DispatchQueue.main.sync {
                self.ensureManager()
            }
            return
        }
        let manager = CLLocationManager()
        let generation = withStoreLock { storeGeneration }
        let delegate = NitroBackgroundLocationDelegate(
            owner: self,
            runGeneration: generation,
            locationSessionGeneration: 0
        )
        manager.delegate = delegate
        self.manager = manager
        self.delegate = delegate
    }

    func replaceLocationSession() -> UInt64 {
        let generations = withStoreLock {
            locationSessionGeneration &+= 1
            locationSessionActive = true
            return (storeGeneration, locationSessionGeneration)
        }
        runOnMainSync {
            self.manager?.stopUpdatingLocation()
            self.manager?.stopMonitoringSignificantLocationChanges()
            let delegate = NitroBackgroundLocationDelegate(
                owner: self,
                runGeneration: generations.0,
                locationSessionGeneration: generations.1
            )
            self.manager?.delegate = delegate
            self.delegate = delegate
        }
        return generations.1
    }

    func stopLocationSession(expectedGeneration: UInt64? = nil) {
        let shouldStop = withStoreLock {
            if let expectedGeneration,
                locationSessionGeneration != expectedGeneration {
                return false
            }
            locationSessionActive = false
            locationSessionGeneration &+= 1
            return true
        }
        guard shouldStop else { return }
        runOnMainSync {
            self.manager?.stopUpdatingLocation()
            self.manager?.stopMonitoringSignificantLocationChanges()
        }
    }

    func isCurrentLocationSession(
        _ runGeneration: UInt64,
        _ locationSessionGeneration: UInt64
    ) -> Bool {
        withStoreLock {
            runGeneration == storeGeneration &&
                self.locationSessionGeneration == locationSessionGeneration &&
                locationSessionActive
        }
    }

    func isCurrentMotionRegistration(
        _ runGeneration: UInt64,
        _ motionRegistrationGeneration: UInt64
    ) -> Bool {
        withStoreLock {
            runGeneration == storeGeneration &&
                self.motionRegistrationGeneration == motionRegistrationGeneration &&
                motionRegistrationActive
        }
    }

    func withLifecycleLock<T>(_ work: () throws -> T) rethrows -> T {
        lifecycleLock.lock()
        defer { lifecycleLock.unlock() }
        return try work()
    }
}
