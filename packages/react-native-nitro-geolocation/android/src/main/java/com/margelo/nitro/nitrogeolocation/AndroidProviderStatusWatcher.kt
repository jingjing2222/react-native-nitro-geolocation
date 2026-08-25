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

internal interface AndroidProviderObservationContext {
    fun registerProviderReceiver(receiver: BroadcastReceiver, filter: IntentFilter)
    fun unregisterProviderReceiver(receiver: BroadcastReceiver)
    fun addLifecycleListener(listener: LifecycleEventListener)
    fun removeLifecycleListener(listener: LifecycleEventListener)
}

private class ReactProviderObservationContext(
    private val reactContext: ReactApplicationContext
) : AndroidProviderObservationContext {
    override fun registerProviderReceiver(receiver: BroadcastReceiver, filter: IntentFilter) {
        ContextCompat.registerReceiver(
            reactContext,
            receiver,
            filter,
            ContextCompat.RECEIVER_NOT_EXPORTED
        )
    }

    override fun unregisterProviderReceiver(receiver: BroadcastReceiver) {
        reactContext.unregisterReceiver(receiver)
    }

    override fun addLifecycleListener(listener: LifecycleEventListener) {
        reactContext.addLifecycleEventListener(listener)
    }

    override fun removeLifecycleListener(listener: LifecycleEventListener) {
        reactContext.removeLifecycleEventListener(listener)
    }
}

internal class AndroidProviderStatusWatcher internal constructor(
    private val observationContext: AndroidProviderObservationContext,
    private val loadProviderStatus: ((LocationProviderStatus) -> Unit) -> Unit
) : LifecycleEventListener {
    constructor(
        reactContext: ReactApplicationContext,
        locationSettings: AndroidLocationSettings
    ) : this(
        observationContext = ReactProviderObservationContext(reactContext),
        loadProviderStatus = { success -> locationSettings.getProviderStatus(success = success) }
    )

    private val callbacks = mutableMapOf<String, (LocationProviderStatus) -> Unit>()
    private val lastStatuses = mutableMapOf<String, LocationProviderStatus>()
    private val mainHandler = Handler(Looper.getMainLooper())
    private val refreshGeneration = AtomicLong(0L)
    private var receiverRegistered = false
    private var lifecycleRegistered = false
    private val broadcastRefresh = Runnable { refresh() }

    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            mainHandler.removeCallbacks(broadcastRefresh)
            mainHandler.postDelayed(broadcastRefresh, BROADCAST_SETTLE_DELAY_MS)
        }
    }

    fun watch(success: (LocationProviderStatus) -> Unit): String {
        val token = UUID.randomUUID().toString()
        synchronized(this) {
            callbacks[token] = success
            try {
                if (!receiverRegistered) startObserving()
            } catch (error: Throwable) {
                callbacks.remove(token)
                lastStatuses.remove(token)
                refreshGeneration.incrementAndGet()
                runCatching { stopObservingSources() }
                throw error
            }
        }
        try {
            refresh()
        } catch (error: Throwable) {
            unwatch(token)
            throw error
        }
        return token
    }

    internal val activeWatchCount: Int
        get() = synchronized(this) { callbacks.size }

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
        try {
            loadProviderStatus providerStatus@{ status ->
                if (generation != refreshGeneration.get()) return@providerStatus

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
        } catch (error: Throwable) {
            refreshGeneration.compareAndSet(generation, generation - 1)
            throw error
        }
    }

    private fun startObserving() {
        val filter = IntentFilter().apply {
            addAction(LocationManager.PROVIDERS_CHANGED_ACTION)
            addAction(LocationManager.MODE_CHANGED_ACTION)
        }
        observationContext.registerProviderReceiver(receiver, filter)
        receiverRegistered = true
        observationContext.addLifecycleListener(this)
        lifecycleRegistered = true
    }

    private fun stopObservingSources() {
        mainHandler.removeCallbacks(broadcastRefresh)
        if (lifecycleRegistered) {
            observationContext.removeLifecycleListener(this)
            lifecycleRegistered = false
        }
        if (receiverRegistered) {
            observationContext.unregisterProviderReceiver(receiver)
            receiverRegistered = false
        }
    }

    private companion object {
        const val BROADCAST_SETTLE_DELAY_MS = 250L
    }
}
