package com.margelo.nitro.nitrogeolocation.background

import android.content.SharedPreferences
import com.margelo.nitro.nitrogeolocation.BackgroundEventEnvelope
import com.margelo.nitro.nitrogeolocation.BackgroundEventType
import com.margelo.nitro.nitrogeolocation.LocationError
import com.margelo.nitro.nitrogeolocation.LocationErrorCode
import com.margelo.nitro.nitrogeolocation.locationErrorCodeFromLegacyValue
import com.margelo.nitro.nitrogeolocation.locationErrorCodeFromWireValue
import com.margelo.nitro.nitrogeolocation.locationErrorCodeToWireValue
import java.util.UUID

internal class NitroBackgroundErrorState(
    private val prefs: SharedPreferences
) {
    @Volatile
    private var lastError: LocationError? = null

    @Synchronized
    fun store(code: LocationErrorCode, message: String): BackgroundEventEnvelope {
        val error = LocationError(code, message)
        lastError = error
        prefs.edit()
            .remove("lastErrorCode")
            .putString("lastErrorCodeV2", locationErrorCodeToWireValue(code))
            .putString("lastErrorMessage", message)
            .putLong("lastErrorAt", System.currentTimeMillis())
            .apply()
        return BackgroundEventEnvelope(
            null, null, null, null, null, null, error,
            UUID.randomUUID().toString(), BackgroundEventType.ERROR,
            System.currentTimeMillis().toDouble(), false
        )
    }

    @Synchronized
    fun clear() {
        lastError = null
        prefs.edit()
            .remove("lastErrorCode")
            .remove("lastErrorCodeV2")
            .remove("lastErrorMessage")
            .remove("lastErrorAt")
            .apply()
    }

    @Synchronized
    fun current(): LocationError? {
        lastError?.let { return it }
        val message = prefs.getString("lastErrorMessage", null) ?: return null
        val code = prefs.getString("lastErrorCodeV2", null)
            ?.let(::locationErrorCodeFromWireValue)
            ?: locationErrorCodeFromLegacyValue(prefs.getInt("lastErrorCode", 0))
            ?: return null
        return LocationError(code, message).also { lastError = it }
    }
}
