package com.margelo.nitro.nitrogeolocation

import com.google.android.gms.common.api.ApiException
import com.google.android.gms.common.api.CommonStatusCodes
import com.google.android.gms.common.api.Status
import com.google.android.gms.location.LocationSettingsStatusCodes
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
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
    fun activityResultIsConsumedOnlyWhileAwaitingResolution() {
        val gate = LocationSettingsRequestGate<Any>()
        val request = Any()
        val unrelatedRequest = Any()

        assertTrue(gate.tryBegin(request))
        assertNull(gate.consumeResolutionResult())
        assertFalse(gate.beginAwaitingResolution(unrelatedRequest))
        assertTrue(gate.beginAwaitingResolution(request))
        assertSame(request, gate.consumeResolutionResult())
        assertNull(gate.consumeResolutionResult())
        assertTrue(gate.beginCompleting(request))
        assertNull(gate.consumeResolutionResult())
    }

    @Test
    fun synchronousOperationFailureIsReportedInsteadOfEscaping() {
        val expected = IllegalStateException("manifest unavailable")
        var reported: Exception? = null

        val result = runLocationSettingsOperation(
            onFailure = { reported = it }
        ) {
            throw expected
        }

        assertNull(result)
        assertSame(expected, reported)
    }

    @Test
    fun resolvableFailureWithActivityShowsResolution() {
        assertEquals(
            LocationSettingsFailureAction.SHOW_RESOLUTION,
            selectLocationSettingsFailureAction(
                shouldShowResolution = true,
                failureKind = LocationSettingsFailureKind.RESOLVABLE,
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
                failureKind = LocationSettingsFailureKind.RESOLVABLE,
                hasActivity = false
            )
        )
    }

    @Test
    fun settingsChangeUnavailableReportsUnavailable() {
        assertEquals(
            LocationSettingsFailureAction.COMPLETE_UNAVAILABLE,
            selectLocationSettingsFailureAction(
                shouldShowResolution = true,
                failureKind = LocationSettingsFailureKind.SETTINGS_CHANGE_UNAVAILABLE,
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
                failureKind = LocationSettingsFailureKind.RESOLVABLE,
                hasActivity = true
            )
        )
    }

    @Test
    fun cancelledSettingsCheckRejectsTheRequest() {
        assertEquals(
            LocationSettingsFailureAction.REJECT_REQUEST,
            selectLocationSettingsFailureAction(
                shouldShowResolution = true,
                failureKind = LocationSettingsFailureKind.CANCELLED,
                hasActivity = true
            )
        )
    }

    @Test
    fun unexpectedApiFailureRejectsTheRequest() {
        assertEquals(
            LocationSettingsFailureAction.REJECT_REQUEST,
            selectLocationSettingsFailureAction(
                shouldShowResolution = true,
                failureKind = LocationSettingsFailureKind.UNEXPECTED,
                hasActivity = true
            )
        )
    }

    @Test
    fun onlySettingsChangeUnavailableIsAnExpectedUnavailableResult() {
        assertEquals(
            LocationSettingsFailureKind.SETTINGS_CHANGE_UNAVAILABLE,
            classifyLocationSettingsFailure(ApiException(Status(
                LocationSettingsStatusCodes.SETTINGS_CHANGE_UNAVAILABLE
            )))
        )
        assertEquals(
            LocationSettingsFailureKind.UNEXPECTED,
            classifyLocationSettingsFailure(ApiException(Status(
                CommonStatusCodes.INTERNAL_ERROR
            )))
        )
    }
}
