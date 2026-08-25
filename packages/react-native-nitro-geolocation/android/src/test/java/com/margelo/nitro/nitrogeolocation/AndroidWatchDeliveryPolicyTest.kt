package com.margelo.nitro.nitrogeolocation

import org.junit.Assert.assertFalse
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

class AndroidWatchDeliveryPolicyTest {
    @Test
    fun `first update is delivered and establishes the subscription baseline`() {
        val decision = evaluateAndroidWatchDelivery(
            previous = null,
            latitude = 37.5665,
            longitude = 126.9780,
            elapsedRealtimeMillis = 1_000,
            minimumIntervalMillis = 10_000.0,
            distanceFilterMeters = 500.0
        )

        assertTrue(decision.shouldDeliver)
        assertTrue(decision.nextState != null)
    }

    @Test
    fun `each watch waits for its own interval and distance threshold`() {
        val baseline = AndroidWatchDeliveryState(37.5665, 126.9780, 1_000)

        val tooSoon = evaluateAndroidWatchDelivery(
            baseline,
            latitude = 37.5765,
            longitude = 126.9780,
            elapsedRealtimeMillis = 5_000,
            minimumIntervalMillis = 10_000.0,
            distanceFilterMeters = 500.0
        )
        assertFalse(tooSoon.shouldDeliver)
        assertSame(baseline, tooSoon.nextState)

        val tooNear = evaluateAndroidWatchDelivery(
            baseline,
            latitude = 37.5670,
            longitude = 126.9780,
            elapsedRealtimeMillis = 12_000,
            minimumIntervalMillis = 10_000.0,
            distanceFilterMeters = 500.0
        )
        assertFalse(tooNear.shouldDeliver)
        assertSame(baseline, tooNear.nextState)

        val eligible = evaluateAndroidWatchDelivery(
            baseline,
            latitude = 37.5765,
            longitude = 126.9780,
            elapsedRealtimeMillis = 12_000,
            minimumIntervalMillis = 10_000.0,
            distanceFilterMeters = 500.0
        )
        assertTrue(eligible.shouldDeliver)
        assertTrue(eligible.nextState !== baseline)
    }

    @Test
    fun `suppressed updates do not move the distance baseline`() {
        val baseline = AndroidWatchDeliveryState(37.5665, 126.9780, 1_000)
        val firstNear = evaluateAndroidWatchDelivery(
            baseline,
            latitude = 37.5695,
            longitude = 126.9780,
            elapsedRealtimeMillis = 2_000,
            minimumIntervalMillis = 0.0,
            distanceFilterMeters = 500.0
        )
        val secondCumulative = evaluateAndroidWatchDelivery(
            firstNear.nextState,
            latitude = 37.5725,
            longitude = 126.9780,
            elapsedRealtimeMillis = 3_000,
            minimumIntervalMillis = 0.0,
            distanceFilterMeters = 500.0
        )

        assertFalse(firstNear.shouldDeliver)
        assertTrue(secondCumulative.shouldDeliver)
    }
}
