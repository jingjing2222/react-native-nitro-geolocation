import CoreLocation
import CoreMotion
import Foundation
import NitroModules
import UIKit

private final class NitroBackgroundLocationDelegate: NSObject, CLLocationManagerDelegate {
    weak var owner: NitroBackgroundLocation?

    init(owner: NitroBackgroundLocation) {
        self.owner = owner
        super.init()
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        owner?.handleLocations(locations)
        owner?.applyDeferredUpdatesIfNeeded(manager)
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        owner?.handleError(error)
    }

    func locationManager(_ manager: CLLocationManager, didEnterRegion region: CLRegion) {
        owner?.handleRegion(region, transition: .enter)
    }

    func locationManager(_ manager: CLLocationManager, didExitRegion region: CLRegion) {
        owner?.handleRegion(region, transition: .exit)
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        owner?.handleAuthorizationChange()
    }

    func locationManager(_ manager: CLLocationManager, didChangeAuthorization status: CLAuthorizationStatus) {
        owner?.handleAuthorizationChange()
    }
}

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
    private let syncQueue = DispatchQueue(label: "nitro.background.sync")
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
            self.motionManager.stopActivityUpdates()
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
            self.motionManager.stopActivityUpdates()
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
            let sanitized = regions.map(self.sanitizedGeofence)
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
            return self.geofences.map(self.bridgeSafeGeofence)
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
            self.motionManager.stopActivityUpdates()
        }
    }

    func syncStoredLocations() throws -> Promise<BackgroundHttpSyncResult> {
        return Promise.async {
            return self.performSyncStoredLocations()
        }
    }

    fileprivate func handleLocations(_ locations: [CLLocation]) {
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

    fileprivate func handleRegion(_ region: CLRegion, transition: GeofenceTransition) {
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

    fileprivate func handleAuthorizationChange() {
        permissionSemaphore?.signal()
    }

    fileprivate func handleError(_ error: Error) {
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
            manager.activityType = self.mapActivityType(options.ios?.activityType)
            if options.trackingMode == .significantchanges ||
                options.ios?.useSignificantChanges == true {
                manager.startMonitoringSignificantLocationChanges()
            } else {
                manager.startUpdatingLocation()
            }
        }
    }

    fileprivate func applyDeferredUpdatesIfNeeded(_ manager: CLLocationManager) {
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
                self.manager?.stopUpdatingLocation()
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
            .compactMap(makeStoredEvent)
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

    private func appendStoredLocation(_ location: StoredBackgroundLocation) {
        guard shouldPersist() else { return }
        storedLocations.append(location)
        if let maxValue = options?.maxStoredLocations, maxValue > 0 {
            let max = Int(maxValue)
            if storedLocations.count > max {
                storedLocations = Array(storedLocations.suffix(max))
            }
        }
    }

    private func appendStoredEvent(_ event: StoredBackgroundEventEnvelope) {
        guard shouldPersist() else { return }
        storedEvents.append(event)
        if let maxValue = options?.maxStoredEvents, maxValue > 0 {
            let max = Int(maxValue)
            if storedEvents.count > max {
                storedEvents = Array(storedEvents.suffix(max))
            }
        }
    }

    private func persistOptions(_ options: BackgroundLocationOptions) {
        defaults.set(backgroundOptionsDictionary(options), forKey: optionsKey)
    }

    private func upload(
        locations: [StoredBackgroundLocation],
        sync: BackgroundHttpSyncOptions
    ) -> BackgroundHttpSyncResult {
        guard let url = URL(string: sync.url) else {
            return BackgroundHttpSyncResult(
                success: false,
                statusCode: nil,
                syncedLocationIds: [],
                failedLocationIds: locations.map(\.id),
                error: "Invalid sync URL"
            )
        }
        var request = URLRequest(url: url)
        request.httpMethod = sync.method?.stringValue ?? "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        sync.headers?.forEach { request.setValue($0.value, forHTTPHeaderField: $0.key) }
        let body: Any
        if sync.batch == false, let location = locations.first {
            if var template = sync.bodyTemplate.map(bodyTemplateDictionary) {
                template["location"] = storedLocationDictionary(location)
                body = template
            } else {
                body = storedLocationDictionary(location)
            }
        } else {
            var template = sync.bodyTemplate.map(bodyTemplateDictionary) ?? [:]
            template["locations"] = locations.map(storedLocationDictionary)
            body = template
        }
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        let semaphore = DispatchSemaphore(value: 0)
        var statusCode: Int?
        var requestError: String?
        URLSession.shared.dataTask(with: request) { _, response, error in
            statusCode = (response as? HTTPURLResponse)?.statusCode
            requestError = error?.localizedDescription
            semaphore.signal()
        }.resume()
        semaphore.wait()

        let success = statusCode.map { (200..<300).contains($0) } ?? false
        return BackgroundHttpSyncResult(
            success: success,
            statusCode: statusCode.map(Double.init),
            syncedLocationIds: success ? locations.map(\.id) : [],
            failedLocationIds: success ? [] : locations.map(\.id),
            error: success ? nil : (requestError ?? "HTTP sync failed")
        )
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
        let result = uploadWithRetry(locations: Array(unsynced), sync: sync)
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

    private func uploadWithRetry(
        locations: [StoredBackgroundLocation],
        sync: BackgroundHttpSyncOptions
    ) -> BackgroundHttpSyncResult {
        if sync.batch == false {
            return uploadSingleLocationsWithRetry(locations: locations, sync: sync)
        }
        let maxAttempts = sync.retry == true
            ? Int(sync.maxRetries ?? 3) + 1
            : 1
        var lastResult: BackgroundHttpSyncResult?
        for attempt in 0..<max(maxAttempts, 1) {
            let result = upload(locations: locations, sync: sync)
            if result.success {
                return result
            }
            lastResult = result
            if attempt < maxAttempts - 1 {
                Thread.sleep(forTimeInterval: 1)
            }
        }
        return lastResult ?? BackgroundHttpSyncResult(
            success: false,
            statusCode: nil,
            syncedLocationIds: [],
            failedLocationIds: locations.map(\.id),
            error: "HTTP sync failed"
        )
    }

    private func uploadSingleLocationsWithRetry(
        locations: [StoredBackgroundLocation],
        sync: BackgroundHttpSyncOptions
    ) -> BackgroundHttpSyncResult {
        let maxAttempts = sync.retry == true
            ? Int(sync.maxRetries ?? 3) + 1
            : 1
        var synced: [String] = []
        var failed: [String] = []
        var lastStatusCode: Double?
        var lastError: String?

        for location in locations {
            var didSync = false
            for attempt in 0..<max(maxAttempts, 1) {
                let result = upload(locations: [location], sync: sync)
                lastStatusCode = result.statusCode
                lastError = result.error
                if result.success {
                    synced.append(location.id)
                    didSync = true
                    break
                }
                if attempt < maxAttempts - 1 {
                    Thread.sleep(forTimeInterval: 1)
                }
            }
            if !didSync {
                failed.append(location.id)
            }
        }

        return BackgroundHttpSyncResult(
            success: failed.isEmpty,
            statusCode: lastStatusCode,
            syncedLocationIds: synced,
            failedLocationIds: failed,
            error: failed.isEmpty ? nil : (lastError ?? "HTTP sync failed")
        )
    }

    private func makeStoredLocation(_ dictionary: [String: Any]) -> StoredBackgroundLocation? {
        guard
            let id = dictionary["id"] as? String,
            let coordsDictionary = dictionary["coords"] as? [String: Any],
            let coords = makeCoordinates(coordsDictionary),
            let sourceValue = dictionary["source"] as? String,
            let source = BackgroundLocationSource(fromString: sourceValue),
            let recordedAt = dictionary["recordedAt"] as? Double,
            let createdAt = dictionary["createdAt"] as? Double,
            let timestamp = dictionary["timestamp"] as? Double
        else {
            return nil
        }
        return StoredBackgroundLocation(
            id: id,
            deliveredToJS: dictionary["deliveredToJS"] as? Bool ?? false,
            synced: dictionary["synced"] as? Bool ?? false,
            createdAt: createdAt,
            source: source,
            isFromBackground: dictionary["isFromBackground"] as? Bool ?? true,
            provider: (dictionary["provider"] as? String).flatMap(LocationProviderUsed.init(fromString:)),
            mocked: dictionary["mocked"] as? Bool,
            recordedAt: recordedAt,
            activity: nil,
            battery: nil,
            coords: coords,
            timestamp: timestamp
        )
    }

    private func makeStoredEvent(_ dictionary: [String: Any]) -> StoredBackgroundEventEnvelope? {
        guard
            let id = dictionary["id"] as? String,
            let typeValue = dictionary["type"] as? String,
            let type = BackgroundEventType(fromString: typeValue),
            let timestamp = dictionary["timestamp"] as? Double,
            let createdAt = dictionary["createdAt"] as? Double
        else {
            return nil
        }
        let persistedLocation = (dictionary["location"] as? [String: Any])
            .flatMap(makeBackgroundLocation)
        let referencedLocation = (dictionary["locationId"] as? String)
            .flatMap { locationId in storedLocations.first { $0.id == locationId } }
            .map(backgroundLocation)
        let location = persistedLocation ?? referencedLocation
        let geofence = (dictionary["geofence"] as? [String: Any]).flatMap(makeGeofenceEvent)
        let activity = (dictionary["activity"] as? [String: Any]).flatMap(makeActivity)
        let event = BackgroundEventEnvelope(
            location: location,
            geofence: geofence,
            activity: activity,
            providerStatus: nil,
            result: (dictionary["result"] as? [String: Any]).flatMap(makeHttpSyncResult),
            error: nil,
            id: id,
            type: type,
            timestamp: timestamp,
            deliveredToJS: dictionary["deliveredToJS"] as? Bool ?? false
        )
        return StoredBackgroundEventEnvelope(
            event: event,
            createdAt: createdAt,
            id: id,
            type: type,
            timestamp: timestamp,
            deliveredToJS: event.deliveredToJS
        )
    }

    private func makeBackgroundLocation(_ dictionary: [String: Any]) -> BackgroundLocation? {
        guard
            let id = dictionary["id"] as? String,
            let coordsDictionary = dictionary["coords"] as? [String: Any],
            let coords = makeCoordinates(coordsDictionary),
            let sourceValue = dictionary["source"] as? String,
            let source = BackgroundLocationSource(fromString: sourceValue),
            let recordedAt = dictionary["recordedAt"] as? Double,
            let timestamp = dictionary["timestamp"] as? Double
        else {
            return nil
        }
        return BackgroundLocation(
            id: id,
            source: source,
            isFromBackground: dictionary["isFromBackground"] as? Bool ?? true,
            provider: (dictionary["provider"] as? String).flatMap(LocationProviderUsed.init(fromString:)),
            mocked: dictionary["mocked"] as? Bool,
            recordedAt: recordedAt,
            activity: nil,
            battery: nil,
            coords: coords,
            timestamp: timestamp
        )
    }

    private func makeActivity(_ dictionary: [String: Any]) -> DetectedActivity? {
        guard
            let typeValue = dictionary["type"] as? String,
            let type = DetectedActivityType(fromString: typeValue),
            let confidence = dictionary["confidence"] as? Double,
            let timestamp = dictionary["timestamp"] as? Double
        else {
            return nil
        }
        return DetectedActivity(type: type, confidence: confidence, timestamp: timestamp)
    }

    private func makeCoordinates(_ dictionary: [String: Any]) -> GeolocationCoordinates? {
        guard
            let latitude = dictionary["latitude"] as? Double,
            let longitude = dictionary["longitude"] as? Double,
            let accuracy = dictionary["accuracy"] as? Double
        else {
            return nil
        }
        return GeolocationCoordinates(
            latitude: latitude,
            longitude: longitude,
            altitude: nullableDouble(dictionary["altitude"]),
            accuracy: accuracy,
            altitudeAccuracy: nullableDouble(dictionary["altitudeAccuracy"]),
            heading: nullableDouble(dictionary["heading"]),
            speed: nullableDouble(dictionary["speed"])
        )
    }

    private func makeGeofenceRegion(_ dictionary: [String: Any]) -> GeofenceRegion? {
        guard
            let identifier = dictionary["identifier"] as? String,
            let latitude = dictionary["latitude"] as? Double,
            let longitude = dictionary["longitude"] as? Double,
            let radius = dictionary["radius"] as? Double
        else {
            return nil
        }
        return GeofenceRegion(
            identifier: identifier,
            latitude: latitude,
            longitude: longitude,
            radius: radius,
            notifyOnEntry: dictionary["notifyOnEntry"] as? Bool,
            notifyOnExit: dictionary["notifyOnExit"] as? Bool,
            notifyOnDwell: dictionary["notifyOnDwell"] as? Bool,
            loiteringDelay: dictionary["loiteringDelay"] as? Double,
            expirationDuration: dictionary["expirationDuration"] as? Double,
            metadata: (dictionary["metadata"] as? [String: Any]).map(makeMetadata)
        )
    }

    private func sanitizedGeofence(_ region: GeofenceRegion) -> GeofenceRegion {
        return GeofenceRegion(
            identifier: region.identifier,
            latitude: region.latitude,
            longitude: region.longitude,
            radius: region.radius,
            notifyOnEntry: region.notifyOnEntry,
            notifyOnExit: region.notifyOnExit,
            notifyOnDwell: region.notifyOnDwell,
            loiteringDelay: region.loiteringDelay,
            expirationDuration: region.expirationDuration,
            metadata: region.metadata
        )
    }

    private func bridgeSafeGeofence(_ region: GeofenceRegion) -> GeofenceRegion {
        return GeofenceRegion(
            identifier: region.identifier,
            latitude: region.latitude,
            longitude: region.longitude,
            radius: region.radius,
            notifyOnEntry: region.notifyOnEntry,
            notifyOnExit: region.notifyOnExit,
            notifyOnDwell: region.notifyOnDwell,
            loiteringDelay: region.loiteringDelay,
            expirationDuration: region.expirationDuration,
            metadata: region.metadata
        )
    }

    private func makeGeofenceEvent(_ dictionary: [String: Any]) -> GeofenceEvent? {
        guard
            let regionDictionary = dictionary["region"] as? [String: Any],
            let region = makeGeofenceRegion(regionDictionary),
            let transitionValue = dictionary["transition"] as? String,
            let transition = GeofenceTransition(fromString: transitionValue),
            let timestamp = dictionary["timestamp"] as? Double
        else {
            return nil
        }
        return GeofenceEvent(
            region: region,
            transition: transition,
            location: nil,
            timestamp: timestamp
        )
    }

    private func storedLocationDictionary(_ location: StoredBackgroundLocation) -> [String: Any] {
        var dictionary: [String: Any] = [
            "id": location.id,
            "deliveredToJS": location.deliveredToJS,
            "synced": location.synced,
            "createdAt": location.createdAt,
            "source": location.source.stringValue,
            "isFromBackground": location.isFromBackground,
            "recordedAt": location.recordedAt,
            "coords": coordinatesDictionary(location.coords),
            "timestamp": location.timestamp
        ]
        if let provider = location.provider {
            dictionary["provider"] = provider.stringValue
        }
        if let mocked = location.mocked {
            dictionary["mocked"] = mocked
        }
        return dictionary
    }

    private func storedEventDictionary(_ event: StoredBackgroundEventEnvelope) -> [String: Any] {
        var dictionary: [String: Any] = [
            "id": event.id,
            "type": event.type.stringValue,
            "timestamp": event.timestamp,
            "deliveredToJS": event.deliveredToJS,
            "createdAt": event.createdAt
        ]
        if let locationId = event.event.location?.id {
            dictionary["locationId"] = locationId
        }
        if let location = event.event.location {
            dictionary["location"] = backgroundLocationDictionary(location)
        }
        if let geofence = event.event.geofence {
            dictionary["geofence"] = geofenceDictionary(geofence)
        }
        if let activity = event.event.activity {
            dictionary["activity"] = activityDictionary(activity)
        }
        if let result = event.event.result {
            dictionary["result"] = httpSyncResultDictionary(result)
        }
        return dictionary
    }

    private func backgroundLocationDictionary(_ location: BackgroundLocation) -> [String: Any]? {
        guard let id = location.id else {
            return nil
        }
        var dictionary: [String: Any] = [
            "id": id,
            "source": location.source.stringValue,
            "isFromBackground": location.isFromBackground,
            "recordedAt": location.recordedAt,
            "coords": coordinatesDictionary(location.coords),
            "timestamp": location.timestamp
        ]
        if let provider = location.provider {
            dictionary["provider"] = provider.stringValue
        }
        if let mocked = location.mocked {
            dictionary["mocked"] = mocked
        }
        return dictionary
    }

    private func coordinatesDictionary(_ coords: GeolocationCoordinates) -> [String: Any] {
        var dictionary: [String: Any] = [
            "latitude": coords.latitude,
            "longitude": coords.longitude,
            "accuracy": coords.accuracy
        ]
        dictionary["altitude"] = variantDouble(coords.altitude)
        dictionary["altitudeAccuracy"] = variantDouble(coords.altitudeAccuracy)
        dictionary["heading"] = variantDouble(coords.heading)
        dictionary["speed"] = variantDouble(coords.speed)
        return dictionary
    }

    private func geofenceDictionary(_ region: GeofenceRegion) -> [String: Any] {
        var dictionary: [String: Any] = [
            "identifier": region.identifier,
            "latitude": region.latitude,
            "longitude": region.longitude,
            "radius": region.radius
        ]
        dictionary["notifyOnEntry"] = region.notifyOnEntry
        dictionary["notifyOnExit"] = region.notifyOnExit
        dictionary["notifyOnDwell"] = region.notifyOnDwell
        dictionary["loiteringDelay"] = region.loiteringDelay
        dictionary["expirationDuration"] = region.expirationDuration
        dictionary["metadata"] = region.metadata.map(metadataDictionary)
        return dictionary
    }

    private func geofenceDictionary(_ event: GeofenceEvent) -> [String: Any] {
        return [
            "region": geofenceDictionary(event.region),
            "transition": event.transition.stringValue,
            "timestamp": event.timestamp
        ]
    }

    private func activityDictionary(_ activity: DetectedActivity) -> [String: Any] {
        return [
            "type": activity.type.stringValue,
            "confidence": activity.confidence,
            "timestamp": activity.timestamp
        ]
    }

    private func makeHttpSyncResult(_ dictionary: [String: Any]) -> BackgroundHttpSyncResult? {
        guard let success = dictionary["success"] as? Bool else {
            return nil
        }
        return BackgroundHttpSyncResult(
            success: success,
            statusCode: dictionary["statusCode"] as? Double,
            syncedLocationIds: dictionary["syncedLocationIds"] as? [String] ?? [],
            failedLocationIds: dictionary["failedLocationIds"] as? [String] ?? [],
            error: dictionary["error"] as? String
        )
    }

    private func httpSyncResultDictionary(_ result: BackgroundHttpSyncResult) -> [String: Any] {
        var dictionary: [String: Any] = [
            "success": result.success,
            "syncedLocationIds": result.syncedLocationIds,
            "failedLocationIds": result.failedLocationIds
        ]
        dictionary["statusCode"] = result.statusCode
        dictionary["error"] = result.error
        return dictionary
    }

    private func backgroundOptionsDictionary(_ options: BackgroundLocationOptions) -> [String: Any] {
        var dictionary: [String: Any] = [:]
        dictionary["trackingMode"] = options.trackingMode?.stringValue
        dictionary["interval"] = options.interval
        dictionary["fastestInterval"] = options.fastestInterval
        dictionary["distanceFilter"] = options.distanceFilter
        dictionary["maxUpdateDelay"] = options.maxUpdateDelay
        dictionary["waitForAccurateLocation"] = options.waitForAccurateLocation
        dictionary["persist"] = options.persist
        dictionary["maxStoredLocations"] = options.maxStoredLocations
        dictionary["maxStoredEvents"] = options.maxStoredEvents
        dictionary["stopOnTerminate"] = options.stopOnTerminate
        dictionary["startOnBoot"] = options.startOnBoot
        dictionary["ios"] = options.ios.map(iosOptionsDictionary)
        dictionary["activityRecognition"] = options.activityRecognition.map(activityOptionsDictionary)
        dictionary["sync"] = options.sync.map(httpSyncOptionsDictionary)
        return dictionary
    }

    private func makeBackgroundOptions(_ dictionary: [String: Any]) -> BackgroundLocationOptions {
        return BackgroundLocationOptions(
            trackingMode: (dictionary["trackingMode"] as? String).flatMap(BackgroundTrackingMode.init(fromString:)),
            accuracy: nil,
            granularity: nil,
            interval: dictionary["interval"] as? Double,
            fastestInterval: dictionary["fastestInterval"] as? Double,
            distanceFilter: dictionary["distanceFilter"] as? Double,
            maxUpdateDelay: dictionary["maxUpdateDelay"] as? Double,
            waitForAccurateLocation: dictionary["waitForAccurateLocation"] as? Bool,
            persist: dictionary["persist"] as? Bool,
            maxStoredLocations: dictionary["maxStoredLocations"] as? Double,
            maxStoredEvents: dictionary["maxStoredEvents"] as? Double,
            stopOnTerminate: dictionary["stopOnTerminate"] as? Bool,
            startOnBoot: dictionary["startOnBoot"] as? Bool,
            android: nil,
            ios: (dictionary["ios"] as? [String: Any]).map(makeIOSOptions),
            geofencing: nil,
            activityRecognition: (dictionary["activityRecognition"] as? [String: Any]).map(makeActivityOptions),
            sync: (dictionary["sync"] as? [String: Any]).flatMap(makeHttpSyncOptions)
        )
    }

    private func iosOptionsDictionary(_ options: IOSBackgroundLocationOptions) -> [String: Any] {
        var dictionary: [String: Any] = [:]
        dictionary["activityType"] = options.activityType?.stringValue
        dictionary["pausesLocationUpdatesAutomatically"] = options.pausesLocationUpdatesAutomatically
        dictionary["showsBackgroundLocationIndicator"] = options.showsBackgroundLocationIndicator
        dictionary["useSignificantChanges"] = options.useSignificantChanges
        dictionary["deferredUpdatesDistance"] = options.deferredUpdatesDistance
        dictionary["deferredUpdatesInterval"] = options.deferredUpdatesInterval
        return dictionary
    }

    private func makeIOSOptions(_ dictionary: [String: Any]) -> IOSBackgroundLocationOptions {
        return IOSBackgroundLocationOptions(
            activityType: (dictionary["activityType"] as? String).flatMap(IOSBackgroundActivityType.init(fromString:)),
            pausesLocationUpdatesAutomatically: dictionary["pausesLocationUpdatesAutomatically"] as? Bool,
            showsBackgroundLocationIndicator: dictionary["showsBackgroundLocationIndicator"] as? Bool,
            useSignificantChanges: dictionary["useSignificantChanges"] as? Bool,
            deferredUpdatesDistance: dictionary["deferredUpdatesDistance"] as? Double,
            deferredUpdatesInterval: dictionary["deferredUpdatesInterval"] as? Double
        )
    }

    private func activityOptionsDictionary(_ options: ActivityRecognitionOptions) -> [String: Any] {
        var dictionary: [String: Any] = [:]
        dictionary["enabled"] = options.enabled
        dictionary["interval"] = options.interval
        dictionary["stopOnStill"] = options.stopOnStill
        dictionary["minimumConfidence"] = options.minimumConfidence
        return dictionary
    }

    private func makeActivityOptions(_ dictionary: [String: Any]) -> ActivityRecognitionOptions {
        return ActivityRecognitionOptions(
            enabled: dictionary["enabled"] as? Bool,
            interval: dictionary["interval"] as? Double,
            stopOnStill: dictionary["stopOnStill"] as? Bool,
            minimumConfidence: dictionary["minimumConfidence"] as? Double
        )
    }

    private func httpSyncOptionsDictionary(_ options: BackgroundHttpSyncOptions) -> [String: Any] {
        var dictionary: [String: Any] = [
            "url": options.url
        ]
        dictionary["method"] = options.method?.stringValue
        dictionary["headers"] = options.headers
        dictionary["batch"] = options.batch
        dictionary["batchSize"] = options.batchSize
        dictionary["syncThreshold"] = options.syncThreshold
        dictionary["syncInterval"] = options.syncInterval
        dictionary["retry"] = options.retry
        dictionary["maxRetries"] = options.maxRetries
        dictionary["bodyTemplate"] = options.bodyTemplate.map(metadataDictionary)
        dictionary["autoClear"] = options.autoClear
        return dictionary
    }

    private func makeHttpSyncOptions(_ dictionary: [String: Any]) -> BackgroundHttpSyncOptions? {
        guard let url = dictionary["url"] as? String else {
            return nil
        }
        return BackgroundHttpSyncOptions(
            url: url,
            method: (dictionary["method"] as? String).flatMap(BackgroundHttpMethod.init(fromString:)),
            headers: dictionary["headers"] as? [String: String],
            batch: dictionary["batch"] as? Bool,
            batchSize: dictionary["batchSize"] as? Double,
            syncThreshold: dictionary["syncThreshold"] as? Double,
            syncInterval: dictionary["syncInterval"] as? Double,
            retry: dictionary["retry"] as? Bool,
            maxRetries: dictionary["maxRetries"] as? Double,
            bodyTemplate: (dictionary["bodyTemplate"] as? [String: Any]).map(makeMetadata),
            autoClear: dictionary["autoClear"] as? Bool
        )
    }

    private func backgroundLocation(_ location: StoredBackgroundLocation) -> BackgroundLocation {
        return BackgroundLocation(
            id: location.id,
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
    }

    private func nullableDouble(_ value: Any?) -> NullableDouble? {
        guard let value = value as? Double else { return nil }
        return .second(value)
    }

    private func variantDouble(_ value: NullableDouble?) -> Double? {
        return value?.asType(Double.self)
    }

    private func metadataDictionary(
        _ metadata: [String: Variant_NullType_Bool_String_Double]
    ) -> [String: Any] {
        var dictionary: [String: Any] = [:]
        metadata.forEach { key, value in
            switch value {
            case .first:
                dictionary[key] = ["__nitroNull": true]
            case .second(let bool):
                dictionary[key] = bool
            case .third(let string):
                dictionary[key] = string
            case .fourth(let double):
                dictionary[key] = double
            }
        }
        return dictionary
    }

    private func bodyTemplateDictionary(
        _ metadata: [String: Variant_NullType_Bool_String_Double]
    ) -> [String: Any] {
        var dictionary: [String: Any] = [:]
        metadata.forEach { key, value in
            switch value {
            case .first:
                dictionary[key] = NSNull()
            case .second(let bool):
                dictionary[key] = bool
            case .third(let string):
                dictionary[key] = string
            case .fourth(let double):
                dictionary[key] = double
            }
        }
        return dictionary
    }

    private func makeMetadata(_ dictionary: [String: Any]) -> [String: Variant_NullType_Bool_String_Double] {
        var metadata: [String: Variant_NullType_Bool_String_Double] = [:]
        dictionary.forEach { key, value in
            switch value {
            case let nullMarker as [String: Any] where nullMarker["__nitroNull"] as? Bool == true:
                metadata[key] = .first(NullType.null)
            case let bool as Bool:
                metadata[key] = .second(bool)
            case let string as String:
                metadata[key] = .third(string)
            case let number as NSNumber:
                metadata[key] = .fourth(number.doubleValue)
            default:
                metadata[key] = .third(String(describing: value))
            }
        }
        return metadata
    }

    private func motionActivityType(_ activity: CMMotionActivity) -> DetectedActivityType {
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

    private func motionConfidence(_ confidence: CMMotionActivityConfidence) -> Double {
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

    private func mapActivityType(_ activityType: IOSBackgroundActivityType?) -> CLActivityType {
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

    private func permissionResult() -> BackgroundPermissionResult {
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
