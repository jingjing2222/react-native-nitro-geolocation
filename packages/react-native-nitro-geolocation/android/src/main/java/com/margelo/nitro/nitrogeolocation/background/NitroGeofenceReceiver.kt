package com.margelo.nitro.nitrogeolocation.background

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.google.android.gms.location.GeofencingEvent

class NitroGeofenceReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val event = GeofencingEvent.fromIntent(intent) ?: return
        if (event.hasError()) return
        val controller = NitroBackgroundLocationController.getInstance(context)
        controller.handleGeofenceEvent(
            event,
            intent.getLongExtra(EXTRA_RUN_GENERATION, MISSING_RUN_GENERATION)
        )
    }
}
