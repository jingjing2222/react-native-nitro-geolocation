import CoreLocation
import CoreMotion
import Foundation
import NitroModules
import UIKit

class NitroBackgroundLocation: HybridNitroBackgroundLocationSpec {
    private let defaults = UserDefaults.standard
    private let locationsKey = "nitro.background.locations"
    private let eventsKey = "nitro.background.events"
    private let geofencesKey = "nitro.background.geofences"
    private let optionsKey = "nitro.background.options"
    var options: BackgroundLocationOptions?
    private var state: BackgroundLocationState = .idle
    var isRunning = false
    var eventListeners: [String: (BackgroundEventEnvelope) -> Void] = [:]
    var locationListeners: [String: (BackgroundLocation) -> Void] = [:]
    var errorListeners: [String: (LocationError) -> Void] = [:]
    var providerListenerTokens: [String: String] = [:]
    lazy var unifiedProviderStatusWatcher = IOSProviderStatusWatcher()
    var storedLocations: [StoredBackgroundLocation] = []
    private var storedEvents: [StoredBackgroundEventEnvelope] = []
    private var geofences: [GeofenceRegion] = []
    private let storeLock = NSRecursiveLock()
    private let listenerLock = NSRecursiveLock()
    let lifecycleLock = NSRecursiveLock()
    var storeGeneration: UInt64 = 0
    var locationSessionGeneration: UInt64 = 0
    var syncConfigRevision: UInt64 = 0
    var locationSessionActive = false
    var manager: CLLocationManager?
    var delegate: NitroBackgroundLocationDelegate?
    let motionManager = CMMotionActivityManager()
    let motionQueue = OperationQueue()
    var isMotionUpdatesRunning = false
    var motionRegistrationGeneration: UInt64 = 0
    var motionRegistrationActive = false
    var backgroundMotionRequested = false
    var standaloneMotionRequested = false
    let syncScheduler = IOSBackgroundSyncScheduler()
    let httpSync = IOSBackgroundHttpSync()
    var permissionRequest: IOSBackgroundPermissionRequest?
    var lastSyncAt: TimeInterval = 0

    override init() {
        super.init()
        loadPersistedStore()
    }

    func checkBackgroundPermission() throws -> Promise<BackgroundPermissionResult> {
        return Promise.async {
            return self.permissionResult()
        }
    }

    func requestBackgroundPermission() throws -> Promise<BackgroundPermissionResult> {
        return Promise.async {
            return self.requestBackgroundPermissionResult()
        }
    }

    func openAppLocationSettings() throws -> Promise<Void> {
        return Promise.async {
            if let url = URL(string: UIApplication.openSettingsURLString) {
                DispatchQueue.main.async {
                    UIApplication.shared.open(url)
                }
            }
        }
    }

    func configureBackgroundLocation(options: BackgroundLocationOptions) throws -> Promise<Void> {
        return Promise.async {
            self.withLifecycleLock {
                self.withStoreLock {
                    self.syncConfigRevision &+= 1
                    self.options = options
                    self.persistOptions(options)
                }
            }
        }
    }

    func getBackgroundConfiguration() throws -> Promise<BackgroundLocationOptions?> {
        return Promise.async {
            return self.withStoreLock { self.options }
        }
    }

    func startBackgroundLocation(options: BackgroundLocationOptions?) throws -> Promise<Void> {
        return Promise.async {
            defer {
                self.withListenerLock { /* Barrier for the location session that was replaced. */ }
            }
            try self.withLifecycleLock {
                let current = self.withStoreLock { options ?? self.options }
                guard let current else {
                    throw RuntimeError.error(withMessage: "Background location is not configured")
                }
                self.ensureManager()
                let permission = self.permissionResult()
                guard permission.background == .granted else {
                    self.withStoreLock { self.state = .error }
                    throw RuntimeError.error(withMessage: "Background location permission is required")
                }
                try self.validateBackgroundLocationMode()
                let motionRequested = current.trackingMode == .activityaware ||
                    current.activityRecognition?.enabled == true
                do {
                    if motionRequested {
                        try self.settleMotionAuthorization()
                    }
                } catch {
                    self.withStoreLock {
                        if !self.isRunning {
                            self.state = .error
                        }
                    }
                    throw error
                }
                self.withStoreLock {
                    if let options {
                        self.syncConfigRevision &+= 1
                        self.options = options
                        self.persistOptions(options)
                    }
                    self.state = .starting
                }
                _ = self.replaceLocationSession()
                self.apply(current)
                self.backgroundMotionRequested = motionRequested
                self.updateMotionUpdates()
                self.withStoreLock {
                    self.isRunning = true
                    self.state = .running
                }
            }
        }
    }

    func stopBackgroundLocation() throws -> Promise<Void> {
        return Promise.async {
            self.withLifecycleLock {
                self.withStoreLock { self.state = .stopping }
                self.stopLocationSession()
                self.backgroundMotionRequested = false
                self.updateMotionUpdates()
                self.withStoreLock {
                    self.isRunning = false
                    self.state = .stopped
                }
            }
            self.withListenerLock { /* Stop resolves after prior-session delivery drains. */ }
        }
    }

    func resetBackgroundLocation() throws -> Promise<Void> {
        return Promise.async {
            self.withLifecycleLock {
                self.stopLocationSession()
                self.withStoreLock {
                    self.storeGeneration &+= 1
                    self.options = nil
                    self.defaults.removeObject(forKey: self.optionsKey)
                    self.lastSyncAt = 0
                    self.isRunning = false
                    self.state = .idle
                    self.storedLocations.removeAll()
                    self.storedEvents.removeAll()
                    self.geofences.removeAll()
                    self.persistStore()
                }
                self.runOnMainSync {
                    self.manager?.disallowDeferredLocationUpdates()
                    self.manager?.stopUpdatingLocation()
                    self.manager?.stopMonitoringSignificantLocationChanges()
                    self.manager?.monitoredRegions.forEach { self.manager?.stopMonitoring(for: $0) }
                    self.manager?.delegate = nil
                    self.manager = nil
                    self.delegate = nil
                }
                self.backgroundMotionRequested = false
                self.standaloneMotionRequested = false
                self.updateMotionUpdates()
            }
            // Do not overlap listenerLock with lifecycleLock: callbacks may re-enter lifecycle APIs.
            self.withListenerLock { /* Barrier for callbacks already dispatching at reset. */ }
        }
    }

    func getBackgroundLocationStatus() throws -> Promise<BackgroundLocationStatus> {
        return Promise.async {
            return self.withLifecycleLock {
                let permission = self.permissionResult()
                let snapshot = self.withStoreLock {
                    (
                        state: self.state,
                        isRunning: self.isRunning,
                        isConfigured: self.options != nil,
                        significantChangesEnabled: self.options?.trackingMode == .significantchanges ||
                            self.options?.ios?.useSignificantChanges == true,
                        locationCount: Double(self.storedLocations.count),
                        eventCount: Double(self.storedEvents.count),
                        lastLocationAt: self.storedLocations.map(\.recordedAt).max(),
                        lastEventAt: self.storedEvents.map(\.timestamp).max(),
                        geofenceCount: Double(self.geofences.count)
                    )
                }
                return BackgroundLocationStatus(
                    state: snapshot.state,
                    isRunning: snapshot.isRunning,
                    isConfigured: snapshot.isConfigured,
                    foregroundPermission: permission.foreground,
                    backgroundPermission: permission.background,
                    accuracyAuthorization: permission.accuracyAuthorization,
                    locationServicesEnabled: CLLocationManager.locationServicesEnabled(),
                    providerStatus: nil,
                    storedLocationCount: snapshot.locationCount,
                    storedEventCount: snapshot.eventCount,
                    lastLocationAt: snapshot.lastLocationAt,
                    lastEventAt: snapshot.lastEventAt,
                    geofenceCount: snapshot.geofenceCount,
                    android: nil,
                    ios: IOSBackgroundLocationStatus(
                        allowsBackgroundLocationUpdates: self.manager?.allowsBackgroundLocationUpdates ?? false,
                        significantChangesEnabled: snapshot.significantChangesEnabled
                    ),
                    lastError: nil
                )
            }
        }
    }

    func handleLocationLifecycleChange(
        _ state: LocationLifecycleState,
        runGeneration: UInt64,
        locationSessionGeneration: UInt64
    ) {
        let timestamp = Date().timeIntervalSince1970 * 1000
        let plan: IOSLifecycleEventDeliveryPlan? = withStoreLock {
            guard shouldAcceptIOSLifecycleEvent(
                runGeneration: runGeneration,
                locationSessionGeneration: locationSessionGeneration,
                currentRunGeneration: storeGeneration,
                currentLocationSessionGeneration: self.locationSessionGeneration,
                locationSessionActive: locationSessionActive
            ) else { return nil }
            let plan = makeIOSLifecycleEventDeliveryPlan(
                state: state,
                timestamp: timestamp,
                id: UUID().uuidString,
                createdAt: timestamp,
                shouldPersist: shouldPersist()
            )
            if let storedEvent = plan.storedEvent {
                appendStoredEvent(storedEvent)
                persistStore()
            }
            return plan
        }
        guard let plan else { return }
        dispatchInProcess(
            event: plan.event,
            runGeneration: runGeneration,
            locationSessionGeneration: locationSessionGeneration
        )
    }

    func getStoredBackgroundLocations(
        options: GetStoredBackgroundLocationsOptions?
    ) throws -> Promise<[StoredBackgroundLocation]> {
        return Promise.async {
            var rows = self.withStoreLock { self.storedLocations }
            if options?.includeDelivered != true {
                rows = rows.filter { !$0.deliveredToJS }
            }
            if options?.includeSynced != true {
                rows = rows.filter { !$0.synced }
            }
            if let since = options?.since {
                rows = rows.filter { $0.createdAt >= since }
            }
            let limit = self.safePrefixCount(
                options?.limit,
                defaultValue: 100,
                upperBound: rows.count
            )
            return Array(rows.prefix(limit))
        }
    }

    func clearStoredBackgroundLocations(ids: [String]?) throws -> Promise<Void> {
        return Promise.async {
            self.withStoreLock {
                guard let ids else {
                    self.storedLocations.removeAll()
                    self.persistStore()
                    return
                }
                self.storedLocations.removeAll { ids.contains($0.id) }
                self.persistStore()
            }
        }
    }

    func markStoredBackgroundLocationsDelivered(ids: [String]) throws -> Promise<Void> {
        return Promise.async {
            self.withStoreLock {
                self.storedLocations = self.storedLocations.map { location in
                    ids.contains(location.id)
                        ? StoredBackgroundLocation(
                            id: location.id,
                            deliveredToJS: true,
                            synced: location.synced,
                            createdAt: location.createdAt,
                            source: location.source,
                            isFromBackground: location.isFromBackground,
                            provider: location.provider,
                            mocked: location.mocked,
                            recordedAt: location.recordedAt,
                            activity: location.activity,
                            battery: location.battery,
                            coords: location.coords,
                            timestamp: location.timestamp
                        )
                        : location
                }
                self.persistStore()
            }
        }
    }

    func getStoredBackgroundEvents(
        options: GetStoredBackgroundEventsOptions?
    ) throws -> Promise<[StoredBackgroundEventEnvelope]> {
        return Promise.async {
            var rows = self.withStoreLock { self.storedEvents }
            if options?.includeDelivered != true {
                rows = rows.filter { !$0.deliveredToJS }
            }
            if let since = options?.since {
                rows = rows.filter { $0.createdAt >= since }
            }
            if let types = options?.types, !types.isEmpty {
                rows = rows.filter { types.contains($0.type) }
            }
            let limit = self.safePrefixCount(
                options?.limit,
                defaultValue: 100,
                upperBound: rows.count
            )
            return Array(rows.prefix(limit))
        }
    }

    func clearStoredBackgroundEvents(ids: [String]?) throws -> Promise<Void> {
        return Promise.async {
            self.withStoreLock {
                guard let ids else {
                    self.storedEvents.removeAll()
                    self.persistStore()
                    return
                }
                self.storedEvents.removeAll { ids.contains($0.id) }
                self.persistStore()
            }
        }
    }

    func markStoredBackgroundEventsDelivered(ids: [String]) throws -> Promise<Void> {
        return Promise.async {
            self.withStoreLock {
                self.storedEvents = self.storedEvents.map { event in
                    ids.contains(event.id)
                        ? StoredBackgroundEventEnvelope(
                            event: event.event,
                            createdAt: event.createdAt,
                            id: event.id,
                            type: event.type,
                            timestamp: event.timestamp,
                            deliveredToJS: true
                        )
                        : event
                }
                self.persistStore()
            }
        }
    }

    func addGeofences(regions: [GeofenceRegion], options: GeofencingOptions?) throws -> Promise<Void> {
        return Promise.async {
            try self.withLifecycleLock {
                self.ensureManager()
                guard self.permissionResult().background == .granted else {
                    throw RuntimeError.error(withMessage: "Background location permission is required to register geofences")
                }
                let sanitized = regions.map(sanitizedGeofence)
                self.runOnMainSync {
                    for region in sanitized {
                        let circular = CLCircularRegion(
                            center: CLLocationCoordinate2D(
                                latitude: region.latitude,
                                longitude: region.longitude
                            ),
                            radius: region.radius,
                            identifier: region.identifier
                        )
                        circular.notifyOnEntry = region.notifyOnEntry ?? true
                        circular.notifyOnExit = region.notifyOnExit ?? true
                        self.manager?.startMonitoring(for: circular)
                    }
                }
                self.withStoreLock {
                    self.geofences.removeAll { existing in
                        sanitized.contains { $0.identifier == existing.identifier }
                    }
                    self.geofences.append(contentsOf: sanitized)
                    self.persistStore()
                }
            }
        }
    }

    func removeGeofences(identifiers: [String]?) throws -> Promise<Void> {
        return Promise.async {
            self.withLifecycleLock {
                guard let identifiers else {
                    self.runOnMainSync {
                        self.manager?.monitoredRegions.forEach { self.manager?.stopMonitoring(for: $0) }
                    }
                    self.withStoreLock {
                        self.geofences.removeAll()
                        self.persistStore()
                    }
                    return
                }
                self.runOnMainSync {
                    self.manager?.monitoredRegions
                        .filter { identifiers.contains($0.identifier) }
                        .forEach { self.manager?.stopMonitoring(for: $0) }
                }
                self.withStoreLock {
                    self.geofences.removeAll { identifiers.contains($0.identifier) }
                    self.persistStore()
                }
            }
        }
    }

    func getRegisteredGeofences() throws -> Promise<[GeofenceRegion]> {
        return Promise.async {
            return self.withStoreLock {
                self.geofences.map(bridgeSafeGeofence)
            }
        }
    }

    func startActivityRecognition(options: ActivityRecognitionOptions?) throws -> Promise<Void> {
        return Promise.async {
            try self.withLifecycleLock {
                try self.settleMotionAuthorization()
                self.standaloneMotionRequested = true
                self.updateMotionUpdates()
            }
        }
    }

    func stopActivityRecognition() throws -> Promise<Void> {
        return Promise.async {
            self.withLifecycleLock {
                self.standaloneMotionRequested = false
                self.updateMotionUpdates()
            }
            self.withListenerLock { /* Drain delivery from a stopped physical registration. */ }
        }
    }

    func syncStoredLocations() throws -> Promise<BackgroundHttpSyncResult> {
        return Promise.async {
            let generation = self.withStoreLock { self.storeGeneration }
            return self.syncScheduler.sync {
                self.performSyncStoredLocations(runGeneration: generation)
            }
        }
    }

    func handleLocations(
        _ locations: [CLLocation],
        runGeneration: UInt64,
        locationSessionGeneration: UInt64
    ) {
        guard isCurrentLocationSession(runGeneration, locationSessionGeneration) else { return }
        for location in locations {
            let id = UUID().uuidString
            let coords = GeolocationCoordinates(
                latitude: location.coordinate.latitude,
                longitude: location.coordinate.longitude,
                altitude: .second(location.altitude),
                accuracy: location.horizontalAccuracy,
                altitudeAccuracy: .second(location.verticalAccuracy),
                heading: location.course >= 0 ? .second(location.course) : nil,
                speed: location.speed >= 0 ? .second(location.speed) : nil
            )
            let backgroundLocation = BackgroundLocation(
                id: id,
                source: .background,
                isFromBackground: true,
                provider: .unknown,
                mocked: location.sourceInformation?.isSimulatedBySoftware,
                recordedAt: Date().timeIntervalSince1970 * 1000,
                activity: nil,
                battery: nil,
                coords: coords,
                timestamp: location.timestamp.timeIntervalSince1970 * 1000
            )
            let stored = StoredBackgroundLocation(
                id: id,
                deliveredToJS: false,
                synced: false,
                createdAt: Date().timeIntervalSince1970 * 1000,
                source: backgroundLocation.source,
                isFromBackground: true,
                provider: backgroundLocation.provider,
                mocked: backgroundLocation.mocked,
                recordedAt: backgroundLocation.recordedAt,
                activity: nil,
                battery: nil,
                coords: coords,
                timestamp: backgroundLocation.timestamp
            )
            let event = BackgroundEventEnvelope(
                location: backgroundLocation,
                geofence: nil,
                activity: nil,
                providerStatus: nil,
                lifecycle: nil,
                result: nil,
                error: nil,
                id: UUID().uuidString,
                type: .location,
                timestamp: Date().timeIntervalSince1970 * 1000,
                deliveredToJS: false
            )
            let storedForRun: Bool = withStoreLock {
                guard runGeneration == storeGeneration,
                    self.locationSessionGeneration == locationSessionGeneration,
                    locationSessionActive,
                    options != nil
                else { return false }
                appendStoredLocation(stored)
                appendStoredEvent(
                    StoredBackgroundEventEnvelope(
                        event: event,
                        createdAt: Date().timeIntervalSince1970 * 1000,
                        id: event.id,
                        type: event.type,
                        timestamp: event.timestamp,
                        deliveredToJS: false
                    )
                )
                persistStore()
                return true
            }
            guard storedForRun else { return }
            dispatchInProcess(
                event: event,
                location: backgroundLocation,
                runGeneration: runGeneration,
                locationSessionGeneration: locationSessionGeneration
            )
            scheduleSyncIfNeeded(
                runGeneration: runGeneration,
                locationSessionGeneration: locationSessionGeneration
            )
        }
    }

    func handleRegion(
        _ region: CLRegion,
        transition: GeofenceTransition,
        runGeneration: UInt64
    ) {
        guard let geofence = withStoreLock({ () -> GeofenceRegion? in
            guard runGeneration == storeGeneration else { return nil }
            return geofences.first(where: { $0.identifier == region.identifier })
        }) else {
            return
        }
        let event = BackgroundEventEnvelope(
            location: nil,
            geofence: GeofenceEvent(
                region: geofence,
                transition: transition,
                location: nil,
                timestamp: Date().timeIntervalSince1970 * 1000
            ),
            activity: nil,
            providerStatus: nil,
            lifecycle: nil,
            result: nil,
            error: nil,
            id: UUID().uuidString,
            type: .geofence,
            timestamp: Date().timeIntervalSince1970 * 1000,
            deliveredToJS: false
        )
        let storedForRun: Bool = withStoreLock {
            guard runGeneration == storeGeneration else { return false }
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
        dispatchInProcess(event: event, runGeneration: runGeneration)
    }

    private func validateBackgroundLocationMode() throws {
        guard hasBackgroundLocationMode() else {
            withStoreLock { state = .error }
            throw RuntimeError.error(
                withMessage: "UIBackgroundModes must include location for iOS background location"
            )
        }
    }

    private func apply(_ options: BackgroundLocationOptions) {
        runOnMainSync {
            guard let manager = self.manager else { return }
            manager.allowsBackgroundLocationUpdates = true
            manager.pausesLocationUpdatesAutomatically =
                options.ios?.pausesLocationUpdatesAutomatically ?? false
            if #available(iOS 11.0, *) {
                manager.showsBackgroundLocationIndicator =
                    options.ios?.showsBackgroundLocationIndicator ?? false
            }
            manager.desiredAccuracy = kCLLocationAccuracyBest
            manager.distanceFilter = options.distanceFilter ?? kCLDistanceFilterNone
            manager.activityType = mapActivityType(options.ios?.activityType)
            if options.trackingMode == .significantchanges ||
                options.ios?.useSignificantChanges == true {
                manager.startMonitoringSignificantLocationChanges()
            } else {
                manager.startUpdatingLocation()
            }
        }
    }

    func runOnMainSync(_ work: @escaping () -> Void) {
        if Thread.isMainThread {
            work()
        } else {
            DispatchQueue.main.sync(execute: work)
        }
    }

    private func hasBackgroundLocationMode() -> Bool {
        guard let modes = Bundle.main.object(forInfoDictionaryKey: "UIBackgroundModes") as? [String] else {
            return false
        }
        return modes.contains("location")
    }

    func withStoreLock<T>(_ work: () throws -> T) rethrows -> T {
        storeLock.lock()
        defer { storeLock.unlock() }
        return try work()
    }

    func withListenerLock<T>(_ work: () throws -> T) rethrows -> T {
        listenerLock.lock()
        defer { listenerLock.unlock() }
        return try work()
    }

    func isCurrentGeneration(_ generation: UInt64) -> Bool {
        return withStoreLock { generation == storeGeneration }
    }

    private func loadPersistedStore() {
        withStoreLock {
            storedLocations = (defaults.array(forKey: locationsKey) as? [[String: Any]] ?? [])
                .compactMap(makeStoredLocation)
            geofences = (defaults.array(forKey: geofencesKey) as? [[String: Any]] ?? [])
                .compactMap(makeGeofenceRegion)
            storedEvents = (defaults.array(forKey: eventsKey) as? [[String: Any]] ?? [])
                .compactMap { makeStoredEvent($0, storedLocations: storedLocations) }
            options = defaults.dictionary(forKey: optionsKey).flatMap(makeBackgroundOptions)
        }
    }

    func persistStore() {
        withStoreLock {
            defaults.set(storedLocations.map(storedLocationDictionary), forKey: locationsKey)
            defaults.set(storedEvents.map(storedEventDictionary), forKey: eventsKey)
            defaults.set(geofences.map(geofenceDictionary), forKey: geofencesKey)
        }
    }

    private func shouldPersist(allowUnconfigured: Bool = false) -> Bool {
        guard let options else { return allowUnconfigured }
        return options.persist != false
    }

    // Default store cap (rows) applied when maxStored* is unset, matching the Android side. An
    // explicit value <= 0 means UNBOUNDED (no cap), preserving the library's original opt-out.
    private static let defaultMaxStoredRows = 10_000

    private func resolveMaxStored(_ configured: Double?, default def: Int) -> Int? {
        guard let configured = configured else { return def }
        if configured <= 0 { return nil }
        return Int(configured)
    }

    private func appendStoredLocation(_ location: StoredBackgroundLocation) {
        withStoreLock {
            guard shouldPersist() else { return }
            storedLocations.append(location)
            if let max = resolveMaxStored(options?.maxStoredLocations, default: Self.defaultMaxStoredRows),
               storedLocations.count > max {
                storedLocations = Array(storedLocations.suffix(max))
            }
        }
    }

    func appendStoredEvent(
        _ event: StoredBackgroundEventEnvelope,
        allowUnconfigured: Bool = false
    ) {
        withStoreLock {
            guard shouldPersist(allowUnconfigured: allowUnconfigured) else { return }
            storedEvents.append(event)
            if let max = resolveMaxStored(options?.maxStoredEvents, default: Self.defaultMaxStoredRows),
               storedEvents.count > max {
                storedEvents = Array(storedEvents.suffix(max))
            }
        }
    }

    private func persistOptions(_ options: BackgroundLocationOptions) {
        defaults.set(backgroundOptionsDictionary(options), forKey: optionsKey)
    }

}
