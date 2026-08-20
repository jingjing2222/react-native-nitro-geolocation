package com.margelo.nitro.nitrogeolocation.background

import android.content.SharedPreferences
import com.margelo.nitro.nitrogeolocation.BackgroundEventEnvelope
import com.margelo.nitro.nitrogeolocation.BackgroundEventType
import com.margelo.nitro.nitrogeolocation.LocationError
import java.util.UUID

internal class NitroBackgroundErrorState(
    private val prefs: SharedPreferences
) {
    @Volatile
    private var lastError: LocationError? = null

    @Synchronized
    fun store(code: Int, message: String): BackgroundEventEnvelope {
        val error = LocationError(code.toDouble(), message)
        lastError = error
        prefs.edit()
            .putInt("lastErrorCode", code)
            .putString("lastErrorMessage", message)
            .putLong("lastErrorAt", System.currentTimeMillis())
            .apply()
        return BackgroundEventEnvelope(
            null, null, null, null, null, error,
            UUID.randomUUID().toString(), BackgroundEventType.ERROR,
            System.currentTimeMillis().toDouble(), false
        )
    }

    @Synchronized
    fun clear() {
        lastError = null
        prefs.edit()
            .remove("lastErrorCode")
            .remove("lastErrorMessage")
            .remove("lastErrorAt")
            .apply()
    }

    @Synchronized
    fun current(): LocationError? {
        lastError?.let { return it }
        val message = prefs.getString("lastErrorMessage", null) ?: return null
        return LocationError(prefs.getInt("lastErrorCode", 0).toDouble(), message)
            .also { lastError = it }
    }
}
