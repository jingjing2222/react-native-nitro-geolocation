package com.margelo.nitro.nitrogeolocation.background

import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class NitroBackgroundSyncGateTest {
    private val context = ApplicationProvider.getApplicationContext<android.content.Context>()

    @Test
    fun stoppedRegistrationCannotConsumeThrottleWindow() {
        val prefs = context.getSharedPreferences("sync-gate-stopped", 0)
        prefs.edit().clear().commit()
        val registrations = NitroBackgroundRegistrations(prefs)
        val owner = registrations.nextServiceGeneration()
        val registration = registrations.replaceLocation(owner).second
        val gate = NitroBackgroundSyncGate(registrations, prefs)
        registrations.removeLocation(owner)

        assertFalse(gate.reserve(registration.generation, owner, 60_000L, 75_000L))
        assertEquals(0L, prefs.getLong("lastSyncAt", 0L))
    }

    @Test
    fun activeRegistrationReservesOncePerInterval() {
        val prefs = context.getSharedPreferences("sync-gate-active", 0)
        prefs.edit().clear().commit()
        val registrations = NitroBackgroundRegistrations(prefs)
        val owner = registrations.nextServiceGeneration()
        val registration = registrations.replaceLocation(owner).second
        val gate = NitroBackgroundSyncGate(registrations, prefs)

        assertTrue(gate.reserve(registration.generation, owner, 60_000L, 75_000L))
        assertFalse(gate.reserve(registration.generation, owner, 60_000L, 80_000L))
        assertEquals(75_000L, prefs.getLong("lastSyncAt", 0L))
    }
}
