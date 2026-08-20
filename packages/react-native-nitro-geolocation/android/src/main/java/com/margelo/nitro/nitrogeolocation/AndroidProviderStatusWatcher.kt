package com.margelo.nitro.nitrogeolocation

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.location.LocationManager
import android.os.Handler
import android.os.Looper
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.ReactApplicationContext
import java.util.UUID
import java.util.concurrent.atomic.AtomicLong

internal class AndroidProviderStatusWatcher(
    private val reactContext: ReactApplicationContext,
    private val locationSettings: AndroidLocationSettings
) : LifecycleEventListener {
    private val callbacks = mutableMapOf<String, (LocationProviderStatus) -> Unit>()
    private val lastStatuses = mutableMapOf<String, LocationProviderStatus>()
    private val mainHandler = Handler(Looper.getMainLooper())
    private val refreshGeneration = AtomicLong(0L)
    private var receiverRegistered = false
    private var lifecycleRegistered = false

    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            refresh()
        }
    }

    fun watch(success: (LocationProviderStatus) -> Unit): String {
        val token = UUID.randomUUID().toString()
        synchronized(this) {
            callbacks[token] = success
            if (!receiverRegistered) startObserving()
        }
        refresh()
        return token
    }

    fun unwatch(token: String) {
        synchronized(this) {
            callbacks.remove(token)
            lastStatuses.remove(token)
            if (callbacks.isEmpty()) {
                refreshGeneration.incrementAndGet()
                stopObservingSources()
            }
        }
    }

    fun stopObserving() {
        synchronized(this) {
            callbacks.clear()
            lastStatuses.clear()
            refreshGeneration.incrementAndGet()
            stopObservingSources()
        }
    }

    fun dispose() {
        stopObserving()
    }

    override fun onHostResume() {
        val hasCallbacks = synchronized(this) { callbacks.isNotEmpty() }
        if (hasCallbacks) refresh()
    }

    override fun onHostPause() = Unit

    override fun onHostDestroy() {
        stopObserving()
    }

    private fun refresh() {
        val generation = refreshGeneration.incrementAndGet()
        locationSettings.getProviderStatus { status ->
            if (generation != refreshGeneration.get()) return@getProviderStatus

            val tokens = synchronized(this) {
                callbacks.keys.filter { token ->
                    if (lastStatuses[token] == status) {
                        false
                    } else {
                        lastStatuses[token] = status
                        true
                    }
                }
            }
            tokens.forEach { token ->
                mainHandler.post {
                    val callback = synchronized(this) { callbacks[token] }
                    callback?.invoke(status)
                }
            }
        }
    }

    private fun startObserving() {
        val filter = IntentFilter().apply {
            addAction(LocationManager.PROVIDERS_CHANGED_ACTION)
            addAction(LocationManager.MODE_CHANGED_ACTION)
        }
        ContextCompat.registerReceiver(
            reactContext,
            receiver,
            filter,
            ContextCompat.RECEIVER_NOT_EXPORTED
        )
        receiverRegistered = true
        reactContext.addLifecycleEventListener(this)
        lifecycleRegistered = true
    }

    private fun stopObservingSources() {
        if (lifecycleRegistered) {
            reactContext.removeLifecycleEventListener(this)
            lifecycleRegistered = false
        }
        if (receiverRegistered) {
            reactContext.unregisterReceiver(receiver)
            receiverRegistered = false
        }
    }
}
