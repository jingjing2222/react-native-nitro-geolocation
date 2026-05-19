package com.margelo.nitro.nitrogeolocation

import android.location.Location
import android.os.Handler
import android.os.Looper
import com.google.android.gms.location.CurrentLocationRequest
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationResult
import com.google.android.gms.tasks.CancellationTokenSource
import java.util.concurrent.atomic.AtomicBoolean

private const val FUSED_ATTEMPT_TIMEOUT_MS = 15_000L
private const val FUSED_FALLBACK_RESERVED_TIMEOUT_MS = 10_000L

internal class AndroidFusedLocationProvider(
    private val fusedLocationClient: FusedLocationProviderClient,
    private val isCachedLocationValid: (Location, ParsedOptions) -> Boolean,
    private val effectiveMaximumAge: (ParsedOptions) -> Double,
    private val locationToPosition: (Location, LocationProviderUsed?) -> GeolocationResponse
) {
    fun getCurrentPosition(
        success: (GeolocationResponse) -> Unit,
        error: ((LocationError) -> Unit)?,
        options: ParsedOptions,
        deadlineElapsedRealtime: Long
    ) {
        if (effectiveMaximumAge(options) > 0.0) {
            getCachedLocation(options) { cachedLocation, fusedError ->
                if (cachedLocation != null) {
                    success(locationToPosition(cachedLocation, LocationProviderUsed.FUSED))
                    return@getCachedLocation
                }
                if (fusedError != null) {
                    error?.invoke(fusedError)
                    return@getCachedLocation
                }

                requestFreshLocation(success, error, options, deadlineElapsedRealtime)
            }
            return
        }

        requestFreshLocation(success, error, options, deadlineElapsedRealtime)
    }

    fun getLastKnownPosition(
        success: (GeolocationResponse) -> Unit,
        error: ((LocationError) -> Unit)?,
        options: ParsedOptions
    ) {
        getCachedLocation(options) { cachedLocation, fusedError ->
            if (cachedLocation != null) {
                success(locationToPosition(cachedLocation, LocationProviderUsed.FUSED))
                return@getCachedLocation
            }
            if (fusedError != null) {
                error?.invoke(fusedError)
                return@getCachedLocation
            }

            error?.invoke(createLocationError(
                POSITION_UNAVAILABLE,
                "No cached location available"
            ))
        }
    }

    fun requestWatchUpdates(
        options: ParsedOptions,
        callback: LocationCallback,
        onInactiveStart: () -> Unit,
        onFailure: (LocationError?) -> Unit
    ) {
        try {
            fusedLocationClient.requestLocationUpdates(
                buildFusedLocationRequest(options),
                callback,
                Looper.getMainLooper()
            )
                .addOnSuccessListener {
                    onInactiveStart()
                }
                .addOnFailureListener { exception ->
                    onFailure(createFusedRequestFailureError(exception))
                }
                .addOnCanceledListener {
                    onFailure(null)
                }
        } catch (e: SecurityException) {
            onFailure(createFusedSecurityError(e.message))
        } catch (_: Exception) {
            onFailure(null)
        }
    }

    private fun getCachedLocation(
        options: ParsedOptions,
        completion: (Location?, LocationError?) -> Unit
    ) {
        // Fused lastLocation is not requested with LocationRequest granularity,
        // so it cannot prove that a cached fix satisfies coarse-only callers.
        if (options.granularity == AndroidGranularity.COARSE) {
            completion(null, null)
            return
        }

        try {
            fusedLocationClient.lastLocation
                .addOnSuccessListener { location ->
                    completion(location?.takeIf { isCachedLocationValid(it, options) }, null)
                }
                .addOnFailureListener { exception ->
                    completion(null, createPermissionErrorOrNull(exception))
                }
                .addOnCanceledListener {
                    completion(null, null)
                }
        } catch (e: SecurityException) {
            completion(null, createFusedSecurityError(e.message))
        }
    }

    private fun requestFreshLocation(
        success: (GeolocationResponse) -> Unit,
        error: ((LocationError) -> Unit)?,
        options: ParsedOptions,
        deadlineElapsedRealtime: Long
    ) {
        val handler = Handler(Looper.getMainLooper())
        val didComplete = AtomicBoolean(false)
        val remainingTimeoutMillis = remainingTimeoutMillis(deadlineElapsedRealtime)

        if (remainingTimeoutMillis <= 0L) {
            error?.invoke(createPositionTimeoutError(options))
            return
        }
        val fusedAttemptTimeoutMillis = fusedAttemptTimeoutMillis(remainingTimeoutMillis)
        val cancellationTokenSource = CancellationTokenSource()
        var locationUpdateCallback: LocationCallback? = null

        fun complete(result: PositionResult) {
            if (!didComplete.compareAndSet(false, true)) return

            handler.removeCallbacksAndMessages(null)
            locationUpdateCallback?.let { callback ->
                try {
                    fusedLocationClient.removeLocationUpdates(callback)
                } catch (_: Exception) {
                    // Ignore cleanup races.
                }
            }
            locationUpdateCallback = null
            try {
                cancellationTokenSource.cancel()
            } catch (_: Exception) {
                // Ignore cleanup races.
            }

            when (result) {
                is PositionResult.Success -> success(result.position)
                is PositionResult.Failure -> error?.invoke(result.error)
            }
        }

        val timeoutRunnable = Runnable {
            complete(PositionResult.Failure(createPositionTimeoutError(options)))
        }

        try {
            if (options.waitForAccurateLocation) {
                val request = buildFusedLocationRequest(
                    options.copy(maxUpdateAge = effectiveMaximumAge(options)),
                    maxUpdatesOverride = 1,
                    includeDistanceFilter = false
                )
                val callback = object : LocationCallback() {
                    override fun onLocationResult(result: LocationResult) {
                        val location = result.lastLocation
                        if (location != null) {
                            complete(PositionResult.Success(
                                locationToPosition(location, LocationProviderUsed.FUSED)
                            ))
                        } else {
                            complete(PositionResult.Failure(createLocationError(
                                POSITION_UNAVAILABLE,
                                "Unable to get fused location"
                            )))
                        }
                    }
                }
                locationUpdateCallback = callback

                fusedLocationClient.requestLocationUpdates(
                    request,
                    callback,
                    Looper.getMainLooper()
                )
                    .addOnFailureListener { exception ->
                        complete(PositionResult.Failure(
                            createFusedRequestFailureError(exception)
                        ))
                    }
                    .addOnCanceledListener {
                        complete(PositionResult.Failure(createPositionTimeoutError(options)))
                    }

                handler.postDelayed(timeoutRunnable, fusedAttemptTimeoutMillis)
                return
            }

            val request = CurrentLocationRequest.Builder()
                .setPriority(options.androidAccuracy.gmsPriority())
                .setGranularity(options.granularity.gmsGranularity())
                .setMaxUpdateAgeMillis(
                    coerceNonNegativeMillis(effectiveMaximumAge(options))
                )
                .setDurationMillis(fusedAttemptTimeoutMillis)
                .build()

            fusedLocationClient.getCurrentLocation(
                request,
                cancellationTokenSource.token
            )
                .addOnSuccessListener { location ->
                    if (location != null) {
                        complete(PositionResult.Success(
                            locationToPosition(location, LocationProviderUsed.FUSED)
                        ))
                    } else {
                        complete(PositionResult.Failure(createLocationError(
                            POSITION_UNAVAILABLE,
                            "Unable to get fused location"
                        )))
                    }
                }
                .addOnFailureListener { exception ->
                    complete(PositionResult.Failure(
                        createFusedRequestFailureError(exception)
                    ))
                }
                .addOnCanceledListener {
                    complete(PositionResult.Failure(createPositionTimeoutError(options)))
                }

            handler.postDelayed(timeoutRunnable, fusedAttemptTimeoutMillis)
        } catch (e: SecurityException) {
            complete(PositionResult.Failure(createFusedSecurityError(e.message)))
        } catch (e: Exception) {
            complete(PositionResult.Failure(createLocationError(
                POSITION_UNAVAILABLE,
                "Unable to request fused location: ${e.message}"
            )))
        }
    }

    private fun createPermissionErrorOrNull(exception: Exception): LocationError? {
        return if (exception is SecurityException) {
            createFusedSecurityError(exception.message)
        } else {
            null
        }
    }
}

internal fun createFusedRequestFailureError(exception: Exception): LocationError {
    return if (exception is SecurityException) {
        createFusedSecurityError(exception.message)
    } else {
        createLocationError(
            POSITION_UNAVAILABLE,
            "Unable to request fused location: ${exception.message}"
        )
    }
}

internal fun createFusedSecurityError(message: String?): LocationError {
    return createLocationError(
        PERMISSION_DENIED,
        "Security exception: ${message ?: "unknown error"}"
    )
}

private fun fusedAttemptTimeoutMillis(remainingTimeoutMillis: Long): Long {
    if (remainingTimeoutMillis == Long.MAX_VALUE) {
        return FUSED_ATTEMPT_TIMEOUT_MS
    }

    if (remainingTimeoutMillis <= FUSED_FALLBACK_RESERVED_TIMEOUT_MS) {
        return (remainingTimeoutMillis / 2L).coerceAtLeast(1L)
    }

    return minOf(
        FUSED_ATTEMPT_TIMEOUT_MS,
        (remainingTimeoutMillis - FUSED_FALLBACK_RESERVED_TIMEOUT_MS).coerceAtLeast(1L)
    )
}
