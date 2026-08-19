package com.margelo.nitro.nitrogeolocation.background

import android.content.SharedPreferences
import com.margelo.nitro.nitrogeolocation.*

internal const val BACKGROUND_LOCATION_PREFS = "nitro_background_location"

internal class NitroBackgroundConfigStore(private val prefs: SharedPreferences) {
    fun persist(options: BackgroundLocationOptions) {
        val service = options.android?.foregroundService
        prefs.edit()
            .putBoolean("configured", true)
            .putBoolean("running", prefs.getBoolean("running", false))
            .putBoolean("startOnBoot", options.startOnBoot == true)
            .putBoolean("stopOnTerminate", options.stopOnTerminate != false)
            .putString("trackingMode", options.trackingMode?.name)
            .putString("accuracyAndroid", options.accuracy?.android?.name)
            .putString("accuracyIos", options.accuracy?.ios?.name)
            .putString("granularity", options.granularity?.name)
            .putString("androidLocationProvider", options.android?.locationProvider?.name)
            .putBoolean(
                "androidRequestNotificationPermission",
                options.android?.requestNotificationPermission != false
            )
            .putBoolean(
                "androidRequestIgnoreBatteryOptimizations",
                options.android?.requestIgnoreBatteryOptimizations == true
            )
            .putFloat("interval", (options.interval ?: 10_000.0).toFloat())
            .putFloat("fastestInterval", (options.fastestInterval ?: 5_000.0).toFloat())
            .putFloat("distanceFilter", (options.distanceFilter ?: 0.0).toFloat())
            .putFloat("maxUpdateDelay", (options.maxUpdateDelay ?: 0.0).toFloat())
            .putBoolean("waitForAccurateLocation", options.waitForAccurateLocation == true)
            .putBoolean("persist", options.persist != false)
            .putFloat("maxStoredLocations", (options.maxStoredLocations ?: 0.0).toFloat())
            .putFloat("maxStoredEvents", (options.maxStoredEvents ?: 0.0).toFloat())
            .putBoolean("activityConfigured", options.activityRecognition != null)
            .putBoolean("activityEnabled", options.activityRecognition?.enabled == true)
            .putFloat("activityInterval", (options.activityRecognition?.interval ?: 10_000.0).toFloat())
            .putBoolean("activityStopOnStill", options.activityRecognition?.stopOnStill == true)
            .putFloat(
                "activityMinimumConfidence",
                (options.activityRecognition?.minimumConfidence ?: 0.0).toFloat()
            )
            .putFloat("notificationId", (service?.notificationId ?: 9471.0).toFloat())
            .putString("notificationTitle", service?.notificationTitle)
            .putString("notificationText", service?.notificationText)
            .putString("notificationChannelId", service?.notificationChannelId)
            .putString("notificationChannelName", service?.notificationChannelName)
            .putString("notificationChannelDescription", service?.notificationChannelDescription)
            .putString("notificationIcon", service?.notificationIcon)
            .putString("notificationColor", service?.notificationColor)
            .putString("stopActionTitle", service?.stopActionTitle)
            .putString("syncUrl", options.sync?.url)
            .putString("syncMethod", options.sync?.method?.name)
            .putString("syncHeaders", options.sync?.headers?.let(::stringMapToJson))
            .putString("syncBodyTemplate", options.sync?.bodyTemplate?.let(::variantMapToJson))
            .putBoolean("syncBatchConfigured", options.sync?.batch != null)
            .putFloat("syncBatchSize", (options.sync?.batchSize ?: 50.0).toFloat())
            .putFloat("syncThreshold", (options.sync?.syncThreshold ?: 1.0).toFloat())
            .putFloat("syncInterval", (options.sync?.syncInterval ?: 0.0).toFloat())
            .putBoolean("syncBatch", options.sync?.batch == true)
            .putBoolean("syncRetry", options.sync?.retry == true)
            .putFloat("syncMaxRetries", (options.sync?.maxRetries ?: 3.0).toFloat())
            .putBoolean("syncAutoClear", options.sync?.autoClear == true)
            .apply()
    }

    fun restore(): BackgroundLocationOptions? {
        if (!prefs.getBoolean("configured", false)) return null
        val title = prefs.getString("notificationTitle", null) ?: return null
        val text = prefs.getString("notificationText", null) ?: return null
        val service = AndroidForegroundServiceOptions(
            prefs.getFloat("notificationId", 9471f).toDouble(),
            title,
            text,
            prefs.getString("notificationChannelId", null),
            prefs.getString("notificationChannelName", null),
            prefs.getString("notificationChannelDescription", null),
            prefs.getString("notificationIcon", null),
            prefs.getString("notificationColor", null),
            prefs.getString("stopActionTitle", null)
        )
        val sync = prefs.getString("syncUrl", null)?.let { url ->
            BackgroundHttpSyncOptions(
                url,
                prefs.getString("syncMethod", null)?.let {
                    runCatching { enumValueOf<BackgroundHttpMethod>(it) }.getOrNull()
                },
                prefs.getString("syncHeaders", null)?.let(::jsonToStringMap),
                if (prefs.getBoolean("syncBatchConfigured", false)) {
                    prefs.getBoolean("syncBatch", false)
                } else null,
                prefs.getFloat("syncBatchSize", 50f).toDouble(),
                prefs.getFloat("syncThreshold", 1f).toDouble(),
                prefs.getFloat("syncInterval", 0f).toDouble(),
                prefs.getBoolean("syncRetry", false),
                prefs.getFloat("syncMaxRetries", 3f).toDouble(),
                prefs.getString("syncBodyTemplate", null)?.let(::jsonToVariantMap),
                prefs.getBoolean("syncAutoClear", false)
            )
        }
        val accuracyAndroid = prefs.getString("accuracyAndroid", null)?.let {
            runCatching { enumValueOf<AndroidAccuracyPreset>(it) }.getOrNull()
        }
        val accuracyIos = prefs.getString("accuracyIos", null)?.let {
            runCatching { enumValueOf<IOSAccuracyPreset>(it) }.getOrNull()
        }
        val accuracy = if (accuracyAndroid != null || accuracyIos != null) {
            LocationAccuracyOptions(accuracyAndroid, accuracyIos)
        } else null
        val activityRecognition = if (prefs.getBoolean("activityConfigured", false)) {
            ActivityRecognitionOptions(
                prefs.getBoolean("activityEnabled", false),
                prefs.getFloat("activityInterval", 10_000f).toDouble(),
                prefs.getBoolean("activityStopOnStill", false),
                prefs.getFloat("activityMinimumConfidence", 0f).toDouble()
            )
        } else null
        return BackgroundLocationOptions(
            prefs.getString("trackingMode", null)?.let {
                runCatching { enumValueOf<BackgroundTrackingMode>(it) }.getOrNull()
            },
            accuracy,
            prefs.getString("granularity", null)?.let {
                runCatching { enumValueOf<AndroidGranularity>(it) }.getOrNull()
            },
            prefs.getFloat("interval", 10_000f).toDouble(),
            prefs.getFloat("fastestInterval", 5_000f).toDouble(),
            prefs.getFloat("distanceFilter", 0f).toDouble(),
            prefs.getFloat("maxUpdateDelay", 0f).toDouble(),
            prefs.getBoolean("waitForAccurateLocation", false),
            prefs.getBoolean("persist", true),
            prefs.getFloat("maxStoredLocations", 0f).toDouble().takeIf { it > 0 },
            prefs.getFloat("maxStoredEvents", 0f).toDouble().takeIf { it > 0 },
            prefs.getBoolean("stopOnTerminate", true),
            prefs.getBoolean("startOnBoot", false),
            AndroidBackgroundLocationOptions(
                prefs.getString("androidLocationProvider", null)?.let {
                    runCatching { enumValueOf<AndroidBackgroundProvider>(it) }.getOrNull()
                } ?: AndroidBackgroundProvider.AUTO,
                service,
                prefs.getBoolean("androidRequestNotificationPermission", true),
                prefs.getBoolean("androidRequestIgnoreBatteryOptimizations", false)
            ),
            null,
            null,
            activityRecognition,
            sync
        )
    }
}
