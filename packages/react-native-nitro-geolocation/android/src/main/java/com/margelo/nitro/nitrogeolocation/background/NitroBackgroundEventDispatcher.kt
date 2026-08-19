package com.margelo.nitro.nitrogeolocation.background

import android.content.Context
import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import com.margelo.nitro.nitrogeolocation.BackgroundEventEnvelope

/** Serializes the final generation check with reset without holding the lifecycle lock. */
internal class NitroBackgroundEventDispatcher(
    private val appContext: Context,
    private val eventHub: NitroBackgroundEventHub,
    private val currentGeneration: () -> Long,
    private val currentServiceGeneration: () -> Long
) {
    private val dispatchLock = Any()

    fun dispatch(
        event: BackgroundEventEnvelope,
        callbackGeneration: Long,
        callbackServiceGeneration: Long? = null
    ) {
        synchronized(dispatchLock) {
            if (currentGeneration() != callbackGeneration) return
            if (callbackServiceGeneration != null &&
                currentServiceGeneration() != callbackServiceGeneration) return
            val delivered = eventHub.emit(event)
            if (!shouldDispatchHeadlessTask(delivered)) return
            runCatching {
                val intent = Intent(appContext, NitroBackgroundHeadlessTaskService::class.java)
                    .putExtra("event", event.toJson().toString())
                appContext.startService(intent)
                HeadlessJsTaskService.acquireWakeLockNow(appContext)
            }.onFailure { NitroGeoLog.w("dispatchEvent: headless task dispatch failed", it) }
        }
    }

    fun awaitIdle() {
        synchronized(dispatchLock) { /* Barrier for callbacks that started before reset. */ }
    }
}
