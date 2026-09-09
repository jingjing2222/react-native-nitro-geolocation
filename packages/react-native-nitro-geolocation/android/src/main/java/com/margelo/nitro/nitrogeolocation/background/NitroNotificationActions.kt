package com.margelo.nitro.nitrogeolocation.background

import com.margelo.nitro.nitrogeolocation.*
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

internal const val ACTION_NOTIFICATION_ACTION = "com.margelo.nitro.nitrogeolocation.background.NOTIFICATION_ACTION"
internal const val EXTRA_NOTIFICATION_ACTION_ID = "nitro.background.actionId"

internal fun validateNotificationActions(options: AndroidForegroundServiceOptions) {
    val actions = options.actions ?: emptyArray()
    require(actions.size + (if (options.stopActionTitle.isNullOrBlank()) 0 else 1) <= 3) {
        "At most 3 notification actions are supported, including stopActionTitle."
    }
    require(actions.all { it.id.isNotBlank() && it.title.isNotBlank() } &&
        actions.map { it.id }.distinct().size == actions.size) {
        "Notification actions require unique non-empty ids and non-empty titles."
    }
}

internal fun notificationActionsJson(actions: Array<AndroidNotificationAction>?): String? = actions?.let {
    val json = JSONArray()
    it.forEach { action -> json.put(JSONObject().put("id", action.id).put("title", action.title)) }
    json.toString()
}

internal fun notificationActionsFromJson(payload: String?): Array<AndroidNotificationAction>? = payload?.let {
    runCatching {
        val json = JSONArray(it)
        Array(json.length()) { index ->
            val action = json.getJSONObject(index)
            AndroidNotificationAction(action.getString("id"), action.getString("title"))
        }
    }.getOrNull()
}

internal fun notificationActionEvent(actionId: String): BackgroundEventEnvelope = BackgroundEventEnvelope(
    notificationAction = NotificationActionEvent(actionId),
    location = null, geofence = null, activity = null, providerStatus = null,
    lifecycle = null, result = null, error = null,
    id = UUID.randomUUID().toString(), type = BackgroundEventType.NOTIFICATIONACTION,
    timestamp = System.currentTimeMillis().toDouble(), deliveredToJS = false
)
