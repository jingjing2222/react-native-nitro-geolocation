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

        // registerPersistedGeofencesIfNeeded() blocks (waitForTask, up to 30s) and start() does
        // disk I/O; running them inline would block the broadcast's main thread and risk an ANR.
        // Hand off to a worker thread and keep the broadcast alive with goAsync() until it finishes.
        val appContext = context.applicationContext
        val pendingResult = goAsync()
        Thread {
            try {
                val prefs = appContext.getSharedPreferences(
                    "nitro_background_location",
                    Context.MODE_PRIVATE
                )
                val controller = NitroBackgroundLocationController.getInstance(appContext)
                runCatching { controller.registerPersistedGeofencesIfNeeded() }
                if (prefs.getBoolean("startOnBoot", false)) {
                    runCatching { controller.start(null) }
                }
            } finally {
                pendingResult.finish()
            }
        }.start()
    }
}
