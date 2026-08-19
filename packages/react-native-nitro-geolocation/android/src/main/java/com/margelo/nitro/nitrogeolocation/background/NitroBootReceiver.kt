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

        if (!NitroBootRestoreJobService.schedule(context.applicationContext)) {
            NitroGeoLog.e("Failed to schedule background restoration after boot")
        }
        val prefs = context.getSharedPreferences(
            BACKGROUND_LOCATION_PREFS,
            Context.MODE_PRIVATE
        )
        if (prefs.getBoolean("startOnBoot", false)) {
            runCatching {
                NitroBackgroundLocationController.getInstance(context.applicationContext)
                    .startFromBoot()
            }.onFailure { error ->
                NitroGeoLog.e("Failed to request background tracking after boot", error)
            }
        }
    }
}
