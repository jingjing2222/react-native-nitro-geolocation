package com.margelo.nitro.nitrogeolocation

import org.junit.Assert.assertEquals
import org.junit.Test

class AndroidLocationSettingsTest {
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
