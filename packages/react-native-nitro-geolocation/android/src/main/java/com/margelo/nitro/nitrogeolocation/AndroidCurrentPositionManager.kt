package com.margelo.nitro.nitrogeolocation

import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.CancellationSignal
import android.os.Handler
import android.os.Looper
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

internal class AndroidCurrentPositionManager(
    private val locationManager: LocationManager,
    private val isCachedLocationValid: (Location, ParsedOptions) -> Boolean,
    private val effectiveMaximumAge: (ParsedOptions) -> Double,
    private val createNoProviderError: (ParsedOptions) -> LocationError,
    private val createTimeoutError: (ParsedOptions) -> LocationError,
    private val locationToPosition: (Location) -> GeolocationResponse
) {
    private val pendingRequests = ConcurrentHashMap<String, PositionRequest>()

    fun requestFreshLocation(
        providers: List<String>,
        options: ParsedOptions,
        deadlineElapsedRealtime: Long,
        resolver: (PositionResult) -> Unit,
        requestId: String? = null,
        onCancellationReady: ((() -> Unit) -> Unit)? = null
    ) {
        val id = requestId ?: UUID.randomUUID().toString()
        val handler = Handler(Looper.getMainLooper())
        pendingRequests[id] = PositionRequest(
            id = id,
            resolver = resolver,
            options = options,
            handler = handler,
            providers = providers,
            deadlineElapsedRealtime = deadlineElapsedRealtime
        )
        onCancellationReady?.invoke { cancel(requestId = id) }
        requestFreshLocationForCurrentProvider(id)
    }

    private fun cancel(requestId: String) {
        val request = pendingRequests.remove(requestId) ?: return
        request.handler.removeCallbacksAndMessages(null)
        request.cancellationAction?.invoke()
        request.cancellationAction = null
    }

    private fun requestFreshLocationForCurrentProvider(requestId: String) {
        val request = pendingRequests[requestId] ?: return
        val provider = request.providers.getOrNull(request.providerIndex)
        val remainingTimeoutMillis = request.remainingTimeoutMillis()

        if (provider == null) {
            pendingRequests.remove(requestId)?.resolver(
                PositionResult.Failure(createNoProviderError(request.options))
            )
            return
        }

        if (remainingTimeoutMillis <= 0L) {
            pendingRequests.remove(requestId)?.resolver(
                PositionResult.Failure(createTimeoutError(request.options))
            )
            return
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R &&
            effectiveMaximumAge(request.options) > 0.0
        ) {
            requestCurrentLocationModern(
                provider,
                requestId,
                request.handler,
                remainingTimeoutMillis
            )
        } else {
            requestCurrentLocationLegacy(
                provider,
                requestId,
                request.handler,
                remainingTimeoutMillis
            )
        }
    }

    @androidx.annotation.RequiresApi(Build.VERSION_CODES.R)
    private fun requestCurrentLocationModern(
        provider: String,
        requestId: String,
        handler: Handler,
        timeoutMillis: Long
    ) {
        val cancellationSignal = CancellationSignal()
        val timeoutRunnable = Runnable { handlePositionTimeout(requestId) }

        try {
            locationManager.getCurrentLocation(
                provider,
                cancellationSignal,
                { runnable -> handler.post(runnable) }
            ) { location ->
                handler.removeCallbacks(timeoutRunnable)
                val request = pendingRequests[requestId]
                if (request != null) {
                    when {
                        location != null && isCachedLocationValid(location, request.options) -> {
                            pendingRequests.remove(requestId)
                            request.resolver(PositionResult.Success(locationToPosition(location)))
                        }
                        location != null -> retryCurrentLocationLegacyAfterStaleModern(
                            provider,
                            requestId,
                            handler,
                            request
                        )
                        else -> handleProviderFailure(
                            requestId,
                            createLocationError(
                                POSITION_UNAVAILABLE,
                                "Unable to get fresh location"
                            )
                        )
                    }
                }
            }

            handler.postDelayed(timeoutRunnable, timeoutMillis)
            val cleanup = {
                handler.removeCallbacksAndMessages(null)
                cancellationSignal.cancel()
            }
            installCancellationAction(requestId, cleanup)
        } catch (error: SecurityException) {
            handler.removeCallbacks(timeoutRunnable)
            handleProviderFailure(
                requestId,
                createLocationError(
                    PERMISSION_DENIED,
                    "Security exception: ${error.message}"
                )
            )
        }
    }

    private fun retryCurrentLocationLegacyAfterStaleModern(
        provider: String,
        requestId: String,
        handler: Handler,
        request: PositionRequest
    ) {
        request.cancellationAction?.invoke()
        request.cancellationAction = null
        val remainingTimeoutMillis = request.remainingTimeoutMillis()
        if (remainingTimeoutMillis <= 0L) {
            handlePositionTimeout(requestId)
            return
        }
        requestCurrentLocationLegacy(provider, requestId, handler, remainingTimeoutMillis)
    }

    private fun requestCurrentLocationLegacy(
        provider: String,
        requestId: String,
        handler: Handler,
        timeoutMillis: Long
    ) {
        var isResolved = false
        var oldLocation: Location? = null
        val listener = object : LocationListener {
            override fun onLocationChanged(location: Location) {
                synchronized(this) {
                    if (isResolved) return
                    val bestLocation = selectBestLocation(location, oldLocation)
                    if (bestLocation == location) {
                        isResolved = true
                        handler.removeCallbacksAndMessages(null)
                        runCatching { locationManager.removeUpdates(this) }
                        pendingRequests.remove(requestId)?.let { request ->
                            request.resolver(
                                PositionResult.Success(locationToPosition(location))
                            )
                        }
                    }
                    oldLocation = location
                }
            }

            override fun onProviderDisabled(provider: String) = Unit
            override fun onProviderEnabled(provider: String) = Unit

            @Deprecated("Deprecated in Java")
            override fun onStatusChanged(
                provider: String?,
                status: Int,
                extras: android.os.Bundle?
            ) = Unit
        }

        val timeoutRunnable = Runnable {
            synchronized(listener) {
                if (!isResolved) {
                    isResolved = true
                    runCatching { locationManager.removeUpdates(listener) }
                    handlePositionTimeout(requestId)
                }
            }
        }

        try {
            locationManager.requestLocationUpdates(
                provider,
                100,
                1f,
                listener,
                Looper.getMainLooper()
            )
            handler.postDelayed(timeoutRunnable, timeoutMillis)
            val cleanup = {
                synchronized(listener) {
                    isResolved = true
                    handler.removeCallbacksAndMessages(null)
                    runCatching { locationManager.removeUpdates(listener) }
                    Unit
                }
            }
            installCancellationAction(requestId, cleanup)
        } catch (error: SecurityException) {
            handleProviderFailure(
                requestId,
                createLocationError(
                    PERMISSION_DENIED,
                    "Security exception: ${error.message}"
                )
            )
        }
    }

    private fun installCancellationAction(requestId: String, cleanup: () -> Unit) {
        val request = pendingRequests[requestId]
        if (request != null) {
            request.cancellationAction = cleanup
            if (pendingRequests[requestId] !== request) cleanup()
        } else {
            cleanup()
        }
    }

    private fun handleProviderFailure(requestId: String, error: LocationError) {
        val request = pendingRequests[requestId] ?: return
        request.cancellationAction?.invoke()
        request.cancellationAction = null
        request.providerIndex += 1

        if (request.providerIndex < request.providers.size) {
            if (request.remainingTimeoutMillis() <= 0L) {
                pendingRequests.remove(requestId)?.resolver(
                    PositionResult.Failure(createTimeoutError(request.options))
                )
                return
            }
            requestFreshLocationForCurrentProvider(requestId)
            return
        }

        pendingRequests.remove(requestId)?.resolver(PositionResult.Failure(error))
    }

    private fun handlePositionTimeout(requestId: String) {
        val request = pendingRequests.remove(requestId) ?: return
        request.handler.removeCallbacksAndMessages(null)
        request.cancellationAction?.invoke()
        request.cancellationAction = null
        request.resolver(PositionResult.Failure(createTimeoutError(request.options)))
    }
}
