import CoreLocation
import Foundation

extension NitroBackgroundLocation {
    func addBackgroundEventListener(listener: @escaping (BackgroundEventEnvelope) -> Void) throws -> String {
        let token = UUID().uuidString
        withListenerLock { eventListeners[token] = listener }
        return token
    }

    func removeBackgroundEventListener(token: String) throws {
        _ = withListenerLock { eventListeners.removeValue(forKey: token) }
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
                isCurrentLocationSession(runGeneration, locationSessionGeneration)
            }) else { return }
            Array(errorListeners.keys).forEach { errorListeners[$0]?(locationError) }
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
                    guard isCurrentLocationSession(
                        runGeneration,
                        locationSessionGeneration
                    ) else { return false }
                }
                if let motionRegistrationGeneration {
                    guard isCurrentMotionRegistration(
                        runGeneration,
                        motionRegistrationGeneration
                    ) else { return false }
                }
                return true
            }) else { return }
            Array(eventListeners.keys).forEach { eventListeners[$0]?(event) }
            if let location {
                Array(locationListeners.keys).forEach { locationListeners[$0]?(location) }
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
                runOnMainSync {
                    self.manager?.disallowDeferredLocationUpdates()
                    self.manager?.stopUpdatingLocation()
                    self.manager?.stopMonitoringSignificantLocationChanges()
                }
                return
            }
            if activity.type != .still && activity.type != .unknown && snapshot.1 {
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

    func applyDeferredUpdatesIfNeeded(
        _ manager: CLLocationManager,
        runGeneration: UInt64,
        locationSessionGeneration: UInt64
    ) {
        guard let options = withStoreLock({ () -> BackgroundLocationOptions? in
            guard isCurrentLocationSession(
                runGeneration,
                locationSessionGeneration
            ) else { return nil }
            return self.options
        }),
            let distance = options.ios?.deferredUpdatesDistance,
            let interval = options.ios?.deferredUpdatesInterval
        else {
            return
        }
        manager.allowDeferredLocationUpdates(
            untilTraveled: distance,
            timeout: interval / 1000
        )
    }

    func replaceLocationSession() -> UInt64 {
        let generations = withStoreLock {
            locationSessionGeneration &+= 1
            locationSessionActive = true
            return (storeGeneration, locationSessionGeneration)
        }
        runOnMainSync {
            self.manager?.disallowDeferredLocationUpdates()
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
            self.manager?.disallowDeferredLocationUpdates()
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
