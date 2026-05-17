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

        val result = LocationResult.extractResult(intent) ?: return
        for (location in result.locations) {
            controller.handleNativeLocation(
                location,
                BackgroundLocationSource.FOREGROUNDSERVICE
            )
        }
    }
}
