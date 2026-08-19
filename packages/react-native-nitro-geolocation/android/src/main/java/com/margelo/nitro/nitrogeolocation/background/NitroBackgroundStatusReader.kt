package com.margelo.nitro.nitrogeolocation.background

import android.content.Context
import android.content.SharedPreferences
import android.location.LocationManager
import com.margelo.nitro.nitrogeolocation.AndroidBackgroundLocationStatus
import com.margelo.nitro.nitrogeolocation.BackgroundLocationState
import com.margelo.nitro.nitrogeolocation.BackgroundLocationStatus
import com.margelo.nitro.nitrogeolocation.LocationError

internal fun readBackgroundLocationStatus(
    context: Context,
    prefs: SharedPreferences,
    store: NitroBackgroundStore,
    permissions: AndroidBackgroundPermissions,
    state: BackgroundLocationState,
    hasInMemoryConfig: Boolean,
    lastError: LocationError?
): BackgroundLocationStatus {
    val providerEnabled = runCatching {
        val manager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
        manager.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
            manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
    }.getOrDefault(false)
    val storeSnapshot = store.snapshot()
    val running = prefs.getBoolean("running", false)

    return BackgroundLocationStatus(
        state,
        running,
        hasInMemoryConfig || prefs.getBoolean("configured", false),
        permissions.foregroundPermission(),
        permissions.backgroundPermission(),
        permissions.accuracyAuthorization(),
        providerEnabled,
        null,
        storeSnapshot.storedLocationCount,
        storeSnapshot.storedEventCount,
        storeSnapshot.lastLocationAt,
        storeSnapshot.lastEventAt,
        storeSnapshot.geofenceCount,
        AndroidBackgroundLocationStatus(
            NitroBackgroundServiceState.isForeground,
            null,
            permissions.notificationPermission()
        ),
        null,
        lastError
    )
}
