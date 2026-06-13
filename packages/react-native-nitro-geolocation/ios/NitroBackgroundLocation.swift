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
    private var options: BackgroundLocationOptions?
    private var state: BackgroundLocationState = .idle
    private var isRunning = false
    private var eventListeners: [String: (BackgroundEventEnvelope) -> Void] = [:]
    private var locationListeners: [String: (BackgroundLocation) -> Void] = [:]
    private var errorListeners: [String: (LocationError) -> Void] = [:]
    private var storedLocations: [StoredBackgroundLocation] = []
    private var storedEvents: [StoredBackgroundEventEnvelope] = []
    private var geofences: [GeofenceRegion] = []
    private var manager: CLLocationManager?
    private var delegate: NitroBackgroundLocationDelegate?
    private let motionManager = CMMotionActivityManager()
    private let motionQueue = OperationQueue()
    private var isMotionUpdatesRunning = false
    private let syncQueue = DispatchQueue(label: "nitro.background.sync")
    private let httpSync = IOSBackgroundHttpSync()
    private var permissionSemaphore: DispatchSemaphore?
    private var lastSyncAt: TimeInterval = 0

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
            self.ensureManager()
            let status = CLLocationManager.authorizationStatus()
            let shouldWait = status == .notDetermined || status == .authorizedWhenInUse
            let semaphore = shouldWait ? DispatchSemaphore(value: 0) : nil
            self.permissionSemaphore = semaphore
            DispatchQueue.main.async {
                self.manager?.requestAlwaysAuthorization()
            }
            if Thread.isMainThread == false {
                _ = semaphore?.wait(timeout: .now() + 60)
            }
            self.permissionSemaphore = nil
            return self.permissionResult()
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
            self.options = options
            self.persistOptions(options)
        }
    }

    func getBackgroundConfiguration() throws -> Promise<BackgroundLocationOptions?> {
        return Promise.async {
            return self.options
        }
    }

    func startBackgroundLocation(options: BackgroundLocationOptions?) throws -> Promise<Void> {
        return Promise.async {
            if let options {
                self.options = options
                self.persistOptions(options)
            }
            guard let current = self.options else {
                throw RuntimeError.error(withMessage: "Background location is not configured")
            }
            self.ensureManager()
            let permission = self.permissionResult()
            guard permission.background == .granted else {
                self.state = .error
                throw RuntimeError.error(withMessage: "Background location permission is required")
            }
            self.state = .starting
            try self.apply(current)
            if current.trackingMode == .activityaware ||
                current.activityRecognition?.enabled == true {
                self.startMotionUpdatesIfAvailable()
            }
            self.isRunning = true
            self.state = .running
        }
    }

    func stopBackgroundLocation() throws -> Promise<Void> {
        return Promise.async {
            self.state = .stopping
            self.runOnMainSync {
                self.manager?.disallowDeferredLocationUpdates()
                self.manager?.stopUpdatingLocation()
                self.manager?.stopMonitoringSignificantLocationChanges()
            }
            self.stopMotionUpdatesIfRunning()
            self.isRunning = false
            self.state = .stopped
        }
    }

    func resetBackgroundLocation() throws -> Promise<Void> {
        return Promise.async {
            self.runOnMainSync {
                self.manager?.disallowDeferredLocationUpdates()
                self.manager?.stopUpdatingLocation()
                self.manager?.stopMonitoringSignificantLocationChanges()
                self.manager?.monitoredRegions.forEach { self.manager?.stopMonitoring(for: $0) }
            }
            self.stopMotionUpdatesIfRunning()
            self.options = nil
            self.defaults.removeObject(forKey: self.optionsKey)
            self.isRunning = false
            self.state = .idle
            self.storedLocations.removeAll()
            self.storedEvents.removeAll()
            self.geofences.removeAll()
            self.persistStore()
        }
    }

    func getBackgroundLocationStatus() throws -> Promise<BackgroundLocationStatus> {
        return Promise.async {
            let permission = self.permissionResult()
            return BackgroundLocationStatus(
                state: self.state,
                isRunning: self.isRunning,
                isConfigured: self.options != nil,
                foregroundPermission: permission.foreground,
                backgroundPermission: permission.background,
                accuracyAuthorization: permission.accuracyAuthorization,
                locationServicesEnabled: CLLocationManager.locationServicesEnabled(),
                providerStatus: nil,
                storedLocationCount: Double(self.storedLocations.count),
                storedEventCount: Double(self.storedEvents.count),
                geofenceCount: Double(self.geofences.count),
                android: nil,
                ios: IOSBackgroundLocationStatus(
                    allowsBackgroundLocationUpdates: self.manager?.allowsBackgroundLocationUpdates ?? false,
                    significantChangesEnabled: self.options?.trackingMode == .significantchanges ||
                        self.options?.ios?.useSignificantChanges == true
                ),
                lastError: nil
            )
        }
    }

    func addBackgroundEventListener(listener: @escaping (BackgroundEventEnvelope) -> Void) throws -> String {
        let token = UUID().uuidString
        eventListeners[token] = listener
        return token
    }

    func removeBackgroundEventListener(token: String) throws {
        eventListeners.removeValue(forKey: token)
    }

    func addBackgroundLocationListener(listener: @escaping (BackgroundLocation) -> Void) throws -> String {
        let token = UUID().uuidString
        locationListeners[token] = listener
        return token
    }

    func removeBackgroundLocationListener(token: String) throws {
        locationListeners.removeValue(forKey: token)
    }

    func addBackgroundErrorListener(listener: @escaping (LocationError) -> Void) throws -> String {
        let token = UUID().uuidString
        errorListeners[token] = listener
        return token
    }

    func removeBackgroundErrorListener(token: String) throws {
        errorListeners.removeValue(forKey: token)
    }

    func getStoredBackgroundLocations(
        options: GetStoredBackgroundLocationsOptions?
    ) throws -> Promise<[StoredBackgroundLocation]> {
        return Promise.async {
            var rows = self.storedLocations
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
            guard let ids else {
                self.storedLocations.removeAll()
                self.persistStore()
                return
            }
            self.storedLocations.removeAll { ids.contains($0.id) }
            self.persistStore()
        }
    }

    func markStoredBackgroundLocationsDelivered(ids: [String]) throws -> Promise<Void> {
        return Promise.async {
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

    func getStoredBackgroundEvents(
        options: GetStoredBackgroundEventsOptions?
    ) throws -> Promise<[StoredBackgroundEventEnvelope]> {
        return Promise.async {
            var rows = self.storedEvents
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
            guard let ids else {
                self.storedEvents.removeAll()
                self.persistStore()
                return
            }
            self.storedEvents.removeAll { ids.contains($0.id) }
            self.persistStore()
        }
    }

    func markStoredBackgroundEventsDelivered(ids: [String]) throws -> Promise<Void> {
        return Promise.async {
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

    func addGeofences(regions: [GeofenceRegion], options: GeofencingOptions?) throws -> Promise<Void> {
        return Promise.async {
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
            self.geofences.removeAll { existing in
                sanitized.contains { $0.identifier == existing.identifier }
            }
            self.geofences.append(contentsOf: sanitized)
            self.persistStore()
        }
    }

    func removeGeofences(identifiers: [String]?) throws -> Promise<Void> {
        return Promise.async {
            guard let identifiers else {
                self.runOnMainSync {
                    self.manager?.monitoredRegions.forEach { self.manager?.stopMonitoring(for: $0) }
                }
                self.geofences.removeAll()
                self.persistStore()
                return
            }
            self.runOnMainSync {
                self.manager?.monitoredRegions
                    .filter { identifiers.contains($0.identifier) }
                    .forEach { self.manager?.stopMonitoring(for: $0) }
            }
            self.geofences.removeAll { identifiers.contains($0.identifier) }
            self.persistStore()
        }
    }

    func getRegisteredGeofences() throws -> Promise<[GeofenceRegion]> {
        return Promise.async {
            return self.geofences.map(bridgeSafeGeofence)
        }
    }

    func startActivityRecognition(options: ActivityRecognitionOptions?) throws -> Promise<Void> {
        return Promise.async {
            guard CMMotionActivityManager.isActivityAvailable() else {
                throw RuntimeError.error(withMessage: "Core Motion activity recognition is not available")
            }
            self.startMotionUpdatesIfAvailable()
        }
    }

    func stopActivityRecognition() throws -> Promise<Void> {
        return Promise.async {
            self.stopMotionUpdatesIfRunning()
        }
    }

    func syncStoredLocations() throws -> Promise<BackgroundHttpSyncResult> {
        return Promise.async {
            return self.performSyncStoredLocations()
        }
    }

    func handleLocations(_ locations: [CLLocation]) {
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
                result: nil,
                error: nil,
                id: UUID().uuidString,
                type: .location,
                timestamp: Date().timeIntervalSince1970 * 1000,
                deliveredToJS: false
            )
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
            eventListeners.values.forEach { $0(event) }
            locationListeners.values.forEach { $0(backgroundLocation) }
            scheduleSyncIfNeeded()
        }
    }

    func handleRegion(_ region: CLRegion, transition: GeofenceTransition) {
        guard let geofence = geofences.first(where: { $0.identifier == region.identifier }) else {
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
            result: nil,
            error: nil,
            id: UUID().uuidString,
            type: .geofence,
            timestamp: Date().timeIntervalSince1970 * 1000,
            deliveredToJS: false
        )
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
        eventListeners.values.forEach { $0(event) }
    }

    private func startMotionUpdatesIfAvailable() {
        guard CMMotionActivityManager.isActivityAvailable() else { return }
        motionManager.startActivityUpdates(to: motionQueue) { [weak self] activity in
            guard let self, let activity else { return }
            self.handleMotionActivity(activity)
        }
        isMotionUpdatesRunning = true
    }

    private func stopMotionUpdatesIfRunning() {
        guard isMotionUpdatesRunning else { return }
        motionManager.stopActivityUpdates()
        isMotionUpdatesRunning = false
    }

    private func handleMotionActivity(_ activity: CMMotionActivity) {
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
            result: nil,
            error: nil,
            id: UUID().uuidString,
            type: .activity,
            timestamp: Date().timeIntervalSince1970 * 1000,
            deliveredToJS: false
        )
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
        eventListeners.values.forEach { $0(event) }
        applyActivityAwareTracking(detected)
    }

    func handleAuthorizationChange() {
        permissionSemaphore?.signal()
    }

    func handleError(_ error: Error) {
        // kCLErrorLocationUnknown is transient — CoreLocation couldn't get a fix right now but keeps
        // trying (very common on the Simulator and during brief GPS gaps). Apple's guidance is to
        // ignore it; forwarding it would pollute the consumer's error stream with benign noise.
        if let clError = error as? CLError, clError.code == .locationUnknown {
            return
        }
        let locationError = LocationError(code: -1, message: error.localizedDescription)
        errorListeners.values.forEach { $0(locationError) }
    }

    private func ensureManager() {
        if manager != nil { return }
        if Thread.isMainThread == false {
            DispatchQueue.main.sync {
                self.ensureManager()
            }
            return
        }
        let manager = CLLocationManager()
        let delegate = NitroBackgroundLocationDelegate(owner: self)
        manager.delegate = delegate
        self.manager = manager
        self.delegate = delegate
    }

    private func apply(_ options: BackgroundLocationOptions) throws {
        guard hasBackgroundLocationMode() else {
            state = .error
            throw RuntimeError.error(
                withMessage: "UIBackgroundModes must include location for iOS background location"
            )
        }
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

    func applyDeferredUpdatesIfNeeded(_ manager: CLLocationManager) {
        guard
            let options,
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

    private func applyActivityAwareTracking(_ activity: DetectedActivity) {
        guard let options else { return }
        let activityOptions = options.activityRecognition
        guard options.trackingMode == .activityaware ||
            activityOptions?.stopOnStill == true else {
            return
        }
        let minimumConfidence = activityOptions?.minimumConfidence ?? 0
        guard activity.confidence >= minimumConfidence else { return }
        let stopOnStill = activityOptions?.stopOnStill ?? (options.trackingMode == .activityaware)
        if activity.type == .still && stopOnStill {
            runOnMainSync {
                self.manager?.disallowDeferredLocationUpdates()
                self.manager?.stopUpdatingLocation()
                self.manager?.stopMonitoringSignificantLocationChanges()
            }
            return
        }
        if activity.type != .still && activity.type != .unknown && isRunning {
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

    private func runOnMainSync(_ work: @escaping () -> Void) {
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

    private func loadPersistedStore() {
        storedLocations = (defaults.array(forKey: locationsKey) as? [[String: Any]] ?? [])
            .compactMap(makeStoredLocation)
        geofences = (defaults.array(forKey: geofencesKey) as? [[String: Any]] ?? [])
            .compactMap(makeGeofenceRegion)
        storedEvents = (defaults.array(forKey: eventsKey) as? [[String: Any]] ?? [])
            .compactMap { makeStoredEvent($0, storedLocations: storedLocations) }
        options = defaults.dictionary(forKey: optionsKey).flatMap(makeBackgroundOptions)
    }

    private func persistStore() {
        defaults.set(storedLocations.map(storedLocationDictionary), forKey: locationsKey)
        defaults.set(storedEvents.map(storedEventDictionary), forKey: eventsKey)
        defaults.set(geofences.map(geofenceDictionary), forKey: geofencesKey)
    }

    private func shouldPersist() -> Bool {
        return options?.persist != false
    }

    private func safePrefixCount(
        _ value: Double?,
        defaultValue: Int,
        upperBound: Int
    ) -> Int {
        let requested = value ?? Double(defaultValue)
        guard requested.isFinite, requested > 0 else { return 0 }
        return Int(min(requested.rounded(.down), Double(upperBound)))
    }

    private func positiveFiniteInt(_ value: Double?, defaultValue: Int) -> Int {
        guard let value, value.isFinite, value > 0 else {
            return defaultValue
        }
        if value >= Double(Int.max) {
            return Int.max
        }
        return max(Int(value.rounded(.down)), 1)
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
        guard shouldPersist() else { return }
        storedLocations.append(location)
        if let max = resolveMaxStored(options?.maxStoredLocations, default: Self.defaultMaxStoredRows),
           storedLocations.count > max {
            storedLocations = Array(storedLocations.suffix(max))
        }
    }

    private func appendStoredEvent(_ event: StoredBackgroundEventEnvelope) {
        guard shouldPersist() else { return }
        storedEvents.append(event)
        if let max = resolveMaxStored(options?.maxStoredEvents, default: Self.defaultMaxStoredRows),
           storedEvents.count > max {
            storedEvents = Array(storedEvents.suffix(max))
        }
    }

    private func persistOptions(_ options: BackgroundLocationOptions) {
        defaults.set(backgroundOptionsDictionary(options), forKey: optionsKey)
    }

    private func scheduleSyncIfNeeded() {
        guard let sync = options?.sync else { return }
        let threshold = positiveFiniteInt(sync.syncThreshold, defaultValue: 1)
        let unsyncedCount = storedLocations.filter { !$0.synced }.count
        guard unsyncedCount >= threshold else { return }

        let now = Date().timeIntervalSince1970 * 1000
        let interval = sync.syncInterval ?? 0
        guard interval <= 0 || now - lastSyncAt >= interval else { return }
        lastSyncAt = now

        syncQueue.async {
            let result = self.performSyncStoredLocations()
            let event = BackgroundEventEnvelope(
                location: nil,
                geofence: nil,
                activity: nil,
                providerStatus: nil,
                result: result,
                error: nil,
                id: UUID().uuidString,
                type: .httpsync,
                timestamp: Date().timeIntervalSince1970 * 1000,
                deliveredToJS: false
            )
            self.appendStoredEvent(
                StoredBackgroundEventEnvelope(
                    event: event,
                    createdAt: Date().timeIntervalSince1970 * 1000,
                    id: event.id,
                    type: event.type,
                    timestamp: event.timestamp,
                    deliveredToJS: false
                )
            )
            self.persistStore()
            self.eventListeners.values.forEach { $0(event) }
        }
    }

    private func performSyncStoredLocations() -> BackgroundHttpSyncResult {
        let allUnsynced = storedLocations.filter { !$0.synced }
        let unsynced = allUnsynced.prefix(safePrefixCount(
            options?.sync?.batchSize,
            defaultValue: 50,
            upperBound: allUnsynced.count
        ))
        let ids = unsynced.map(\.id)
        if ids.isEmpty {
            return BackgroundHttpSyncResult(
                success: true,
                statusCode: nil,
                syncedLocationIds: [],
                failedLocationIds: [],
                error: nil
            )
        }
        guard let sync = options?.sync else {
            return BackgroundHttpSyncResult(
                success: true,
                statusCode: nil,
                syncedLocationIds: [],
                failedLocationIds: [],
                error: nil
            )
        }
        let result = httpSync.uploadWithRetry(locations: Array(unsynced), sync: sync)
        if !result.success && result.syncedLocationIds.isEmpty {
            return result
        }
        let syncedIds = result.syncedLocationIds
        storedLocations = storedLocations.map { location in
            syncedIds.contains(location.id)
                ? StoredBackgroundLocation(
                    id: location.id,
                    deliveredToJS: location.deliveredToJS,
                    synced: true,
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
        if options?.sync?.autoClear == true {
            storedLocations.removeAll { syncedIds.contains($0.id) }
        }
        persistStore()
        return result
    }

    private func permissionResult() -> BackgroundPermissionResult {
        ensureManager()
        let status = CLLocationManager.authorizationStatus()
        let foreground: PermissionStatus
        let background: BackgroundPermissionStatus
        switch status {
        case .authorizedAlways:
            foreground = .granted
            background = .granted
        case .authorizedWhenInUse:
            foreground = .granted
            background = .denied
        case .denied:
            foreground = .denied
            background = .denied
        case .restricted:
            foreground = .restricted
            background = .restricted
        case .notDetermined:
            foreground = .undetermined
            background = .undetermined
        @unknown default:
            foreground = .undetermined
            background = .undetermined
        }

        let accuracy: AccuracyAuthorization
        if #available(iOS 14.0, *) {
            accuracy = manager?.accuracyAuthorization == .fullAccuracy ? .full : .reduced
        } else {
            accuracy = .unknown
        }

        return BackgroundPermissionResult(
            foreground: foreground,
            background: background,
            accuracyAuthorization: accuracy,
            canRequestBackgroundInline: true,
            needsSettingsRedirect: background != .granted
        )
    }
}
