package com.margelo.nitro.nitrogeolocation.background

import android.content.Intent
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.jstasks.HeadlessJsTaskConfig
import com.facebook.react.bridge.Arguments
import org.json.JSONArray
import org.json.JSONObject

class NitroBackgroundHeadlessTaskService : HeadlessJsTaskService() {
    override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
        val event = intent?.getStringExtra("event") ?: return null
        return HeadlessJsTaskConfig(
            "NitroBackgroundLocationTask",
            JSONObject(event).toWritableMap(),
            30_000,
            true
        )
    }

    private fun JSONObject.toWritableMap(): WritableMap {
        val map = Arguments.createMap()
        val keys = keys()
        while (keys.hasNext()) {
            val key = keys.next()
            when (val value = get(key)) {
                JSONObject.NULL -> map.putNull(key)
                is JSONObject -> map.putMap(key, value.toWritableMap())
                is JSONArray -> map.putArray(key, value.toWritableArray())
                is Boolean -> map.putBoolean(key, value)
                is Int -> map.putInt(key, value)
                is Long -> map.putDouble(key, value.toDouble())
                is Double -> map.putDouble(key, value)
                is Number -> map.putDouble(key, value.toDouble())
                else -> map.putString(key, value.toString())
            }
        }
        return map
    }

    private fun JSONArray.toWritableArray(): WritableArray = Arguments.createArray().also { array ->
        for (index in 0 until length()) {
            when (val value = get(index)) {
                JSONObject.NULL -> array.pushNull()
                is JSONObject -> array.pushMap(value.toWritableMap())
                is JSONArray -> array.pushArray(value.toWritableArray())
                is Boolean -> array.pushBoolean(value)
                is Int -> array.pushInt(value)
                is Long -> array.pushDouble(value.toDouble())
                is Double -> array.pushDouble(value)
                is Number -> array.pushDouble(value.toDouble())
                else -> array.pushString(value.toString())
            }
        }
    }
}
