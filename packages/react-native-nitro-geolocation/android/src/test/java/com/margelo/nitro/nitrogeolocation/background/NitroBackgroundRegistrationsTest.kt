package com.margelo.nitro.nitrogeolocation.background

import android.app.PendingIntent
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertFalse
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class NitroBackgroundRegistrationsTest {
    private val context = ApplicationProvider.getApplicationContext<android.content.Context>()

    @Test
    fun delayedOldRemovalCannotCancelTheReplacementPendingIntent() {
        val pendingIntents = NitroBackgroundPendingIntents(context)
        val old = pendingIntents.location(3L, 7L)
        val replacement = pendingIntents.location(3L, 8L)

        assertFalse(old == replacement)
        old.cancel()
        replacement.send()
    }

    @Test
    fun staleServiceCannotRemoveTheReplacementRegistration() {
        val prefs = context.getSharedPreferences("registration-test", 0)
        prefs.edit().clear().commit()
        val registrations = NitroBackgroundRegistrations(prefs)
        val firstService = registrations.nextServiceGeneration()
        registrations.replaceLocation(firstService)
        val secondService = registrations.nextServiceGeneration()
        val replacement = registrations.replaceLocation(secondService).second

        assertNull(registrations.removeLocation(firstService))
        assertNull(registrations.removeLocation(secondService + 1L))
        assertTrue(registrations.isCurrentLocation(replacement.generation, secondService))
    }

    @Test(expected = PendingIntent.CanceledException::class)
    fun cancelledOldIdentityStaysCancelled() {
        val pendingIntents = NitroBackgroundPendingIntents(context)
        val old = pendingIntents.location(4L, 11L)
        pendingIntents.location(4L, 12L)

        old.cancel()
        old.send()
    }

    @Test
    fun replacementWaitsForAnInFlightCurrentRegistrationDispatch() {
        val prefs = context.getSharedPreferences("registration-dispatch-test", 0)
        prefs.edit().clear().commit()
        val registrations = NitroBackgroundRegistrations(prefs)
        val service = registrations.nextServiceGeneration()
        val registration = registrations.replaceLocation(service).second
        val dispatchEntered = CountDownLatch(1)
        val releaseDispatch = CountDownLatch(1)
        val replacementStarted = CountDownLatch(1)
        val replacementFinished = CountDownLatch(1)
        val executor = Executors.newFixedThreadPool(2)

        executor.execute {
            registrations.withCurrentLocation(registration.generation, service) {
                dispatchEntered.countDown()
                releaseDispatch.await(1, TimeUnit.SECONDS)
            }
        }
        assertTrue(dispatchEntered.await(1, TimeUnit.SECONDS))
        executor.execute {
            replacementStarted.countDown()
            registrations.replaceLocation(service)
            replacementFinished.countDown()
        }

        assertTrue(replacementStarted.await(1, TimeUnit.SECONDS))
        assertFalse(replacementFinished.await(50, TimeUnit.MILLISECONDS))
        releaseDispatch.countDown()
        assertTrue(replacementFinished.await(1, TimeUnit.SECONDS))
        executor.shutdownNow()
    }

    @Test
    fun serviceGenerationReadDoesNotInvertTheDispatchLockOrder() {
        val prefs = context.getSharedPreferences("registration-generation-lock-test", 0)
        prefs.edit().clear().commit()
        val registrations = NitroBackgroundRegistrations(prefs)
        val service = registrations.nextServiceGeneration()
        val finished = CountDownLatch(1)
        val executor = Executors.newSingleThreadExecutor()

        synchronized(registrations) {
            executor.execute {
                registrations.currentServiceGeneration()
                finished.countDown()
            }
            assertTrue(finished.await(250, TimeUnit.MILLISECONDS))
        }
        assertEquals(service, registrations.currentServiceGeneration())
        executor.shutdownNow()
    }

    @Test
    fun standaloneAndBackgroundActivityOwnersReleaseIndependently() {
        val prefs = context.getSharedPreferences("registration-activity-owner-test", 0)
        prefs.edit().clear().commit()
        val registrations = NitroBackgroundRegistrations(prefs)
        val service = registrations.nextServiceGeneration()
        val standalone = registrations.requestActivity(null)
        assertTrue(registrations.confirmActivity(standalone).accepted)
        val background = registrations.requestActivity(service)
        assertTrue(registrations.confirmActivity(background).accepted)

        assertNull(registrations.removeActivity(service))
        assertTrue(registrations.isCurrentActivity(background.generation, null))
        val removed = registrations.removeActivity(null)
        assertEquals(background.generation, removed?.generation)
        assertFalse(registrations.isCurrentActivity(background.generation, null))
    }

    @Test
    fun stoppedActivityOwnerCannotBeConfirmedByAnInFlightRequest() {
        val prefs = context.getSharedPreferences("registration-activity-stop-test", 0)
        prefs.edit().clear().commit()
        val registrations = NitroBackgroundRegistrations(prefs)
        val request = registrations.requestActivity(null)

        registrations.removeActivity(null)

        assertFalse(registrations.confirmActivity(request).accepted)
        assertFalse(registrations.isCurrentActivity(request.generation, null))
    }

    @Test
    fun failedReplacementDoesNotResurrectOrRemoveAnotherOwner() {
        val prefs = context.getSharedPreferences("registration-activity-failure-test", 0)
        prefs.edit().clear().commit()
        val registrations = NitroBackgroundRegistrations(prefs)
        val standalone = registrations.requestActivity(null)
        assertTrue(registrations.confirmActivity(standalone).accepted)
        val service = registrations.nextServiceGeneration()
        val replacement = registrations.requestActivity(service)

        assertNull(registrations.failActivity(replacement))

        assertTrue(registrations.isCurrentActivity(standalone.generation, null))
        assertFalse(registrations.isCurrentActivity(replacement.generation, service))
    }

    @Test
    fun failedSameOwnerReplacementKeepsTheConfirmedRegistration() {
        val prefs = context.getSharedPreferences("registration-same-owner-failure-test", 0)
        prefs.edit().clear().commit()
        val registrations = NitroBackgroundRegistrations(prefs)
        val confirmed = registrations.requestActivity(null)
        assertTrue(registrations.confirmActivity(confirmed).accepted)
        val replacement = registrations.requestActivity(null)

        assertNull(registrations.failActivity(replacement))

        assertTrue(registrations.isCurrentActivity(confirmed.generation, null))
        assertFalse(registrations.isCurrentActivity(replacement.generation, null))
    }
}
