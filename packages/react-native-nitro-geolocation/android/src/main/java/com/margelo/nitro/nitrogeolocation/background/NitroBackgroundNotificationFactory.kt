package com.margelo.nitro.nitrogeolocation.background

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat
import com.margelo.nitro.nitrogeolocation.AndroidForegroundServiceOptions

object NitroBackgroundNotificationFactory {
    fun create(context: Context, options: AndroidForegroundServiceOptions): Notification {
        val channelId = options.notificationChannelId ?: "nitro-background-location"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = context.getSystemService(NotificationManager::class.java)
            val channel = NotificationChannel(
                channelId,
                options.notificationChannelName ?: "Background Location",
                NotificationManager.IMPORTANCE_LOW
            )
            channel.description = options.notificationChannelDescription
            manager.createNotificationChannel(channel)
        }

        val icon = options.notificationIcon?.let { name ->
            context.resources.getIdentifier(name, "drawable", context.packageName)
        }?.takeIf { it != 0 } ?: android.R.drawable.ic_menu_mylocation

        return NotificationCompat.Builder(context, channelId)
            .setSmallIcon(icon)
            .setContentTitle(options.notificationTitle)
            .setContentText(options.notificationText)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }
}
