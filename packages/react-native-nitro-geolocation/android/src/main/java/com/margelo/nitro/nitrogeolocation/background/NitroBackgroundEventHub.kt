package com.margelo.nitro.nitrogeolocation.background

import com.margelo.nitro.nitrogeolocation.BackgroundEventEnvelope
import com.margelo.nitro.nitrogeolocation.BackgroundEventType
import com.margelo.nitro.nitrogeolocation.BackgroundLocation
import com.margelo.nitro.nitrogeolocation.LocationError
import java.util.UUID

class NitroBackgroundEventHub {
    private val listenerLock = Any()
    private val eventListeners = mutableMapOf<String, (BackgroundEventEnvelope) -> Unit>()
    private val locationListeners = mutableMapOf<String, (BackgroundLocation) -> Unit>()
    private val errorListeners = mutableMapOf<String, (LocationError) -> Unit>()

    fun addEventListener(listener: (BackgroundEventEnvelope) -> Unit): String {
        val token = UUID.randomUUID().toString()
        synchronized(listenerLock) { eventListeners[token] = listener }
        return token
    }

    fun removeEventListener(token: String) {
        synchronized(listenerLock) { eventListeners.remove(token) }
    }

    fun addLocationListener(listener: (BackgroundLocation) -> Unit): String {
        val token = UUID.randomUUID().toString()
        synchronized(listenerLock) { locationListeners[token] = listener }
        return token
    }

    fun removeLocationListener(token: String) {
        synchronized(listenerLock) { locationListeners.remove(token) }
    }

    fun addErrorListener(listener: (LocationError) -> Unit): String {
        val token = UUID.randomUUID().toString()
        synchronized(listenerLock) { errorListeners[token] = listener }
        return token
    }

    fun removeErrorListener(token: String) {
        synchronized(listenerLock) { errorListeners.remove(token) }
    }

    fun emit(event: BackgroundEventEnvelope): Boolean {
        return synchronized(listenerLock) {
            var delivered = dispatchCurrent(eventListeners) { it(event) }

            when (event.type) {
                BackgroundEventType.LOCATION -> {
                    event.location?.let { location ->
                        delivered = dispatchCurrent(locationListeners) { it(location) } || delivered
                    }
                }
                BackgroundEventType.ERROR -> {
                    event.error?.let { error ->
                        delivered = dispatchCurrent(errorListeners) { it(error) } || delivered
                    }
                }
                else -> Unit
            }

            delivered
        }
    }

    private inline fun <T> dispatchCurrent(
        listeners: Map<String, T>,
        invoke: (T) -> Unit
    ): Boolean {
        var delivered = false
        listeners.keys.toList().forEach { token ->
            val listener = listeners[token] ?: return@forEach
            delivered = true
            dispatch { invoke(listener) }
        }
        return delivered
    }

    // Listeners run inline on the caller's thread (often the broadcast receiver thread). Isolate
    // each one so a single throwing listener cannot abort delivery to the remaining listeners.
    private inline fun dispatch(block: () -> Unit) {
        runCatching(block).onFailure { NitroGeoLog.w("background event listener threw", it) }
    }
}
