package com.margelo.nitro.nitrogeolocation.background

import android.app.PendingIntent
import android.os.Build
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class BackgroundDecisionsTest {
    @Test
    fun pendingIntentFlagsAreMutableOnApiSAndAbove() {
        val flags = mutablePendingIntentFlags(Build.VERSION_CODES.S)
        assertTrue(
            "FLAG_MUTABLE must be set on API >= S, or the OS rejects the registration",
            (flags and PendingIntent.FLAG_MUTABLE) != 0
        )
        assertTrue(
            "FLAG_UPDATE_CURRENT must be set",
            (flags and PendingIntent.FLAG_UPDATE_CURRENT) != 0
        )
    }

    @Test
    fun pendingIntentFlagsAreNotImmutableBelowApiS() {
        val flags = mutablePendingIntentFlags(Build.VERSION_CODES.R)
        assertFalse(
            "FLAG_IMMUTABLE must not be set below S (PendingIntents are mutable by default there)",
            (flags and PendingIntent.FLAG_IMMUTABLE) != 0
        )
        assertTrue(
            "FLAG_UPDATE_CURRENT must be set",
            (flags and PendingIntent.FLAG_UPDATE_CURRENT) != 0
        )
    }

    @Test
    fun backoffGrowsExponentiallyThenCaps() {
        assertEquals(1_000L, backoffBaseDelayMs(0, 1_000L, 30_000L))
        assertEquals(2_000L, backoffBaseDelayMs(1, 1_000L, 30_000L))
        assertEquals(4_000L, backoffBaseDelayMs(2, 1_000L, 30_000L))
        assertEquals(8_000L, backoffBaseDelayMs(3, 1_000L, 30_000L))
        assertEquals(30_000L, backoffBaseDelayMs(10, 1_000L, 30_000L))
    }

    @Test
    fun backoffClampsNegativeAttemptToBase() {
        assertEquals(1_000L, backoffBaseDelayMs(-1, 1_000L, 30_000L))
    }

    @Test
    fun resolveMaxStoredUsesConfiguredPositiveValue() {
        assertEquals(500, resolveMaxStored(500, 10_000))
    }

    @Test
    fun resolveMaxStoredFallsBackToDefaultWhenUnsetOrNonPositive() {
        assertEquals(10_000, resolveMaxStored(null, 10_000))
        assertEquals(10_000, resolveMaxStored(0, 10_000))
        assertEquals(10_000, resolveMaxStored(-5, 10_000))
    }
}
