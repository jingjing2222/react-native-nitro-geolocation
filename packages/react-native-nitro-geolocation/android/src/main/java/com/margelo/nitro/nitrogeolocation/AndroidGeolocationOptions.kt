package com.margelo.nitro.nitrogeolocation

import android.os.Handler
import android.os.SystemClock

internal data class ParsedOptions(
    val timeout: Double,
    val maximumAge: Double,
    val androidAccuracy: AndroidAccuracyResolution,
    val interval: Double,
    val fastestInterval: Double,
    val distanceFilter: Double,
    val granularity: AndroidGranularity,
    val waitForAccurateLocation: Boolean,
    val maxUpdateAge: Double?,
    val maxUpdateDelay: Double,
    val maxUpdates: Int?
) {
    companion object {
        private const val DEFAULT_TIMEOUT = 10.0 * 60 * 1000 // 10 minutes in ms
        private const val DEFAULT_MAXIMUM_AGE = 0.0
        private const val DEFAULT_INTERVAL = 1000.0
        private const val DEFAULT_FASTEST_INTERVAL = 100.0
        private const val DEFAULT_DISTANCE_FILTER = 0.0
        private const val DEFAULT_MAX_UPDATE_DELAY = 0.0

        fun parse(
            options: LocationRequestOptions?,
            defaultMaximumAge: Double = DEFAULT_MAXIMUM_AGE
        ): ParsedOptions {
            val maxUpdates = options?.maxUpdates?.let { value ->
                if (!value.isFinite()) {
                    0
                } else {
                    value.toInt()
                }
            }

            return ParsedOptions(
                timeout = options?.timeout ?: DEFAULT_TIMEOUT,
                maximumAge = options?.maximumAge ?: defaultMaximumAge,
                androidAccuracy = resolveAndroidAccuracy(
                    options?.accuracy,
                    enableHighAccuracy = false
                ),
                interval = options?.interval ?: DEFAULT_INTERVAL,
                fastestInterval = options?.fastestInterval ?: DEFAULT_FASTEST_INTERVAL,
                distanceFilter = options?.distanceFilter ?: DEFAULT_DISTANCE_FILTER,
                granularity = options?.granularity ?: AndroidGranularity.PERMISSION,
                waitForAccurateLocation = options?.waitForAccurateLocation ?: false,
                maxUpdateAge = options?.maxUpdateAge,
                maxUpdateDelay = options?.maxUpdateDelay ?: DEFAULT_MAX_UPDATE_DELAY,
                maxUpdates = maxUpdates
            )
        }

        fun parseLastKnown(options: LocationRequestOptions?): ParsedOptions {
            return parse(options, defaultMaximumAge = Double.POSITIVE_INFINITY)
        }
    }
}

internal data class WatchSubscription(
    val token: String,
    val success: (GeolocationResponse) -> Unit,
    val error: ((LocationError) -> Unit)?,
    val options: ParsedOptions,
    var deliveredUpdates: Int = 0
)

internal sealed interface PositionResult {
    data class Success(val position: GeolocationResponse) : PositionResult
    data class Failure(val error: LocationError) : PositionResult
}

internal data class PositionRequest(
    val id: String,
    val resolver: (PositionResult) -> Unit,
    val options: ParsedOptions,
    val handler: Handler,
    val providers: List<String>,
    val deadlineElapsedRealtime: Long,
    var providerIndex: Int = 0,
    @Volatile
    var cancellationAction: (() -> Unit)? = null
) {
    fun remainingTimeoutMillis(): Long {
        return (deadlineElapsedRealtime - SystemClock.elapsedRealtime()).coerceAtLeast(0L)
    }
}

internal class CurrentPositionCancellationState {
    private val lock = Any()
    private var active = true
    private var cancellationAction: (() -> Unit)? = null

    fun isActive(): Boolean = synchronized(lock) { active }

    fun setCancellationAction(action: () -> Unit) {
        val shouldCancel = synchronized(lock) {
            if (active) {
                cancellationAction = action
                false
            } else {
                true
            }
        }

        if (shouldCancel) action()
    }

    fun finish(): Boolean = synchronized(lock) {
        if (!active) return@synchronized false
        active = false
        cancellationAction = null
        true
    }

    fun cancel() {
        val action = synchronized(lock) {
            if (!active) return@synchronized null
            active = false
            cancellationAction.also { cancellationAction = null }
        }
        action?.invoke()
    }
}
