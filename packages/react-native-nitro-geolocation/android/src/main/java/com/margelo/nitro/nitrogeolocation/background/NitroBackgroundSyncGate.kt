package com.margelo.nitro.nitrogeolocation.background

import android.content.SharedPreferences

/** Reserves an automatic sync only while the scheduling provider still owns registration. */
internal class NitroBackgroundSyncGate(
    private val registrations: NitroBackgroundRegistrations,
    private val prefs: SharedPreferences
) {
    fun reserve(
        registrationGeneration: Long,
        serviceGeneration: Long,
        intervalMs: Long,
        nowMs: Long
    ): Boolean = registrations.withCurrentLocation(
        registrationGeneration,
        serviceGeneration
    ) {
        val lastSyncAt = prefs.getLong("lastSyncAt", 0L)
        if (intervalMs > 0L && nowMs - lastSyncAt < intervalMs) {
            false
        } else {
            prefs.edit().putLong("lastSyncAt", nowMs).apply()
            true
        }
    } == true
}
