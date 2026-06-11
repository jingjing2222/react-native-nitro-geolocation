package com.margelo.nitro.nitrogeolocation.background

import android.app.Service
import android.content.Intent
import android.os.IBinder

class NitroBackgroundLocationService : Service() {
    private val controller by lazy {
        NitroBackgroundLocationController.getInstance(applicationContext)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val config = controller.requireConfig()
        val foregroundService = config.android?.foregroundService
            ?: throw IllegalStateException("Android foreground service options are required")
        val notification = NitroBackgroundNotificationFactory.create(this, foregroundService)
        NitroGeoLog.d("Service.onStartCommand(): startForeground id=${foregroundService.notificationId?.toInt() ?: 9471}")
        startForeground(
            foregroundService.notificationId?.toInt() ?: 9471,
            notification
        )
        NitroGeoLog.d("Service.onStartCommand(): starting native location updates")
        controller.startNativeLocationUpdates()
        if (config.trackingMode == com.margelo.nitro.nitrogeolocation.BackgroundTrackingMode.ACTIVITYAWARE ||
            config.activityRecognition?.enabled == true) {
            runCatching {
                controller.startActivityRecognition(config.activityRecognition)
            }.onFailure {
                controller.recordError("Failed to start activity recognition: ${it.message}", it)
            }
        }
        runCatching { controller.registerPersistedGeofencesIfNeeded() }
            .onFailure {
                controller.recordError("Failed to register persisted geofences: ${it.message}", it)
            }
        return if (config.stopOnTerminate == false) START_STICKY else START_NOT_STICKY
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        val config = controller.getConfigOrNull()
        if (config?.stopOnTerminate != false) {
            controller.stop()
            stopSelf()
        }
        super.onTaskRemoved(rootIntent)
    }

    override fun onDestroy() {
        controller.stopNativeLocationUpdates()
        controller.stopActivityRecognition()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
