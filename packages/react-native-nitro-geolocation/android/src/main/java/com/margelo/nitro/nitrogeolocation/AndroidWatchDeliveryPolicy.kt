package com.margelo.nitro.nitrogeolocation

import kotlin.math.asin
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

internal data class AndroidWatchDeliveryState(
    val latitude: Double,
    val longitude: Double,
    val elapsedRealtimeMillis: Long
)

internal data class AndroidWatchDeliveryDecision(
    val shouldDeliver: Boolean,
    val nextState: AndroidWatchDeliveryState?
)

internal fun evaluateAndroidWatchDelivery(
    previous: AndroidWatchDeliveryState?,
    latitude: Double,
    longitude: Double,
    elapsedRealtimeMillis: Long,
    minimumIntervalMillis: Double,
    distanceFilterMeters: Double
): AndroidWatchDeliveryDecision {
    val candidate = AndroidWatchDeliveryState(latitude, longitude, elapsedRealtimeMillis)
    if (previous == null) return AndroidWatchDeliveryDecision(true, candidate)

    val elapsed = elapsedRealtimeMillis - previous.elapsedRealtimeMillis
    val intervalSatisfied = elapsed >= minimumIntervalMillis
    val distanceSatisfied = distanceFilterMeters == 0.0 ||
        distanceMeters(previous.latitude, previous.longitude, latitude, longitude) >=
        distanceFilterMeters
    return if (intervalSatisfied && distanceSatisfied) {
        AndroidWatchDeliveryDecision(true, candidate)
    } else {
        AndroidWatchDeliveryDecision(false, previous)
    }
}

private fun distanceMeters(
    fromLatitude: Double,
    fromLongitude: Double,
    toLatitude: Double,
    toLongitude: Double
): Double {
    val latitudeDelta = Math.toRadians(toLatitude - fromLatitude)
    val longitudeDelta = Math.toRadians(toLongitude - fromLongitude)
    val fromLatitudeRadians = Math.toRadians(fromLatitude)
    val toLatitudeRadians = Math.toRadians(toLatitude)
    val haversine = sin(latitudeDelta / 2).let { it * it } +
        cos(fromLatitudeRadians) * cos(toLatitudeRadians) *
        sin(longitudeDelta / 2).let { it * it }
    return 2 * 6_371_000.0 * asin(sqrt(haversine.coerceIn(0.0, 1.0)))
}
