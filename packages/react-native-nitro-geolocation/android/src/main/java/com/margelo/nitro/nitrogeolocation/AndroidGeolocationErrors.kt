package com.margelo.nitro.nitrogeolocation

import android.os.SystemClock

internal const val NO_LOCATION_PROVIDER_AVAILABLE_MESSAGE = "No location provider available"
internal const val NO_APPROXIMATE_LOCATION_PROVIDER_AVAILABLE_MESSAGE =
    "No location provider is available for approximate location. " +
        "ACCESS_COARSE_LOCATION is granted, but no enabled coarse-compatible provider is available."

internal const val INTERNAL_ERROR = -1.0
internal const val PERMISSION_DENIED = 1.0
internal const val POSITION_UNAVAILABLE = 2.0
internal const val TIMEOUT = 3.0
internal const val PLAY_SERVICE_NOT_AVAILABLE = 4.0
internal const val SETTINGS_NOT_SATISFIED = 5.0

internal fun createLocationAvailability(
    available: Boolean,
    reason: String?
): LocationAvailability {
    return LocationAvailability(
        available = available,
        reason = reason
    )
}

internal fun createLocationError(code: Double, message: String): LocationError {
    return LocationError(
        code = code,
        message = message
    )
}

internal fun createPlayServicesUnavailableError(): LocationError {
    return createLocationError(
        PLAY_SERVICE_NOT_AVAILABLE,
        "Google Play Services location provider is not available."
    )
}

internal fun createPositionTimeoutError(options: ParsedOptions): LocationError {
    val timeoutSeconds = options.timeout / 1000.0
    val message = String.format("Unable to fetch location within %.1fs.", timeoutSeconds)
    return createLocationError(TIMEOUT, message)
}

internal fun createRequestDeadlineElapsedRealtime(timeout: Double): Long {
    val now = SystemClock.elapsedRealtime()
    val timeoutMillis = coerceTimeoutMillis(timeout)
    val maxTimeoutMillis = Long.MAX_VALUE - now

    return if (timeoutMillis >= maxTimeoutMillis) {
        Long.MAX_VALUE
    } else {
        now + timeoutMillis
    }
}

internal fun remainingTimeoutMillis(deadlineElapsedRealtime: Long): Long {
    return (deadlineElapsedRealtime - SystemClock.elapsedRealtime()).coerceAtLeast(0L)
}

internal fun coerceTimeoutMillis(timeout: Double): Long {
    return when {
        timeout.isNaN() || timeout <= 0.0 -> 0L
        timeout.isInfinite() || timeout >= Long.MAX_VALUE.toDouble() -> Long.MAX_VALUE
        else -> timeout.toLong()
    }
}

internal fun coercePositiveMillis(value: Double): Long {
    return when {
        value.isNaN() || value <= 0.0 -> 1L
        value.isInfinite() || value >= Long.MAX_VALUE.toDouble() -> Long.MAX_VALUE
        else -> value.toLong()
    }
}

internal fun coerceNonNegativeMillis(value: Double): Long {
    return when {
        value.isNaN() || value <= 0.0 -> 0L
        value.isInfinite() || value >= Long.MAX_VALUE.toDouble() -> Long.MAX_VALUE
        else -> value.toLong()
    }
}
