package com.margelo.nitro.nitrogeolocation

import org.junit.Assert.assertEquals
import org.junit.Test

class AndroidProviderRouteTest {
    @Test
    fun autoPrefersFusedWhenGooglePlayServicesAreAvailable() {
        assertEquals(
            AndroidProviderRoute.FUSED,
            selectAndroidProviderRoute(
                locationProvider = LocationProvider.AUTO,
                googlePlayServicesAvailable = true
            )
        )
    }

    @Test
    fun playServicesPrefersFusedWhenGooglePlayServicesAreAvailable() {
        assertEquals(
            AndroidProviderRoute.FUSED,
            selectAndroidProviderRoute(
                locationProvider = LocationProvider.PLAYSERVICES,
                googlePlayServicesAvailable = true
            )
        )
    }

    @Test
    fun autoFallsBackToPlatformWhenGooglePlayServicesAreUnavailable() {
        assertEquals(
            AndroidProviderRoute.PLATFORM,
            selectAndroidProviderRoute(
                locationProvider = LocationProvider.AUTO,
                googlePlayServicesAvailable = false
            )
        )
    }

    @Test
    fun playServicesFallsBackToPlatformWhenGooglePlayServicesAreUnavailable() {
        assertEquals(
            AndroidProviderRoute.PLATFORM,
            selectAndroidProviderRoute(
                locationProvider = LocationProvider.PLAYSERVICES,
                googlePlayServicesAvailable = false
            )
        )
    }

    @Test
    fun platformProviderAlwaysUsesPlatformRoute() {
        assertEquals(
            AndroidProviderRoute.PLATFORM,
            selectAndroidProviderRoute(
                locationProvider = LocationProvider.ANDROID_PLATFORM,
                googlePlayServicesAvailable = true
            )
        )
    }

    @Test
    fun autoAndPlayServicesFallbackToPlatformAfterFusedRequestFailure() {
        assertEquals(
            AndroidProviderRoute.PLATFORM,
            selectAndroidFallbackRouteAfterFusedFailure(LocationProvider.AUTO)
        )
        assertEquals(
            AndroidProviderRoute.PLATFORM,
            selectAndroidFallbackRouteAfterFusedFailure(LocationProvider.PLAYSERVICES)
        )
    }

    @Test
    fun currentLastKnownAndWatchInvokePlatformFallbackAfterFusedRequestFailure() {
        assertInvokesPlatformFallback { platformFallback, failWithoutFallback ->
            runAndroidCurrentPositionFallbackAfterFusedFailure(
                locationProvider = LocationProvider.AUTO,
                runPlatformFallback = platformFallback,
                failWithoutFallback = failWithoutFallback
            )
        }
        assertInvokesPlatformFallback { platformFallback, failWithoutFallback ->
            runAndroidLastKnownPositionFallbackAfterFusedFailure(
                locationProvider = LocationProvider.PLAYSERVICES,
                runPlatformFallback = platformFallback,
                failWithoutFallback = failWithoutFallback
            )
        }
        assertInvokesPlatformFallback { platformFallback, failWithoutFallback ->
            runAndroidWatchPositionFallbackAfterFusedFailure(
                locationProvider = LocationProvider.AUTO,
                runPlatformFallback = platformFallback,
                failWithoutFallback = failWithoutFallback
            )
        }
    }

    private fun assertInvokesPlatformFallback(
        runFallback: (
            runPlatformFallback: () -> Unit,
            failWithoutFallback: () -> Unit
        ) -> Unit
    ) {
        var platformFallbackCalls = 0
        var errorCalls = 0

        runFallback(
            { platformFallbackCalls += 1 },
            { errorCalls += 1 }
        )

        assertEquals(1, platformFallbackCalls)
        assertEquals(0, errorCalls)
    }
}
