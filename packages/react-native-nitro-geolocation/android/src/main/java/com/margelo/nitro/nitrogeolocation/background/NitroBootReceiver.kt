package com.margelo.nitro.nitrogeolocation.background

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class NitroBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (
            intent.action != Intent.ACTION_BOOT_COMPLETED &&
            intent.action != Intent.ACTION_LOCKED_BOOT_COMPLETED
        ) {
            return
        }

        val appContext = context.applicationContext
        runCatching {
            if (NitroBackgroundStore.hasPersistedGeofences(appContext) &&
                !NitroBootRestoreJobService.schedule(appContext)) {
                NitroGeoLog.e("Failed to schedule background restoration after boot")
            }
        }.onFailure { error ->
            NitroGeoLog.e("Failed to schedule background restoration after boot", error)
        }

        runCatching {
            val prefs = appContext.getSharedPreferences(BACKGROUND_LOCATION_PREFS, Context.MODE_PRIVATE)
            if (prefs.getBoolean("startOnBoot", false)) {
                NitroBackgroundLocationController.getInstance(appContext)
                    .startFromBoot()
            }
        }.onFailure { error ->
            NitroGeoLog.e("Failed to request background tracking after boot", error)
        }
    }
}
