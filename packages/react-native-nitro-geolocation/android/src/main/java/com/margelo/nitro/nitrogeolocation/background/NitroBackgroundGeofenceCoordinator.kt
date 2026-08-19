package com.margelo.nitro.nitrogeolocation.background

import com.google.android.gms.location.Geofence
import com.google.android.gms.location.GeofencingClient
import com.google.android.gms.location.GeofencingRequest
import com.google.android.gms.tasks.Tasks
import com.margelo.nitro.nitrogeolocation.BackgroundPermissionStatus
import com.margelo.nitro.nitrogeolocation.GeofenceRegion
import com.margelo.nitro.nitrogeolocation.GeofencingOptions
import java.util.concurrent.CompletableFuture
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

/** Keeps Play Services waits off the service main thread and outside controller lifecycle locks. */
internal class NitroBackgroundGeofenceCoordinator(
    private val client: GeofencingClient,
    private val pendingIntents: NitroBackgroundPendingIntents,
    private val store: NitroBackgroundStore,
    private val backgroundPermission: () -> BackgroundPermissionStatus,
    private val currentRunGeneration: () -> Long,
    private val activeServiceGeneration: () -> Long?,
    private val reportError: (String, Throwable, Long?) -> Unit
) {
    private val commandLock = ReentrantLock()
    private val restoreExecutor = Executors.newSingleThreadExecutor()

    fun add(regions: Array<GeofenceRegion>, options: GeofencingOptions?) = commandLock.withLock {
        if (backgroundPermission() != BackgroundPermissionStatus.GRANTED) {
            throw SecurityException("Background location permission is required to register geofences")
        }
        if (regions.isEmpty()) return
        register(regions, options, currentRunGeneration())
        store.saveGeofences(regions)
    }

    fun remove(identifiers: Array<String>?) = commandLock.withLock {
        if (identifiers == null) {
            val callback = pendingIntents.geofence(currentRunGeneration())
            await(client.removeGeofences(callback))
            callback.cancel()
            removeLegacy()
        } else {
            await(client.removeGeofences(identifiers.toList()))
        }
        store.removeGeofences(identifiers)
    }

    fun restore(expectedServiceGeneration: Long? = null): CompletableFuture<Void> {
        val completion = CompletableFuture<Void>()
        restoreExecutor.execute {
            try {
                restoreBlocking(expectedServiceGeneration)
                completion.complete(null)
            } catch (error: Throwable) {
                completion.completeExceptionally(error)
            }
        }
        return completion
    }

    fun restoreBlocking(expectedServiceGeneration: Long? = null) {
        try {
            commandLock.lockInterruptibly()
            try {
                if (expectedServiceGeneration == null ||
                    activeServiceGeneration() == expectedServiceGeneration) {
                    val regions = store.getGeofences()
                    if (regions.isNotEmpty()) {
                        register(regions, null, currentRunGeneration())
                    }
                }
            } finally {
                commandLock.unlock()
            }
        } catch (error: Throwable) {
            if (error is InterruptedException) Thread.currentThread().interrupt() else {
                reportError(
                    "Failed to register persisted geofences: ${error.message}",
                    error,
                    expectedServiceGeneration
                )
            }
            throw error
        }
    }

    fun reset(resetState: () -> Unit) = commandLock.withLock {
        val callback = pendingIntents.geofence(currentRunGeneration())
        await(client.removeGeofences(callback))
        callback.cancel()
        removeLegacy()
        resetState()
    }

    private fun register(
        regions: Array<GeofenceRegion>,
        options: GeofencingOptions?,
        runGeneration: Long
    ) {
        val geofences = regions.map { region ->
            Geofence.Builder()
                .setRequestId(region.identifier)
                .setCircularRegion(region.latitude, region.longitude, region.radius.toFloat())
                .setTransitionTypes(region.toTransitionTypes())
                .setLoiteringDelay(region.loiteringDelay?.toInt() ?: 0)
                .setExpirationDuration(region.expirationDuration?.toLong() ?: Geofence.NEVER_EXPIRE)
                .apply {
                    options?.notificationResponsiveness?.toInt()?.takeIf { it >= 0 }?.let {
                        setNotificationResponsiveness(it)
                    }
                }
                .build()
        }
        removeLegacy()
        await(
            client.addGeofences(
                GeofencingRequest.Builder()
                    .setInitialTrigger(options.toInitialTrigger())
                    .addGeofences(geofences)
                    .build(),
                pendingIntents.geofence(runGeneration)
            )
        )
    }

    private fun removeLegacy() {
        pendingIntents.legacyGeofence()?.let { callback ->
            await(client.removeGeofences(callback))
            callback.cancel()
        }
    }

    private fun await(task: com.google.android.gms.tasks.Task<Void>) {
        Tasks.await(task, 30, TimeUnit.SECONDS)
    }
}
