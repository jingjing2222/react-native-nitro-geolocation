package com.margelo.nitro.nitrogeolocation.background

import java.util.concurrent.Callable
import java.util.concurrent.ExecutionException
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference

internal data class NitroBackgroundSyncKey(
    val runGeneration: Long,
    val registrationGeneration: Long,
    val serviceGeneration: Long,
    val configRevision: Long = 0
) : Comparable<NitroBackgroundSyncKey> {
    override fun compareTo(other: NitroBackgroundSyncKey): Int {
        val runOrder = runGeneration.compareTo(other.runGeneration)
        if (runOrder != 0) return runOrder
        val registrationOrder = registrationGeneration.compareTo(other.registrationGeneration)
        if (registrationOrder != 0) return registrationOrder
        val serviceOrder = serviceGeneration.compareTo(other.serviceGeneration)
        if (serviceOrder != 0) return serviceOrder
        return configRevision.compareTo(other.configRevision)
    }

    companion object {
        val DEFAULT = NitroBackgroundSyncKey(0, 0, 0, 0)
    }
}

/** Gives manual and automatic HTTP sync one serial admission and upload boundary. */
internal class NitroBackgroundSyncQueue(
    private val executor: ExecutorService = Executors.newSingleThreadExecutor()
) {
    private data class AutomaticWork(
        val key: NitroBackgroundSyncKey,
        val runOnce: () -> NitroBackgroundSyncKey?
    )

    private val pendingAutomatic = AtomicReference<AutomaticWork?>(null)
    private val automaticDrainScheduled = AtomicBoolean(false)

    fun <T> runManual(work: () -> T): T {
        return try {
            executor.submit(Callable { work() }).get()
        } catch (error: InterruptedException) {
            Thread.currentThread().interrupt()
            throw error
        } catch (error: ExecutionException) {
            throw error.cause ?: error
        }
    }

    fun <T : Any> scheduleAutomatic(
        key: NitroBackgroundSyncKey = NitroBackgroundSyncKey.DEFAULT,
        reserve: () -> T?,
        perform: (T) -> Boolean,
        continuationKey: (T) -> NitroBackgroundSyncKey = { key },
        onSkipped: () -> Unit = {},
        onFailure: (Exception) -> Unit = {
            NitroGeoLog.e("Automatic background HTTP sync failed", it)
        }
    ) {
        val work = AutomaticWork(
            key = key,
            runOnce = {
                try {
                    val reservation = reserve()
                    if (reservation == null) {
                        onSkipped()
                        null
                    } else {
                        if (perform(reservation)) continuationKey(reservation) else null
                    }
                } catch (error: Exception) {
                    if (error is InterruptedException) {
                        Thread.currentThread().interrupt()
                    }
                    runCatching { onFailure(error) }.onFailure {
                        NitroGeoLog.e("Failed to report automatic HTTP sync error", it)
                    }
                    null
                }
            }
        )
        offerAutomatic(work, replaceSameKey = false)
        scheduleAutomaticDrainIfNeeded()
    }

    private fun offerAutomatic(work: AutomaticWork, replaceSameKey: Boolean) {
        while (true) {
            val current = pendingAutomatic.get()
            if (current != null) {
                val order = work.key.compareTo(current.key)
                if (order < 0 || (order == 0 && !replaceSameKey)) return
            }
            if (pendingAutomatic.compareAndSet(current, work)) return
        }
    }

    private fun scheduleAutomaticDrainIfNeeded() {
        if (!automaticDrainScheduled.compareAndSet(false, true)) return
        executor.execute {
            try {
                val work = pendingAutomatic.getAndSet(null)
                val continuationKey = work?.runOnce()
                if (work != null && continuationKey != null) {
                    // A successful batch gets the same priority as its run so a late stale
                    // callback cannot displace the follow-up. A newer run always wins.
                    offerAutomatic(
                        work.copy(key = continuationKey),
                        replaceSameKey = true
                    )
                }
            } finally {
                automaticDrainScheduled.set(false)
                if (pendingAutomatic.get() != null) {
                    scheduleAutomaticDrainIfNeeded()
                }
            }
        }
    }

    internal fun close() {
        pendingAutomatic.set(null)
        executor.shutdownNow()
    }
}
