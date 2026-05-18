package com.margelo.nitro.nitrogeolocation.background

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class NitroActivityRecognitionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        NitroBackgroundLocationController
            .getInstance(context)
            .handleActivityRecognition(intent)
    }
}
