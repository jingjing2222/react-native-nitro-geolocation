package com.margelo.nitro.nitrogeolocation.background

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import com.google.android.gms.location.Granularity
import com.margelo.nitro.nitrogeolocation.*
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class NitroBackgroundConfigurationTest {
    private fun options(limit: Double? = null) = BackgroundLocationOptions(
        trackingMode = BackgroundTrackingMode.ACTIVITYAWARE,
        accuracy = null, granularity = AndroidGranularity.COARSE,
        interval = null, fastestInterval = null, distanceFilter = null,
        maxUpdateDelay = null, waitForAccurateLocation = null, persist = null,
        maxStoredLocations = limit, maxStoredEvents = limit,
        stopOnTerminate = null, startOnBoot = null,
        android = AndroidBackgroundLocationOptions(null,
            AndroidForegroundServiceOptions(null, "Tracking", "Active", null, null, null, null, null, null),
            null, null),
        ios = null, geofencing = null,
        activityRecognition = ActivityRecognitionOptions(true, null, null, null), sync = null
    )

    @Test
    fun storageLimitsAndActivityDefaultsSurviveProcessRestart() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val prefs = context.getSharedPreferences("config-test", Context.MODE_PRIVATE)
        for (limit in listOf(null, 0.0, -1.0, 200.0)) {
            val original = options(limit)
            NitroBackgroundConfigStore(prefs).persist(original)
            val restored = NitroBackgroundConfigStore(prefs).restore()!!
            assertEquals(limit, restored.maxStoredLocations)
            assertEquals(limit, restored.maxStoredEvents)
            assertEquals(maxStoredLocations(original), maxStoredLocations(restored))
            val still = DetectedActivity(DetectedActivityType.STILL, 100.0, 0.0)
            assertEquals(activityTrackingAction(original, still, true), activityTrackingAction(restored, still, true))
        }
        // Preserve the old fallback for pre-2.0 settings without presence metadata.
        prefs.edit().remove("maxStoredLocationsConfigured").putFloat("maxStoredLocations", 0f).commit()
        assertNull(NitroBackgroundConfigStore(prefs).restore()!!.maxStoredLocations)
    }

    @Test
    fun backgroundRequestHonorsExplicitCoarseGranularity() {
        assertEquals(Granularity.GRANULARITY_COARSE, buildBackgroundLocationRequest(options()).granularity)
        assertEquals(Granularity.GRANULARITY_PERMISSION_LEVEL,
            buildBackgroundLocationRequest(options().copy(granularity = null)).granularity)
    }

    @Test
    fun retryCountsCannotOverflowOrSilentlySkipEveryUpload() {
        assertEquals(4, httpSyncAttemptCount(true, null))
        assertEquals(1, httpSyncAttemptCount(true, 0.0))
        assertEquals(1, httpSyncAttemptCount(false, Double.NaN))
        for (invalid in listOf(Double.NaN, Double.POSITIVE_INFINITY, -1.0, 0.5, Int.MAX_VALUE.toDouble(), Double.MAX_VALUE)) {
            assertNull(httpSyncAttemptCount(true, invalid))
        }
    }
}
