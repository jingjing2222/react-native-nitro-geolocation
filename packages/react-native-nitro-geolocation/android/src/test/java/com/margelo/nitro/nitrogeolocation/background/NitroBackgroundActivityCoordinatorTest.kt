package com.margelo.nitro.nitrogeolocation.background

import android.app.PendingIntent
import androidx.test.core.app.ApplicationProvider
import com.google.android.gms.tasks.TaskCompletionSource
import com.google.android.gms.tasks.Tasks
import java.util.concurrent.ExecutionException
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class NitroBackgroundActivityCoordinatorTest {
    private val context = ApplicationProvider.getApplicationContext<android.content.Context>()

    @Test
    fun failedBackgroundReplacementKeepsConfirmedStandaloneRegistration() {
        val registrations = registrations("activity-coordinator-replacement")
        val requestCount = AtomicInteger()
        val coordinator = coordinator(registrations) { _, _ ->
            if (requestCount.incrementAndGet() == 1) {
                Tasks.forResult<Void>(null)
            } else {
                Tasks.forException(IllegalStateException("provider rejected replacement"))
            }
        }

        coordinator.start(1_000L, null).get(2, TimeUnit.SECONDS)
        val service = registrations.nextServiceGeneration()
        assertThrows(ExecutionException::class.java) {
            coordinator.start(1_000L, service).get(2, TimeUnit.SECONDS)
        }

        assertTrue(registrations.isCurrentActivity(1L, null))
        assertFalse(registrations.isCurrentActivity(2L, service))
    }

    @Test
    fun stopDuringProviderRequestPreventsLateConfirmation() {
        val registrations = registrations("activity-coordinator-stop")
        val providerRequest = TaskCompletionSource<Void>()
        val coordinator = coordinator(registrations) { _, _ -> providerRequest.task }
        val start = coordinator.start(1_000L, null)

        val stop = coordinator.stop(null)
        providerRequest.setResult(null)

        assertThrows(Exception::class.java) { start.get(2, TimeUnit.SECONDS) }
        stop.get(2, TimeUnit.SECONDS)
        assertFalse(registrations.isCurrentActivity(1L, null))
    }

    @Test
    fun laterRequestCannotBeRolledBackByEarlierCompletion() {
        val registrations = registrations("activity-coordinator-order")
        val firstProviderRequest = TaskCompletionSource<Void>()
        val requestCount = AtomicInteger()
        val coordinator = coordinator(registrations) { _, _ ->
            if (requestCount.incrementAndGet() == 1) {
                firstProviderRequest.task
            } else {
                Tasks.forException(IllegalStateException("latest request failed"))
            }
        }
        val service = registrations.nextServiceGeneration()
        val first = coordinator.start(1_000L, service)
        val replacement = coordinator.start(2_000L, service)

        firstProviderRequest.setResult(null)

        assertThrows(Exception::class.java) { first.get(2, TimeUnit.SECONDS) }
        assertThrows(ExecutionException::class.java) {
            replacement.get(2, TimeUnit.SECONDS)
        }
        assertFalse(registrations.isCurrentActivity(1L, service))
        assertFalse(registrations.isCurrentActivity(2L, service))
    }

    @Test
    fun confirmedReplacementSurvivesFailureToRemoveTheOldCallback() {
        val registrations = registrations("activity-coordinator-cleanup")
        val coordinator = NitroBackgroundActivityCoordinator(
            NitroBackgroundPendingIntents(context),
            registrations,
            { 0L },
            { _, _ -> Tasks.forResult<Void>(null) },
            { Tasks.forException(IllegalStateException("old callback removal failed")) }
        )
        coordinator.start(1_000L, null).get(2, TimeUnit.SECONDS)
        val service = registrations.nextServiceGeneration()

        coordinator.start(1_000L, service).get(2, TimeUnit.SECONDS)

        assertTrue(registrations.isCurrentActivity(2L, service))
        assertTrue(registrations.isCurrentActivity(2L, null))
    }

    @Test
    fun confirmedProviderCompletesBeforeStaleCallbackCleanup() {
        val registrations = registrations("activity-coordinator-readiness")
        val cleanup = TaskCompletionSource<Void>()
        val coordinator = NitroBackgroundActivityCoordinator(
            NitroBackgroundPendingIntents(context),
            registrations,
            { 0L },
            { _, _ -> Tasks.forResult<Void>(null) },
            { cleanup.task }
        )
        coordinator.start(1_000L, null).get(2, TimeUnit.SECONDS)
        val service = registrations.nextServiceGeneration()
        val replacement = coordinator.start(1_000L, service)

        try {
            replacement.get(200, TimeUnit.MILLISECONDS)
        } finally {
            cleanup.trySetResult(null)
        }
        assertTrue(registrations.isCurrentActivity(2L, service))
    }

    @Test
    fun providerTimeoutRejectsWithoutLeavingTheOwnerActive() {
        val registrations = registrations("activity-coordinator-timeout")
        val coordinator = NitroBackgroundActivityCoordinator(
            NitroBackgroundPendingIntents(context),
            registrations,
            { 0L },
            { _, _ -> TaskCompletionSource<Void>().task },
            { Tasks.forResult<Void>(null) },
            TimeUnit.MILLISECONDS.toNanos(10L)
        )

        assertThrows(ExecutionException::class.java) {
            coordinator.start(1_000L, null).get(2, TimeUnit.SECONDS)
        }
        assertFalse(registrations.isCurrentActivity(1L, null))
    }

    private fun registrations(name: String): NitroBackgroundRegistrations {
        val prefs = context.getSharedPreferences(name, 0)
        prefs.edit().clear().commit()
        return NitroBackgroundRegistrations(prefs)
    }

    private fun coordinator(
        registrations: NitroBackgroundRegistrations,
        requestUpdates: (Long, PendingIntent) -> com.google.android.gms.tasks.Task<Void>
    ) = NitroBackgroundActivityCoordinator(
        NitroBackgroundPendingIntents(context),
        registrations,
        { 0L },
        requestUpdates,
        { Tasks.forResult<Void>(null) }
    )
}
