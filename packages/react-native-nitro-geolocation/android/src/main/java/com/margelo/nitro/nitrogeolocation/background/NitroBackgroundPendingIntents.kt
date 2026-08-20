package com.margelo.nitro.nitrogeolocation.background

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build

internal const val EXTRA_RUN_GENERATION =
    "com.margelo.nitro.nitrogeolocation.background.RUN_GENERATION"
internal const val MISSING_RUN_GENERATION = Long.MIN_VALUE
internal const val EXTRA_REGISTRATION_GENERATION =
    "com.margelo.nitro.nitrogeolocation.background.REGISTRATION_GENERATION"
internal const val MISSING_REGISTRATION_GENERATION = Long.MIN_VALUE
internal const val EXTRA_SERVICE_GENERATION =
    "com.margelo.nitro.nitrogeolocation.background.SERVICE_GENERATION"

private const val ACTION_LOCATION_UPDATE =
    "com.margelo.nitro.nitrogeolocation.background.LOCATION_UPDATE"
private const val ACTION_GEOFENCE_UPDATE =
    "com.margelo.nitro.nitrogeolocation.background.GEOFENCE_UPDATE"
private const val ACTION_ACTIVITY_UPDATE =
    "com.margelo.nitro.nitrogeolocation.background.ACTIVITY_UPDATE"

internal fun pendingIntentIdentityUri(kind: String, generation: Long): String =
    "nitro-geolocation://background/$kind/$generation"

internal class NitroBackgroundPendingIntents(private val context: Context) {
    fun location(runGeneration: Long, registrationGeneration: Long): PendingIntent = create(
        NitroLocationUpdateReceiver::class.java,
        ACTION_LOCATION_UPDATE,
        "location",
        1001,
        runGeneration,
        registrationGeneration
    )

    fun geofence(runGeneration: Long): PendingIntent = create(
        NitroGeofenceReceiver::class.java,
        ACTION_GEOFENCE_UPDATE,
        "geofence",
        1002,
        runGeneration,
        null
    )

    fun activity(runGeneration: Long, registrationGeneration: Long): PendingIntent = create(
        NitroActivityRecognitionReceiver::class.java,
        ACTION_ACTIVITY_UPDATE,
        "activity",
        1003,
        runGeneration,
        registrationGeneration
    )

    fun legacyLocation(): PendingIntent? = legacy(
        NitroLocationUpdateReceiver::class.java,
        ACTION_LOCATION_UPDATE,
        1001
    )

    fun legacyGeofence(): PendingIntent? = legacy(
        NitroGeofenceReceiver::class.java,
        ACTION_GEOFENCE_UPDATE,
        1002
    )

    fun legacyActivity(): PendingIntent? = legacy(
        NitroActivityRecognitionReceiver::class.java,
        ACTION_ACTIVITY_UPDATE,
        1003
    )

    private fun create(
        receiver: Class<out BroadcastReceiver>,
        action: String,
        kind: String,
        requestCode: Int,
        runGeneration: Long,
        registrationGeneration: Long?
    ): PendingIntent {
        val identityGeneration = registrationGeneration ?: runGeneration
        val intent = Intent(context, receiver)
            .setAction(action)
            .setData(Uri.parse(pendingIntentIdentityUri(kind, identityGeneration)))
            .putExtra(EXTRA_RUN_GENERATION, runGeneration)
        registrationGeneration?.let {
            intent.putExtra(EXTRA_REGISTRATION_GENERATION, it)
        }
        return PendingIntent.getBroadcast(
            context,
            requestCode,
            intent,
            mutablePendingIntentFlags(Build.VERSION.SDK_INT)
        )
    }

    private fun legacy(
        receiver: Class<out BroadcastReceiver>,
        action: String,
        requestCode: Int
    ): PendingIntent? {
        val intent = Intent(context, receiver).setAction(action)
        val flags = PendingIntent.FLAG_NO_CREATE or
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0
        return PendingIntent.getBroadcast(context, requestCode, intent, flags)
    }
}
