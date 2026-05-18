import Foundation
import NitroModules

internal func makeStoredLocation(_ dictionary: [String: Any]) -> StoredBackgroundLocation? {
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

internal func makeStoredEvent(
    _ dictionary: [String: Any],
    storedLocations: [StoredBackgroundLocation] = []
) -> StoredBackgroundEventEnvelope? {
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

internal func makeBackgroundLocation(_ dictionary: [String: Any]) -> BackgroundLocation? {
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

internal func makeActivity(_ dictionary: [String: Any]) -> DetectedActivity? {
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

internal func makeCoordinates(_ dictionary: [String: Any]) -> GeolocationCoordinates? {
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

internal func makeGeofenceRegion(_ dictionary: [String: Any]) -> GeofenceRegion? {
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

internal func sanitizedGeofence(_ region: GeofenceRegion) -> GeofenceRegion {
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

internal func bridgeSafeGeofence(_ region: GeofenceRegion) -> GeofenceRegion {
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

internal func makeGeofenceEvent(_ dictionary: [String: Any]) -> GeofenceEvent? {
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

internal func storedLocationDictionary(_ location: StoredBackgroundLocation) -> [String: Any] {
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

internal func storedEventDictionary(_ event: StoredBackgroundEventEnvelope) -> [String: Any] {
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

internal func backgroundLocationDictionary(_ location: BackgroundLocation) -> [String: Any]? {
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

internal func coordinatesDictionary(_ coords: GeolocationCoordinates) -> [String: Any] {
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

internal func geofenceDictionary(_ region: GeofenceRegion) -> [String: Any] {
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

internal func geofenceDictionary(_ event: GeofenceEvent) -> [String: Any] {
    return [
        "region": geofenceDictionary(event.region),
        "transition": event.transition.stringValue,
        "timestamp": event.timestamp
    ]
}

internal func activityDictionary(_ activity: DetectedActivity) -> [String: Any] {
    return [
        "type": activity.type.stringValue,
        "confidence": activity.confidence,
        "timestamp": activity.timestamp
    ]
}

internal func makeHttpSyncResult(_ dictionary: [String: Any]) -> BackgroundHttpSyncResult? {
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

internal func httpSyncResultDictionary(_ result: BackgroundHttpSyncResult) -> [String: Any] {
    var dictionary: [String: Any] = [
        "success": result.success,
        "syncedLocationIds": result.syncedLocationIds,
        "failedLocationIds": result.failedLocationIds
    ]
    dictionary["statusCode"] = result.statusCode
    dictionary["error"] = result.error
    return dictionary
}

internal func backgroundOptionsDictionary(_ options: BackgroundLocationOptions) -> [String: Any] {
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

internal func makeBackgroundOptions(_ dictionary: [String: Any]) -> BackgroundLocationOptions {
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

internal func iosOptionsDictionary(_ options: IOSBackgroundLocationOptions) -> [String: Any] {
    var dictionary: [String: Any] = [:]
    dictionary["activityType"] = options.activityType?.stringValue
    dictionary["pausesLocationUpdatesAutomatically"] = options.pausesLocationUpdatesAutomatically
    dictionary["showsBackgroundLocationIndicator"] = options.showsBackgroundLocationIndicator
    dictionary["useSignificantChanges"] = options.useSignificantChanges
    dictionary["deferredUpdatesDistance"] = options.deferredUpdatesDistance
    dictionary["deferredUpdatesInterval"] = options.deferredUpdatesInterval
    return dictionary
}

internal func makeIOSOptions(_ dictionary: [String: Any]) -> IOSBackgroundLocationOptions {
    return IOSBackgroundLocationOptions(
        activityType: (dictionary["activityType"] as? String).flatMap(IOSBackgroundActivityType.init(fromString:)),
        pausesLocationUpdatesAutomatically: dictionary["pausesLocationUpdatesAutomatically"] as? Bool,
        showsBackgroundLocationIndicator: dictionary["showsBackgroundLocationIndicator"] as? Bool,
        useSignificantChanges: dictionary["useSignificantChanges"] as? Bool,
        deferredUpdatesDistance: dictionary["deferredUpdatesDistance"] as? Double,
        deferredUpdatesInterval: dictionary["deferredUpdatesInterval"] as? Double
    )
}

internal func activityOptionsDictionary(_ options: ActivityRecognitionOptions) -> [String: Any] {
    var dictionary: [String: Any] = [:]
    dictionary["enabled"] = options.enabled
    dictionary["interval"] = options.interval
    dictionary["stopOnStill"] = options.stopOnStill
    dictionary["minimumConfidence"] = options.minimumConfidence
    return dictionary
}

internal func makeActivityOptions(_ dictionary: [String: Any]) -> ActivityRecognitionOptions {
    return ActivityRecognitionOptions(
        enabled: dictionary["enabled"] as? Bool,
        interval: dictionary["interval"] as? Double,
        stopOnStill: dictionary["stopOnStill"] as? Bool,
        minimumConfidence: dictionary["minimumConfidence"] as? Double
    )
}

internal func httpSyncOptionsDictionary(_ options: BackgroundHttpSyncOptions) -> [String: Any] {
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

internal func makeHttpSyncOptions(_ dictionary: [String: Any]) -> BackgroundHttpSyncOptions? {
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

internal func backgroundLocation(_ location: StoredBackgroundLocation) -> BackgroundLocation {
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

internal func nullableDouble(_ value: Any?) -> NullableDouble? {
    guard let value = value as? Double else { return nil }
    return .second(value)
}

internal func variantDouble(_ value: NullableDouble?) -> Double? {
    return value?.asType(Double.self)
}

internal func metadataDictionary(
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

internal func bodyTemplateDictionary(
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

internal func makeMetadata(_ dictionary: [String: Any]) -> [String: Variant_NullType_Bool_String_Double] {
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
