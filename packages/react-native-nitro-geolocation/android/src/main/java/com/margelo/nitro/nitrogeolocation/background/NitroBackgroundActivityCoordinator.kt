package com.margelo.nitro.nitrogeolocation.background

import android.Manifest
import android.app.PendingIntent
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import com.google.android.gms.tasks.Task
import com.google.android.gms.tasks.Tasks
import java.util.concurrent.CancellationException
import java.util.concurrent.CompletableFuture
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException

private const val ACTIVITY_COMMAND_TIMEOUT_SECONDS = 30L

internal fun requireActivityRecognitionPermission(context: Context) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
        ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACTIVITY_RECOGNITION
        ) != PackageManager.PERMISSION_GRANTED) {
        throw SecurityException("Activity recognition permission is required")
    }
}

internal fun awaitActivityCommand(future: CompletableFuture<Void>) {
    try {
        future.get()
    } catch (error: java.util.concurrent.ExecutionException) {
        throw unwrapActivityCommandError(error)
    }
}

internal fun unwrapActivityCommandError(error: Throwable): Exception {
    val cause = error.cause ?: error
    return cause as? Exception ?: IllegalStateException(cause.message, cause)
}

/** Serializes activity-provider replacements while desired owners change synchronously. */
internal class NitroBackgroundActivityCoordinator(
    private val pendingIntents: NitroBackgroundPendingIntents,
    private val registrations: NitroBackgroundRegistrations,
    private val currentRunGeneration: () -> Long,
    private val requestUpdates: (Long, PendingIntent) -> Task<Void>,
    private val removeUpdates: (PendingIntent) -> Task<Void>,
    private val commandTimeoutNanos: Long =
        TimeUnit.SECONDS.toNanos(ACTIVITY_COMMAND_TIMEOUT_SECONDS)
) {
    private val executor = Executors.newSingleThreadExecutor()

    fun start(intervalMs: Long, owner: Long?): CompletableFuture<Void> {
        val deadlineNanos = System.nanoTime() + commandTimeoutNanos
        val runGeneration = currentRunGeneration()
        val request = registrations.requestActivity(owner)
        val callback = pendingIntents.activity(runGeneration, request.generation)
        val completion = CompletableFuture<Void>()
        executor.execute {
            try {
                await(requestUpdates(intervalMs, callback), deadlineNanos)
            } catch (error: Throwable) {
                removeProviderCallbackAsync(callback)
                registrations.failActivity(request)?.let { active ->
                    if (active.generation != request.generation) {
                        removeProviderCallbackAsync(
                            pendingIntents.activity(runGeneration, active.generation)
                        )
                    }
                }
                completion.completeExceptionally(error)
                return@execute
            }
            val confirmation = registrations.confirmActivity(request)
            if (!confirmation.accepted) {
                removeProviderCallbackAsync(callback)
                completion.completeExceptionally(
                    CancellationException("Activity recognition request was superseded or stopped")
                )
                return@execute
            }
            // Provider ownership is now confirmed. Startup readiness must not wait for cleanup of
            // a stale callback, which is best-effort and may consume the remaining command budget.
            completion.complete(null)
            confirmation.previous
                ?.takeIf { it.generation != request.generation }
                ?.let { previous ->
                    runCatching {
                        removeProviderCallback(
                            pendingIntents.activity(runGeneration, previous.generation),
                            deadlineNanos
                        )
                    }
            }
            runCatching { removeLegacy(deadlineNanos) }
        }
        return completion
    }

    /** Revokes the owner before returning, so its callback dispatch fence closes immediately. */
    fun stop(owner: Long?): CompletableFuture<Void> {
        val runGeneration = currentRunGeneration()
        val registration = registrations.removeActivity(owner)
        val deadlineNanos = System.nanoTime() + commandTimeoutNanos
        val completion = CompletableFuture<Void>()
        executor.execute {
            try {
                registration?.let { active ->
                    removeProviderCallback(
                        pendingIntents.activity(runGeneration, active.generation),
                        deadlineNanos
                    )
                }
                removeLegacy(deadlineNanos)
                completion.complete(null)
            } catch (error: Throwable) {
                completion.completeExceptionally(error)
            }
        }
        return completion
    }

    fun awaitIdle() {
        executor.submit {}.get()
    }

    private fun removeLegacy(deadlineNanos: Long) {
        pendingIntents.legacyActivity()?.let { callback ->
            removeProviderCallback(callback, deadlineNanos)
        }
    }

    private fun removeProviderCallback(callback: PendingIntent, deadlineNanos: Long) {
        try {
            await(removeUpdates(callback), deadlineNanos)
        } finally {
            callback.cancel()
        }
    }

    private fun removeProviderCallbackAsync(callback: PendingIntent) {
        runCatching { removeUpdates(callback) }
        callback.cancel()
    }

    private fun await(task: Task<Void>, deadlineNanos: Long) {
        val remainingNanos = deadlineNanos - System.nanoTime()
        if (remainingNanos <= 0L) throw TimeoutException("Activity command timed out")
        Tasks.await(task, remainingNanos, TimeUnit.NANOSECONDS)
    }
}
