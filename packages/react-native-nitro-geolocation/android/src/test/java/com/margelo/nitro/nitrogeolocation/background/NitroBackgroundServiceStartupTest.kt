package com.margelo.nitro.nitrogeolocation.background

import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class NitroBackgroundServiceStartupTest {
    @Test
    fun completionIsMatchedToItsServiceGeneration() {
        val startup = NitroBackgroundServiceStartup()
        val failure = IllegalStateException("foreground promotion failed")
        startup.begin(7L)
        startup.begin(8L)

        startup.foregroundPromoted(8L)
        assertFalse(startup.isComplete(8L))
        startup.providerRegistered(8L)
        startup.fail(7L, failure)

        assertNull(startup.await(8L, 10L))
        assertSame(failure, startup.await(7L, 10L))
    }

    @Test
    fun activityAwareStartupWaitsForBothProviders() {
        val startup = NitroBackgroundServiceStartup()
        startup.begin(9L, activityRequired = true)

        startup.foregroundPromoted(9L)
        startup.providerRegistered(9L)
        assertFalse(startup.isComplete(9L))

        startup.activityProviderRegistered(9L)
        assertTrue(startup.isComplete(9L))
        assertNull(startup.await(9L, 10L))
    }

    @Test
    fun continuousStartupOnlyWaitsForLocationProvider() {
        val startup = NitroBackgroundServiceStartup()
        startup.begin(10L)

        startup.foregroundPromoted(10L)
        startup.providerRegistered(10L)

        assertTrue(startup.isComplete(10L))
        assertNull(startup.await(10L, 10L))
    }

    @Test
    fun recoveredServiceCanRebuildReadinessWithoutAWaitingCaller() {
        val startup = NitroBackgroundServiceStartup()
        startup.beginIfAbsent(11L, activityRequired = true)

        startup.foregroundPromoted(11L)
        assertFalse(startup.providerRegistered(11L))
        assertTrue(startup.activityProviderRegistered(11L))
    }
}
