package com.margelo.nitro.nitrogeolocation.background

import com.margelo.nitro.nitrogeolocation.BackgroundHttpSyncOptions
import com.margelo.nitro.nitrogeolocation.BackgroundHttpSyncResult
import com.margelo.nitro.nitrogeolocation.GetStoredBackgroundLocationsOptions
import com.margelo.nitro.nitrogeolocation.StoredBackgroundLocation

private data class NitroBackgroundSyncBatch(
    val runGeneration: Long,
    val configRevision: Long,
    val sync: BackgroundHttpSyncOptions,
    val locations: Array<StoredBackgroundLocation>
)

internal fun shouldEnforceSyncInterval(
    continuationConfigRevision: Long?,
    currentConfigRevision: Long
): Boolean = continuationConfigRevision != currentConfigRevision

/** Snapshots storage before entering the registration/throttle gate to keep lock order acyclic. */
internal class NitroBackgroundSyncAdmission {
    fun <T : Any> reserve(
        snapshot: () -> T?,
        reserveGate: () -> Boolean
    ): T? {
        val candidate = snapshot() ?: return null
        return candidate.takeIf { reserveGate() }
    }
}

/** Owns serial HTTP-sync admission, upload, and result persistence. */
internal class NitroBackgroundSyncCoordinator(
    private val store: NitroBackgroundStore,
    private val httpSync: AndroidBackgroundHttpSync,
    private val gate: NitroBackgroundSyncGate,
    private val lifecycleLock: Any,
    private val storageLock: Any,
    private val currentRunGeneration: () -> Long,
    private val currentConfigRevision: () -> Long,
    private val manualSyncConfig: () -> BackgroundHttpSyncOptions?,
    private val automaticSyncConfig: (Long) -> BackgroundHttpSyncOptions?,
    private val isActiveRegistration: (Long, Long) -> Boolean
) {
    private val queue = NitroBackgroundSyncQueue()
    private val admission = NitroBackgroundSyncAdmission()

    fun syncManual(callbackGeneration: Long): BackgroundHttpSyncResult =
        queue.runManual {
            val batch = synchronized(lifecycleLock) {
                check(currentRunGeneration() == callbackGeneration) {
                    "Background location run was reset"
                }
                val sync = manualSyncConfig() ?: return@synchronized null
                synchronized(storageLock) {
                    selectBatch(callbackGeneration, sync)
                }
            } ?: return@runManual emptySyncResult()
            perform(batch)
        }

    fun scheduleAutomatic(
        callbackGeneration: Long,
        registrationGeneration: Long,
        serviceGeneration: Long,
        onResult: (BackgroundHttpSyncResult) -> Unit,
        onFailure: (Exception) -> Unit
    ) {
        val scheduledConfigRevision = currentConfigRevision()
        var continuationConfigRevision: Long? = null
        queue.scheduleAutomatic(
            key = NitroBackgroundSyncKey(
                callbackGeneration,
                registrationGeneration,
                serviceGeneration,
                scheduledConfigRevision
            ),
            reserve = {
                reserveAutomatic(
                    callbackGeneration,
                    registrationGeneration,
                    serviceGeneration,
                    continuationConfigRevision
                )
            },
            perform = { batch ->
                val result = runCatching { perform(batch) }.getOrElse { error ->
                    BackgroundHttpSyncResult(
                        false,
                        null,
                        emptyArray(),
                        batch.locations.map { it.id }.toTypedArray(),
                        error.message ?: "HTTP sync failed"
                    )
                }
                onResult(result)
                val shouldContinue = result.success && result.syncedLocationIds.isNotEmpty()
                if (shouldContinue) continuationConfigRevision = batch.configRevision
                shouldContinue
            },
            continuationKey = { batch ->
                NitroBackgroundSyncKey(
                    callbackGeneration,
                    registrationGeneration,
                    serviceGeneration,
                    batch.configRevision
                )
            },
            onFailure = onFailure
        )
    }

    private fun reserveAutomatic(
        callbackGeneration: Long,
        registrationGeneration: Long,
        serviceGeneration: Long,
        continuationConfigRevision: Long?
    ): NitroBackgroundSyncBatch? = synchronized(lifecycleLock) {
        if (!isActiveRegistration(
                callbackGeneration,
                registrationGeneration
            )) return@synchronized null
        val sync = automaticSyncConfig(callbackGeneration)
            ?: return@synchronized null
        val configRevision = currentConfigRevision()
        val interval = if (shouldEnforceSyncInterval(
                continuationConfigRevision,
                configRevision
            )) {
            sync.syncInterval?.toLong()?.takeIf { it > 0 } ?: 0L
        } else {
            0L
        }
        admission.reserve(
            snapshot = {
                synchronized(storageLock) {
                    val threshold = sync.syncThreshold?.toInt()
                        ?.takeIf { it > 0 } ?: 1
                    val batchSize = sync.batchSize?.toInt()
                        ?.takeIf { it > 0 } ?: 50
                    val candidates = store.getLocations(
                        GetStoredBackgroundLocationsOptions(
                            maxOf(threshold, batchSize).toDouble(),
                            null,
                            true,
                            false
                        )
                    )
                    if (candidates.size < threshold) {
                        null
                    } else {
                        NitroBackgroundSyncBatch(
                            callbackGeneration,
                            configRevision,
                            sync,
                            candidates.take(batchSize).toTypedArray()
                        )
                    }
                }
            },
            reserveGate = {
                gate.reserve(
                    registrationGeneration,
                    serviceGeneration,
                    interval,
                    System.currentTimeMillis()
                )
            }
        )
    }

    private fun selectBatch(
        callbackGeneration: Long,
        sync: BackgroundHttpSyncOptions
    ): NitroBackgroundSyncBatch? {
        val locations = store.getLocations(
            GetStoredBackgroundLocationsOptions(
                sync.batchSize ?: 50.0,
                null,
                true,
                false
            )
        )
        return locations.takeIf { it.isNotEmpty() }?.let {
            NitroBackgroundSyncBatch(
                callbackGeneration,
                currentConfigRevision(),
                sync,
                it
            )
        }
    }

    private fun perform(batch: NitroBackgroundSyncBatch): BackgroundHttpSyncResult {
        val result = httpSync.uploadLocationsWithRetry(batch.sync, batch.locations)
        synchronized(storageLock) {
            if (currentRunGeneration() == batch.runGeneration) {
                store.markSynced(result.syncedLocationIds.toList())
                if (batch.sync.autoClear == true) {
                    store.clearLocations(result.syncedLocationIds)
                }
            }
        }
        return result
    }

    private fun emptySyncResult() =
        BackgroundHttpSyncResult(true, null, emptyArray(), emptyArray(), null)
}
