package com.margelo.nitro.nitrogeolocation.background

import android.content.Context
import android.content.Intent
import com.margelo.nitro.nitrogeolocation.AndroidForegroundServiceOptions

private const val EXTRA_NOTIFICATION_ID = "nitro.background.notificationId"
private const val EXTRA_NOTIFICATION_TITLE = "nitro.background.notificationTitle"
private const val EXTRA_NOTIFICATION_TEXT = "nitro.background.notificationText"
private const val EXTRA_NOTIFICATION_CHANNEL_ID = "nitro.background.notificationChannelId"
private const val EXTRA_NOTIFICATION_CHANNEL_NAME = "nitro.background.notificationChannelName"
private const val EXTRA_NOTIFICATION_CHANNEL_DESCRIPTION = "nitro.background.notificationChannelDescription"
private const val EXTRA_NOTIFICATION_ICON = "nitro.background.notificationIcon"
private const val EXTRA_NOTIFICATION_COLOR = "nitro.background.notificationColor"
private const val EXTRA_STOP_ACTION_TITLE = "nitro.background.stopActionTitle"

internal fun backgroundServiceIntent(
    context: Context,
    serviceGeneration: Long,
    options: AndroidForegroundServiceOptions
): Intent = Intent(context, NitroBackgroundLocationService::class.java)
    .putExtra(EXTRA_SERVICE_GENERATION, serviceGeneration)
    .apply {
        options.notificationId?.let { putExtra(EXTRA_NOTIFICATION_ID, it) }
        putExtra(EXTRA_NOTIFICATION_TITLE, options.notificationTitle)
        putExtra(EXTRA_NOTIFICATION_TEXT, options.notificationText)
        putExtra(EXTRA_NOTIFICATION_CHANNEL_ID, options.notificationChannelId)
        putExtra(EXTRA_NOTIFICATION_CHANNEL_NAME, options.notificationChannelName)
        putExtra(EXTRA_NOTIFICATION_CHANNEL_DESCRIPTION, options.notificationChannelDescription)
        putExtra(EXTRA_NOTIFICATION_ICON, options.notificationIcon)
        putExtra(EXTRA_NOTIFICATION_COLOR, options.notificationColor)
        putExtra(EXTRA_STOP_ACTION_TITLE, options.stopActionTitle)
    }

internal fun Intent.backgroundServiceGeneration(): Long? = takeIf {
    it.hasExtra(EXTRA_SERVICE_GENERATION)
}?.getLongExtra(EXTRA_SERVICE_GENERATION, MISSING_RUN_GENERATION)

internal fun resolveBackgroundServiceGeneration(
    requestedGeneration: Long?,
    durableRunningGeneration: Long?
): Long? = requestedGeneration ?: durableRunningGeneration

internal fun Intent.backgroundNotificationOptions(): AndroidForegroundServiceOptions? {
    val title = getStringExtra(EXTRA_NOTIFICATION_TITLE) ?: return null
    val text = getStringExtra(EXTRA_NOTIFICATION_TEXT) ?: return null
    return AndroidForegroundServiceOptions(
        takeIf { hasExtra(EXTRA_NOTIFICATION_ID) }?.getDoubleExtra(EXTRA_NOTIFICATION_ID, 0.0),
        title,
        text,
        getStringExtra(EXTRA_NOTIFICATION_CHANNEL_ID),
        getStringExtra(EXTRA_NOTIFICATION_CHANNEL_NAME),
        getStringExtra(EXTRA_NOTIFICATION_CHANNEL_DESCRIPTION),
        getStringExtra(EXTRA_NOTIFICATION_ICON),
        getStringExtra(EXTRA_NOTIFICATION_COLOR),
        getStringExtra(EXTRA_STOP_ACTION_TITLE)
    )
}

internal fun persistedBackgroundNotificationOptions(context: Context): AndroidForegroundServiceOptions? =
    NitroBackgroundConfigStore(
        context.getSharedPreferences(BACKGROUND_LOCATION_PREFS, Context.MODE_PRIVATE)
    ).restore()?.android?.foregroundService

internal fun fallbackBackgroundNotificationOptions() = AndroidForegroundServiceOptions(
    null,
    "Background location",
    "Location tracking is active",
    "nitro-background-location",
    "Background Location",
    null,
    null,
    null,
    null
)
