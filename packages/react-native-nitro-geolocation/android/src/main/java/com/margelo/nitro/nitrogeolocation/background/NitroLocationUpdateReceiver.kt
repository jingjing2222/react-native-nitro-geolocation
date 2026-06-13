package com.margelo.nitro.nitrogeolocation.background

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.location.Location
import android.location.LocationManager
import android.os.Build
import com.google.android.gms.location.LocationResult
import com.margelo.nitro.nitrogeolocation.BackgroundLocationSource

class NitroLocationUpdateReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        NitroGeoLog.d("LocationUpdateReceiver.onReceive(): action=${intent.action}")
        val controller = NitroBackgroundLocationController.getInstance(context)
        val platformLocation = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableExtra(LocationManager.KEY_LOCATION_CHANGED, Location::class.java)
        } else {
            @Suppress("DEPRECATION")
            intent.getParcelableExtra(LocationManager.KEY_LOCATION_CHANGED) as? Location
        }
        if (platformLocation != null) {
            controller.handleNativeLocation(
                platformLocation,
                BackgroundLocationSource.FOREGROUNDSERVICE
            )
            return
        }

        val result = LocationResult.extractResult(intent)
        if (result == null) {
            NitroGeoLog.w(
                "LocationUpdateReceiver.onReceive(): broadcast carried no location " +
                    "(KEY_LOCATION_CHANGED and LocationResult both null) — dropping. " +
                    "On Android 12+ this usually means the broadcast PendingIntent was built " +
                    "with FLAG_IMMUTABLE, so the OS could not inject the LocationResult extras."
            )
            return
        }
        for (location in result.locations) {
            controller.handleNativeLocation(
                location,
                BackgroundLocationSource.FOREGROUNDSERVICE
            )
        }
    }
}
