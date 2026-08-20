package com.margelo.nitro.nitrogeolocation.background

import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.IBinder
import androidx.core.app.ServiceCompat

class NitroBackgroundLocationService : Service() {
    private var serviceGeneration: Long? = null
    private val controller by lazy {
        NitroBackgroundLocationController.getInstance(applicationContext)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val requestedGeneration = intent?.backgroundServiceGeneration()
        val foregroundService = intent?.backgroundNotificationOptions()
            ?: persistedBackgroundNotificationOptions(applicationContext)
            ?: fallbackBackgroundNotificationOptions()
        try {
            val notification = NitroBackgroundNotificationFactory.create(this, foregroundService)
            val notificationId = foregroundService.notificationId?.toInt() ?: 9471
            NitroGeoLog.d("Service.onStartCommand(): startForeground id=$notificationId type=location")
            ServiceCompat.startForeground(
                this,
                notificationId,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
            )
            NitroBackgroundServiceState.promoted()
        } catch (error: Exception) {
            NitroBackgroundServiceState.stopped()
            // Android 14+ rejects a "location" foreground service if location permission is not
            // held at start time (SecurityException), and Android 12+ rejects background starts
            // (ForegroundServiceStartNotAllowedException, an IllegalStateException). Record and stop
            // cleanly instead of letting the service crash.
            val failedGeneration = runCatching {
                resolveBackgroundServiceGeneration(
                    requestedGeneration,
                    controller.runningServiceGeneration()
                )
            }.getOrNull()
            failedGeneration?.let {
                controller.failStartup(
                    it,
                    ERROR_CODE_POSITION_UNAVAILABLE,
                    "Failed to start foreground location service: ${error.message}",
                    error
                )
            }
            stopSelf(startId)
            return START_NOT_STICKY
        }
        val activeGeneration = controller.runningServiceGeneration()
        val generation = resolveBackgroundServiceGeneration(requestedGeneration, activeGeneration)
        if (generation == null) {
            stopSelf(startId)
            return START_NOT_STICKY
        }
        if (generation != activeGeneration) {
            controller.failStartup(
                generation,
                ERROR_CODE_POSITION_UNAVAILABLE,
                "Foreground service start was superseded"
            )
            stopSelf(startId)
            return START_NOT_STICKY
        }
        val config = controller.getConfigOrNull()
        if (config == null) {
            controller.failStartup(
                generation,
                ERROR_CODE_POSITION_UNAVAILABLE,
                "Background location configuration is unavailable"
            )
            stopSelf(startId)
            return START_NOT_STICKY
        }
        controller.prepareRecoveredService(
            generation,
            requiresActivityRecognition(config)
        )
        controller.serviceForegroundDidPromote(generation)
        serviceGeneration = generation
        NitroGeoLog.d("Service.onStartCommand(): starting native location updates")
        try {
            controller.startNativeLocationUpdates(generation)
        } catch (error: Exception) {
            controller.failStartup(
                generation,
                ERROR_CODE_POSITION_UNAVAILABLE,
                "Failed to register native location updates: ${error.message}",
                error
            )
            stopSelf(startId)
            return START_NOT_STICKY
        }
        if (config.trackingMode == com.margelo.nitro.nitrogeolocation.BackgroundTrackingMode.ACTIVITYAWARE ||
            config.activityRecognition?.enabled == true) {
            try {
                controller.startActivityRecognition(config.activityRecognition, generation)
            } catch (error: Exception) {
                controller.failStartup(
                    generation,
                    ERROR_CODE_POSITION_UNAVAILABLE,
                    "Failed to start activity recognition: ${error.message}",
                    error
                )
                stopSelf(startId)
                return START_NOT_STICKY
            }
        }
        controller.registerPersistedGeofencesIfNeeded(generation)
        if (controller.activeServiceGeneration() != generation) {
            stopSelf(startId)
            return START_NOT_STICKY
        }
        return if (config.stopOnTerminate == false) START_STICKY else START_NOT_STICKY
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        val config = controller.getConfigOrNull()
        if (config?.stopOnTerminate != false) {
            serviceGeneration?.let(controller::stopFromService)
            stopSelf()
        }
        super.onTaskRemoved(rootIntent)
    }

    override fun onDestroy() {
        NitroBackgroundServiceState.stopped()
        serviceGeneration?.let {
            controller.stopNativeLocationUpdates(it)
            controller.stopActivityRecognition(it)
        }
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
