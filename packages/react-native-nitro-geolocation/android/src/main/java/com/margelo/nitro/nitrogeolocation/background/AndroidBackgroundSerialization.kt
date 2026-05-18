package com.margelo.nitro.nitrogeolocation.background

import android.location.LocationManager
import com.google.android.gms.location.Geofence
import com.google.android.gms.location.GeofencingRequest
import com.google.android.gms.location.DetectedActivity as GmsDetectedActivity
import com.margelo.nitro.core.NullType
import com.margelo.nitro.nitrogeolocation.*
import org.json.JSONArray
import org.json.JSONObject

internal fun backgroundProviderFrom(provider: String?): LocationProviderUsed {
    return when (provider) {
        LocationManager.GPS_PROVIDER -> LocationProviderUsed.GPS
        LocationManager.NETWORK_PROVIDER -> LocationProviderUsed.NETWORK
        LocationManager.PASSIVE_PROVIDER -> LocationProviderUsed.PASSIVE
        "fused" -> LocationProviderUsed.FUSED
        else -> LocationProviderUsed.UNKNOWN
    }
}

internal fun BackgroundEventEnvelope.toJson(): JSONObject {
    return JSONObject()
        .put("id", id)
        .put("type", type.jsValue())
        .put("timestamp", timestamp)
        .put("deliveredToJS", deliveredToJS)
        .apply {
            location?.let { put("location", it.toJson()) }
            geofence?.let { put("geofence", it.toJson()) }
            activity?.let { put("activity", it.toJson()) }
            result?.let { put("result", it.toJson()) }
        }
}

internal fun BackgroundHttpSyncResult.toJson(): JSONObject {
    return JSONObject()
        .put("success", success)
        .put("statusCode", statusCode)
        .put("syncedLocationIds", JSONArray(syncedLocationIds.toList()))
        .put("failedLocationIds", JSONArray(failedLocationIds.toList()))
        .put("error", error)
}

internal fun DetectedActivity.toJson(): JSONObject {
    return JSONObject()
        .put("type", type.jsValue())
        .put("confidence", confidence)
        .put("timestamp", timestamp)
}

internal fun StoredBackgroundLocation.toJson(): JSONObject {
    return JSONObject()
        .put("id", id)
        .put("deliveredToJS", deliveredToJS)
        .put("synced", synced)
        .put("createdAt", createdAt)
        .put("source", source.jsValue())
        .put("isFromBackground", isFromBackground)
        .put("provider", provider?.jsValue())
        .put("mocked", mocked)
        .put("recordedAt", recordedAt)
        .put("coords", coords.toJson())
        .put("timestamp", timestamp)
}

internal fun BackgroundLocation.toJson(): JSONObject {
    return JSONObject()
        .put("id", id)
        .put("source", source.jsValue())
        .put("isFromBackground", isFromBackground)
        .put("provider", provider?.jsValue())
        .put("mocked", mocked)
        .put("recordedAt", recordedAt)
        .put("coords", coords.toJson())
        .put("timestamp", timestamp)
}

internal fun GeolocationCoordinates.toJson(): JSONObject {
    return JSONObject()
        .put("latitude", latitude)
        .put("longitude", longitude)
        .put("altitude", altitude?.asSecondOrNull())
        .put("accuracy", accuracy)
        .put("altitudeAccuracy", altitudeAccuracy?.asSecondOrNull())
        .put("heading", heading?.asSecondOrNull())
        .put("speed", speed?.asSecondOrNull())
}

internal fun GeofenceEvent.toJson(): JSONObject {
    return JSONObject()
        .put("region", region.toJson())
        .put("transition", transition.jsValue())
        .put("timestamp", timestamp)
}

internal fun GeofenceRegion.toJson(): JSONObject {
    return JSONObject()
        .put("identifier", identifier)
        .put("latitude", latitude)
        .put("longitude", longitude)
        .put("radius", radius)
        .put("notifyOnEntry", notifyOnEntry)
        .put("notifyOnExit", notifyOnExit)
        .put("notifyOnDwell", notifyOnDwell)
        .put("loiteringDelay", loiteringDelay)
        .put("expirationDuration", expirationDuration)
        .put("metadata", metadataToJsonObject(metadata))
}

internal fun metadataToJsonObject(
    metadata: Map<String, Variant_NullType_Boolean_String_Double>?
): JSONObject? {
    metadata ?: return null
    val json = JSONObject()
    metadata.forEach { (key, value) ->
        when (value) {
            is Variant_NullType_Boolean_String_Double.First -> json.put(key, JSONObject.NULL)
            is Variant_NullType_Boolean_String_Double.Second -> json.put(key, value.value)
            is Variant_NullType_Boolean_String_Double.Third -> json.put(key, value.value)
            is Variant_NullType_Boolean_String_Double.Fourth -> json.put(key, value.value)
        }
    }
    return json
}

internal fun stringMapToJson(map: Map<String, String>): String {
    val json = JSONObject()
    map.forEach { (key, value) -> json.put(key, value) }
    return json.toString()
}

internal fun jsonToStringMap(payload: String): Map<String, String> {
    val json = JSONObject(payload)
    val map = mutableMapOf<String, String>()
    val keys = json.keys()
    while (keys.hasNext()) {
        val key = keys.next()
        map[key] = json.getString(key)
    }
    return map
}

internal fun variantMapToJson(map: Map<String, Variant_NullType_Boolean_String_Double>): String {
    return metadataToJsonObject(map)?.toString() ?: "{}"
}

internal fun jsonToVariantMap(payload: String): Map<String, Variant_NullType_Boolean_String_Double> {
    val json = JSONObject(payload)
    val map = mutableMapOf<String, Variant_NullType_Boolean_String_Double>()
    val keys = json.keys()
    while (keys.hasNext()) {
        val key = keys.next()
        map[key] = when (val value = json.get(key)) {
            JSONObject.NULL -> Variant_NullType_Boolean_String_Double.create(NullType.NULL)
            is Boolean -> Variant_NullType_Boolean_String_Double.create(value)
            is String -> Variant_NullType_Boolean_String_Double.create(value)
            is Number -> Variant_NullType_Boolean_String_Double.create(value.toDouble())
            else -> Variant_NullType_Boolean_String_Double.create(value.toString())
        }
    }
    return map
}

internal fun BackgroundHttpSyncOptions.batchBody(locations: Array<StoredBackgroundLocation>): JSONObject {
    val body = metadataToJsonObject(bodyTemplate) ?: JSONObject()
    body.put("locations", JSONArray(locations.map { it.toJson() }))
    return body
}

internal fun BackgroundHttpSyncOptions.singleBody(location: StoredBackgroundLocation): JSONObject {
    val body = metadataToJsonObject(bodyTemplate)
    if (body != null) {
        body.put("location", location.toJson())
        return body
    }
    return location.toJson()
}

internal fun BackgroundEventType.jsValue(): String {
    return when (this) {
        BackgroundEventType.LOCATION -> "location"
        BackgroundEventType.GEOFENCE -> "geofence"
        BackgroundEventType.ACTIVITY -> "activity"
        BackgroundEventType.PROVIDERCHANGE -> "providerChange"
        BackgroundEventType.HTTPSYNC -> "httpSync"
        BackgroundEventType.ERROR -> "error"
    }
}

internal fun BackgroundLocationSource.jsValue(): String {
    return when (this) {
        BackgroundLocationSource.FOREGROUNDSERVICE -> "foregroundService"
        BackgroundLocationSource.BACKGROUND -> "background"
        BackgroundLocationSource.SIGNIFICANTCHANGE -> "significantChange"
        BackgroundLocationSource.GEOFENCE -> "geofence"
        BackgroundLocationSource.DEFERRED -> "deferred"
        BackgroundLocationSource.MANUAL -> "manual"
        BackgroundLocationSource.UNKNOWN -> "unknown"
    }
}

internal fun LocationProviderUsed.jsValue(): String {
    return when (this) {
        LocationProviderUsed.GPS -> "gps"
        LocationProviderUsed.NETWORK -> "network"
        LocationProviderUsed.PASSIVE -> "passive"
        LocationProviderUsed.FUSED -> "fused"
        LocationProviderUsed.UNKNOWN -> "unknown"
    }
}

internal fun GeofenceTransition.jsValue(): String {
    return when (this) {
        GeofenceTransition.ENTER -> "enter"
        GeofenceTransition.EXIT -> "exit"
        GeofenceTransition.DWELL -> "dwell"
    }
}

internal fun DetectedActivityType.jsValue(): String {
    return when (this) {
        DetectedActivityType.STILL -> "still"
        DetectedActivityType.WALKING -> "walking"
        DetectedActivityType.RUNNING -> "running"
        DetectedActivityType.ONFOOT -> "onFoot"
        DetectedActivityType.ONBICYCLE -> "onBicycle"
        DetectedActivityType.INVEHICLE -> "inVehicle"
        DetectedActivityType.TILTING -> "tilting"
        DetectedActivityType.UNKNOWN -> "unknown"
    }
}

internal fun GmsDetectedActivity.toNitroActivityType(): DetectedActivityType {
    return when (type) {
        GmsDetectedActivity.STILL -> DetectedActivityType.STILL
        GmsDetectedActivity.WALKING -> DetectedActivityType.WALKING
        GmsDetectedActivity.RUNNING -> DetectedActivityType.RUNNING
        GmsDetectedActivity.ON_FOOT -> DetectedActivityType.ONFOOT
        GmsDetectedActivity.ON_BICYCLE -> DetectedActivityType.ONBICYCLE
        GmsDetectedActivity.IN_VEHICLE -> DetectedActivityType.INVEHICLE
        GmsDetectedActivity.TILTING -> DetectedActivityType.TILTING
        else -> DetectedActivityType.UNKNOWN
    }
}

internal fun GeofenceRegion.toTransitionTypes(): Int {
    var transitions = 0
    if (notifyOnEntry != false) transitions = transitions or Geofence.GEOFENCE_TRANSITION_ENTER
    if (notifyOnExit != false) transitions = transitions or Geofence.GEOFENCE_TRANSITION_EXIT
    if (notifyOnDwell == true) transitions = transitions or Geofence.GEOFENCE_TRANSITION_DWELL
    return transitions
}

internal fun GeofencingOptions?.toInitialTrigger(): Int {
    val triggers = this?.initialTrigger ?: return 0
    var value = 0
    for (trigger in triggers) {
        value = value or when (trigger) {
            GeofenceTransition.ENTER -> GeofencingRequest.INITIAL_TRIGGER_ENTER
            GeofenceTransition.EXIT -> GeofencingRequest.INITIAL_TRIGGER_EXIT
            GeofenceTransition.DWELL -> GeofencingRequest.INITIAL_TRIGGER_DWELL
        }
    }
    return value
}
