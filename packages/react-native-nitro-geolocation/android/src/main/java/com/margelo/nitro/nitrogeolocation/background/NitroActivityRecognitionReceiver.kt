package com.margelo.nitro.nitrogeolocation.background

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class NitroActivityRecognitionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val controller = NitroBackgroundLocationController.getInstance(context)
        controller.handleActivityRecognition(
            intent,
            intent.getLongExtra(EXTRA_RUN_GENERATION, MISSING_RUN_GENERATION),
            intent.getLongExtra(
                EXTRA_REGISTRATION_GENERATION,
                MISSING_REGISTRATION_GENERATION
            )
        )
    }
}
