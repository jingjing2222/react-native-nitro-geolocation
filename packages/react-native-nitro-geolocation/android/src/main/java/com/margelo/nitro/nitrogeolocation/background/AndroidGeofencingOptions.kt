package com.margelo.nitro.nitrogeolocation.background

import com.margelo.nitro.nitrogeolocation.GeofenceTransition
import com.margelo.nitro.nitrogeolocation.GeofencingOptions
import org.json.JSONArray
import org.json.JSONObject

internal fun resolveGeofencingOptions(
    defaults: GeofencingOptions?, overrides: GeofencingOptions?
): GeofencingOptions? = if (defaults == null && overrides == null) null else GeofencingOptions(
    overrides?.initialTrigger ?: defaults?.initialTrigger,
    overrides?.notificationResponsiveness ?: defaults?.notificationResponsiveness
)

internal fun geofencingOptionsJson(options: GeofencingOptions): String = JSONObject().apply {
    options.initialTrigger?.let { put("initialTrigger", JSONArray(it.map { transition -> transition.name })) }
    options.notificationResponsiveness?.let { put("notificationResponsiveness", it) }
}.toString()

internal fun geofencingOptionsFromJson(value: String): GeofencingOptions? = runCatching {
    val json = JSONObject(value)
    val triggers = json.optJSONArray("initialTrigger")?.let { array ->
        (0 until array.length()).map { GeofenceTransition.valueOf(array.getString(it)) }.toTypedArray()
    }
    GeofencingOptions(triggers, if (json.has("notificationResponsiveness")) {
        json.getDouble("notificationResponsiveness")
    } else null)
}.getOrNull()
