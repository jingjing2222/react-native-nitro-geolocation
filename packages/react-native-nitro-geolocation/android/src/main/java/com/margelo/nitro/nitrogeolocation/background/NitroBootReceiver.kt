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

        val prefs = context.applicationContext.getSharedPreferences(
            "nitro_background_location",
            Context.MODE_PRIVATE
        )
        val controller = NitroBackgroundLocationController.getInstance(context)
        runCatching { controller.registerPersistedGeofencesIfNeeded() }
        if (prefs.getBoolean("startOnBoot", false)) {
            runCatching { controller.start(null) }
        }
    }
}
