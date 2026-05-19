package com.margelo.nitro.nitrogeolocation

import org.junit.Assert.assertEquals
import org.junit.Test

class AndroidFusedLocationProviderTest {
    @Test
    fun initialUpdateMaxAgeHonorsMaxUpdateAgeWithoutMaximumAge() {
        assertEquals(
            60_000.0,
            fusedInitialUpdateMaxAge(
                options = parsedOptions(maximumAge = 0.0, maxUpdateAge = 60_000.0),
                effectiveMaximumAge = 0.0
            ),
            0.0
        )
    }

    @Test
    fun initialUpdateMaxAgeUsesEffectiveMaximumAgeWhenMaxUpdateAgeIsAbsent() {
        assertEquals(
            30_000.0,
            fusedInitialUpdateMaxAge(
                options = parsedOptions(maximumAge = 30_000.0, maxUpdateAge = null),
                effectiveMaximumAge = 30_000.0
            ),
            0.0
        )
    }

    @Test
    fun initialUpdateMaxAgePreservesExplicitZeroMaxUpdateAge() {
        assertEquals(
            0.0,
            fusedInitialUpdateMaxAge(
                options = parsedOptions(maximumAge = 60_000.0, maxUpdateAge = 0.0),
                effectiveMaximumAge = 0.0
            ),
            0.0
        )
    }

    private fun parsedOptions(
        maximumAge: Double,
        maxUpdateAge: Double?
    ): ParsedOptions {
        return ParsedOptions(
            timeout = 10_000.0,
            maximumAge = maximumAge,
            androidAccuracy = AndroidAccuracyResolution(
                mode = AndroidAccuracyMode.BALANCED,
                explicitPreset = null
            ),
            interval = 1_000.0,
            fastestInterval = 100.0,
            distanceFilter = 0.0,
            granularity = AndroidGranularity.PERMISSION,
            waitForAccurateLocation = false,
            maxUpdateAge = maxUpdateAge,
            maxUpdateDelay = 0.0,
            maxUpdates = null
        )
    }
}
