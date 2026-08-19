package com.margelo.nitro.nitrogeolocation

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

class AndroidLocationSettingsTest {
    @Test
    fun locationSettingsRequestGateSerializesTheEntireRequestLifecycle() {
        val gate = LocationSettingsRequestGate<Any>()
        val firstRequest = Any()
        val secondRequest = Any()

        assertTrue(gate.tryBegin(firstRequest))
        assertSame(firstRequest, gate.current())
        assertFalse(gate.tryBegin(secondRequest))
        assertFalse(gate.finish(secondRequest))
        assertSame(firstRequest, gate.current())

        assertTrue(gate.finish(firstRequest))
        assertFalse(gate.finish(firstRequest))
        assertTrue(gate.tryBegin(secondRequest))
        assertSame(secondRequest, gate.current())
    }

    @Test
    fun resolvableFailureWithActivityShowsResolution() {
        assertEquals(
            LocationSettingsFailureAction.SHOW_RESOLUTION,
            selectLocationSettingsFailureAction(
                shouldShowResolution = true,
                isResolvable = true,
                hasActivity = true
            )
        )
    }

    @Test
    fun resolvableFailureWithoutActivityReportsActivityMissing() {
        assertEquals(
            LocationSettingsFailureAction.COMPLETE_ACTIVITY_MISSING,
            selectLocationSettingsFailureAction(
                shouldShowResolution = true,
                isResolvable = true,
                hasActivity = false
            )
        )
    }

    @Test
    fun unresolvableFailureReportsUnavailable() {
        assertEquals(
            LocationSettingsFailureAction.COMPLETE_UNAVAILABLE,
            selectLocationSettingsFailureAction(
                shouldShowResolution = true,
                isResolvable = false,
                hasActivity = true
            )
        )
    }

    @Test
    fun failedPostDialogRecheckReportsUnavailable() {
        assertEquals(
            LocationSettingsFailureAction.COMPLETE_UNAVAILABLE,
            selectLocationSettingsFailureAction(
                shouldShowResolution = false,
                isResolvable = true,
                hasActivity = true
            )
        )
    }
}
