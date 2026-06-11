package com.margelo.nitro.nitrogeolocation.background

import com.margelo.nitro.nitrogeolocation.BackgroundEventEnvelope
import com.margelo.nitro.nitrogeolocation.BackgroundEventType
import com.margelo.nitro.nitrogeolocation.BackgroundLocation
import com.margelo.nitro.nitrogeolocation.LocationError
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

class NitroBackgroundEventHub {
    private val eventListeners =
        ConcurrentHashMap<String, (BackgroundEventEnvelope) -> Unit>()
    private val locationListeners =
        ConcurrentHashMap<String, (BackgroundLocation) -> Unit>()
    private val errorListeners =
        ConcurrentHashMap<String, (LocationError) -> Unit>()

    fun addEventListener(listener: (BackgroundEventEnvelope) -> Unit): String {
        val token = UUID.randomUUID().toString()
        eventListeners[token] = listener
        return token
    }

    fun removeEventListener(token: String) {
        eventListeners.remove(token)
    }

    fun addLocationListener(listener: (BackgroundLocation) -> Unit): String {
        val token = UUID.randomUUID().toString()
        locationListeners[token] = listener
        return token
    }

    fun removeLocationListener(token: String) {
        locationListeners.remove(token)
    }

    fun addErrorListener(listener: (LocationError) -> Unit): String {
        val token = UUID.randomUUID().toString()
        errorListeners[token] = listener
        return token
    }

    fun removeErrorListener(token: String) {
        errorListeners.remove(token)
    }

    fun emit(event: BackgroundEventEnvelope) {
        eventListeners.values.forEach { listener -> dispatch { listener(event) } }

        when (event.type) {
            BackgroundEventType.LOCATION -> {
                event.location?.let { location ->
                    locationListeners.values.forEach { listener -> dispatch { listener(location) } }
                }
            }
            BackgroundEventType.ERROR -> {
                event.error?.let { error ->
                    errorListeners.values.forEach { listener -> dispatch { listener(error) } }
                }
            }
            else -> Unit
        }
    }

    // Listeners run inline on the caller's thread (often the broadcast receiver thread). Isolate
    // each one so a single throwing listener cannot abort delivery to the remaining listeners.
    private inline fun dispatch(block: () -> Unit) {
        runCatching(block).onFailure { NitroGeoLog.w("background event listener threw", it) }
    }
}
