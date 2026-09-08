package com.margelo.nitro.nitrogeolocation.background

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import com.margelo.nitro.nitrogeolocation.AndroidForegroundServiceOptions

object NitroBackgroundNotificationFactory {
    fun create(
        context: Context,
        options: AndroidForegroundServiceOptions,
        serviceGeneration: Long
    ): Notification {
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

        val builder = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(icon)
            .setContentTitle(options.notificationTitle)
            .setContentText(options.notificationText)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
        options.notificationColor?.let { color ->
            runCatching { Color.parseColor(color) }.getOrNull()?.let(builder::setColor)
        }
        options.stopActionTitle?.takeIf { it.isNotBlank() }?.let { title ->
            val stopIntent = Intent(context, NitroBackgroundLocationService::class.java)
                .setAction(ACTION_STOP_BACKGROUND_LOCATION)
                .setData(Uri.parse(pendingIntentIdentityUri("stop", serviceGeneration)))
                .putExtra(EXTRA_SERVICE_GENERATION, serviceGeneration)
            val stopAction = PendingIntent.getService(
                context,
                1004,
                stopIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            builder.addAction(android.R.drawable.ic_menu_close_clear_cancel, title, stopAction)
        }
        return builder.build()
    }
}
