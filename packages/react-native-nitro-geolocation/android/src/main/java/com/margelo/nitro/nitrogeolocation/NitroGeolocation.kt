package com.margelo.nitro.nitrogeolocation

import android.Manifest
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager as AndroidLocationManager
import android.os.Build
import android.os.CancellationSignal
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.bridge.ReactApplicationContext
import com.margelo.nitro.core.Promise
import com.margelo.nitro.NitroModules
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * Exception wrapper for LocationError struct.
 * Nitrogen-generated LocationError doesn't extend Exception,
 * so we need to wrap it for Promise.reject().
 */
private class GeolocationErrorException(
    val locationError: LocationError
) : Exception(locationError.message)

/**
 * Modern Geolocation implementation for Android.
 *
 * Key features:
 * - Promise-based permission and getCurrentPosition
 * - Token-based watch subscriptions (first-class functions!)
 * - WatchPositionResult discriminated union
 * - Automatic subscription management
 */
@DoNotStrip
class NitroGeolocation(
    private val reactContext: ReactApplicationContext
) : HybridNitroGeolocationSpec() {

    // MARK: - Types

    private data class ParsedOptions(
        val timeout: Double,
        val maximumAge: Double,
        val enableHighAccuracy: Boolean,
        val interval: Double,
        val fastestInterval: Double,
        val distanceFilter: Double
    ) {
        companion object {
            private const val DEFAULT_TIMEOUT = 10.0 * 60 * 1000 // 10 minutes in ms
            private const val DEFAULT_MAXIMUM_AGE = 0.0
            private const val DEFAULT_INTERVAL = 1000.0
            private const val DEFAULT_FASTEST_INTERVAL = 100.0
            private const val DEFAULT_DISTANCE_FILTER = 0.0

            fun parse(options: LocationRequestOptions?): ParsedOptions {
                return ParsedOptions(
                    timeout = options?.timeout ?: DEFAULT_TIMEOUT,
                    maximumAge = options?.maximumAge ?: DEFAULT_MAXIMUM_AGE,
                    enableHighAccuracy = options?.enableHighAccuracy ?: false,
                    interval = options?.interval ?: DEFAULT_INTERVAL,
                    fastestInterval = options?.fastestInterval ?: DEFAULT_FASTEST_INTERVAL,
                    distanceFilter = options?.distanceFilter ?: DEFAULT_DISTANCE_FILTER
                )
            }
        }
    }

    private data class WatchSubscription(
        val token: String,
        val success: (GeolocationResponse) -> Unit,
        val error: ((LocationError) -> Unit)?,
        val options: ParsedOptions
    )

    private data class PositionRequest(
        val id: UUID,
        val resolver: (Result<GeolocationResponse>) -> Unit,
        val options: ParsedOptions,
        val handler: Handler,
        var cancellationSignal: CancellationSignal? = null
    )

    // MARK: - Properties

    private var configuration: ModernGeolocationConfiguration? = null
    private val locationManager: AndroidLocationManager by lazy {
        reactContext.getSystemService(ReactApplicationContext.LOCATION_SERVICE) as AndroidLocationManager
    }

    // Permission promise resolvers
    private val pendingPermissionResolvers = mutableListOf<(Result<PermissionStatus>) -> Unit>()

    // getCurrentPosition requests
    private val pendingPositionRequests = ConcurrentHashMap<UUID, PositionRequest>()

    // Watch subscriptions (token -> callback)
    private val watchSubscriptions = ConcurrentHashMap<String, WatchSubscription>()

    // Location listener for watch subscriptions
    private var watchLocationListener: LocationListener? = null
    private var currentWatchProvider: String? = null

    // Error codes
    private val PERMISSION_DENIED = 1.0
    private val POSITION_UNAVAILABLE = 2.0
    private val TIMEOUT = 3.0

    // MARK: - Configuration

    override fun setConfiguration(config: ModernGeolocationConfiguration) {
        this.configuration = config
    }

    // MARK: - Permission API (Promise-based)

    override fun checkPermission(): Promise<PermissionStatus> {
        return Promise.async {
            val status = getCurrentPermissionStatus()
            status
        }
    }

    override fun requestPermission(): Promise<PermissionStatus> {
        return Promise.async { resolver ->
            // Check if already determined
            val currentStatus = getCurrentPermissionStatus()
            if (currentStatus != PermissionStatus.undetermined) {
                resolver(Result.success(currentStatus))
                return@async
            }

            // Check if we have an activity
            val activity = reactContext.currentActivity
            if (activity == null) {
                resolver(Result.failure(Exception("No activity available")))
                return@async
            }

            // Queue resolver
            pendingPermissionResolvers.add(resolver)

            // Request permission
            val permissions = arrayOf(
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            )

            ActivityCompat.requestPermissions(
                activity,
                permissions,
                PERMISSION_REQUEST_CODE
            )
        }
    }

    // MARK: - Get Current Position (Promise-based)

    override fun getCurrentPosition(options: LocationRequestOptions?): Promise<GeolocationResponse> {
        return Promise.async { resolver ->
            // Check permission
            if (!hasLocationPermission()) {
                resolver(Result.failure(createLocationError(
                    PERMISSION_DENIED,
                    "Location permission not granted"
                )))
                return@async
            }

            val parsedOptions = ParsedOptions.parse(options)

            // Check cached location
            val provider = getValidProvider(parsedOptions.enableHighAccuracy)
            if (provider != null) {
                val lastKnownLocation = try {
                    locationManager.getLastKnownLocation(provider)
                } catch (e: SecurityException) {
                    null
                }

                if (lastKnownLocation != null && isCachedLocationValid(lastKnownLocation, parsedOptions)) {
                    val position = locationToPosition(lastKnownLocation)
                    resolver(Result.success(position))
                    return@async
                }

                // maximumAge is Infinity -> use cached if available
                if (lastKnownLocation != null && parsedOptions.maximumAge == Double.POSITIVE_INFINITY) {
                    val position = locationToPosition(lastKnownLocation)
                    resolver(Result.success(position))
                    return@async
                }
            }

            // Request fresh location
            if (provider == null) {
                resolver(Result.failure(createLocationError(
                    POSITION_UNAVAILABLE,
                    "No location provider available"
                )))
                return@async
            }

            requestFreshLocation(provider, parsedOptions, resolver)
        }
    }

    // MARK: - Watch Position (Callback-based with tokens)

    override fun watchPosition(
        success: (GeolocationResponse) -> Unit,
        error: ((LocationError) -> Unit)?,
        options: LocationRequestOptions?
    ): String {
        val token = UUID.randomUUID().toString()
        val parsedOptions = ParsedOptions.parse(options)

        val subscription = WatchSubscription(
            token = token,
            success = success,
            error = error,
            options = parsedOptions
        )

        watchSubscriptions[token] = subscription

        // Start watching if first subscriber
        if (watchSubscriptions.size == 1) {
            startWatchingLocation()
        }

        return token
    }

    override fun unwatch(token: String) {
        watchSubscriptions.remove(token)

        // Stop watching if no more subscribers
        if (watchSubscriptions.isEmpty()) {
            stopWatchingLocation()
        }
    }

    override fun stopObserving() {
        watchSubscriptions.clear()
        stopWatchingLocation()
    }

    // MARK: - Helper Functions - Permission

    private fun getCurrentPermissionStatus(): PermissionStatus {
        // Legacy Android (< 6.0)
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            return PermissionStatus.granted
        }

        val fineLocationGranted = ContextCompat.checkSelfPermission(
            reactContext,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        val coarseLocationGranted = ContextCompat.checkSelfPermission(
            reactContext,
            Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        return when {
            fineLocationGranted || coarseLocationGranted -> PermissionStatus.granted
            else -> {
                // On Android, there's no "restricted" state like iOS
                // We could check if permission was previously denied, but for simplicity:
                PermissionStatus.denied
            }
        }
    }

    private fun hasLocationPermission(): Boolean {
        return getCurrentPermissionStatus() == PermissionStatus.granted
    }

    // Handle permission request result (called from Activity)
    fun onPermissionResult(requestCode: Int, grantResults: IntArray) {
        if (requestCode != PERMISSION_REQUEST_CODE) return

        val granted = grantResults.isNotEmpty() && grantResults.any { it == PackageManager.PERMISSION_GRANTED }
        val status = if (granted) PermissionStatus.granted else PermissionStatus.denied

        // Resolve all pending permission requests
        for (resolver in pendingPermissionResolvers) {
            resolver(Result.success(status))
        }
        pendingPermissionResolvers.clear()
    }

    // MARK: - Helper Functions - Provider Selection

    private fun getValidProvider(highAccuracy: Boolean): String? {
        val preferredProvider = if (highAccuracy)
            AndroidLocationManager.GPS_PROVIDER
        else
            AndroidLocationManager.NETWORK_PROVIDER

        val fallbackProvider = if (highAccuracy)
            AndroidLocationManager.NETWORK_PROVIDER
        else
            AndroidLocationManager.GPS_PROVIDER

        return when {
            isProviderValid(preferredProvider) -> preferredProvider
            isProviderValid(fallbackProvider) -> fallbackProvider
            else -> null
        }
    }

    private fun isProviderValid(provider: String): Boolean {
        return try {
            locationManager.isProviderEnabled(provider)
        } catch (e: Exception) {
            false
        }
    }

    // MARK: - Helper Functions - Cache Validation

    private fun isCachedLocationValid(location: Location, options: ParsedOptions): Boolean {
        val locationAge = SystemClock.elapsedRealtime() - location.elapsedRealtimeNanos / 1_000_000
        return locationAge < options.maximumAge
    }

    // MARK: - Helper Functions - Request Fresh Location

    private fun requestFreshLocation(
        provider: String,
        options: ParsedOptions,
        resolver: (Result<GeolocationResponse>) -> Unit
    ) {
        val id = UUID.randomUUID()
        val handler = Handler(Looper.getMainLooper())

        val request = PositionRequest(
            id = id,
            resolver = resolver,
            options = options,
            handler = handler
        )

        pendingPositionRequests[id] = request

        // Use modern API on Android 11+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            requestCurrentLocationModern(provider, options, id, handler)
        } else {
            requestCurrentLocationLegacy(provider, options, id, handler)
        }
    }

    @androidx.annotation.RequiresApi(Build.VERSION_CODES.R)
    private fun requestCurrentLocationModern(
        provider: String,
        options: ParsedOptions,
        requestId: UUID,
        handler: Handler
    ) {
        val cancellationSignal = CancellationSignal()

        // Timeout handler
        val timeoutRunnable = Runnable {
            handlePositionTimeout(requestId)
        }

        try {
            locationManager.getCurrentLocation(
                provider,
                cancellationSignal,
                { runnable -> handler.post(runnable) }
            ) { location ->
                handler.removeCallbacks(timeoutRunnable)

                val request = pendingPositionRequests.remove(requestId)
                if (request != null) {
                    if (location != null) {
                        val position = locationToPosition(location)
                        request.resolver(Result.success(position))
                    } else {
                        request.resolver(Result.failure(createLocationError(
                            POSITION_UNAVAILABLE,
                            "Unable to get location"
                        )))
                    }
                }
            }

            handler.postDelayed(timeoutRunnable, options.timeout.toLong())

            pendingPositionRequests[requestId]?.cancellationSignal = cancellationSignal

        } catch (e: SecurityException) {
            pendingPositionRequests.remove(requestId)
            val request = pendingPositionRequests[requestId]
            request?.resolver(Result.failure(createLocationError(
                PERMISSION_DENIED,
                "Security exception: ${e.message}"
            )))
        }
    }

    private fun requestCurrentLocationLegacy(
        provider: String,
        options: ParsedOptions,
        requestId: UUID,
        handler: Handler
    ) {
        var isResolved = false
        var oldLocation: Location? = null

        val listener = object : LocationListener {
            override fun onLocationChanged(location: Location) {
                synchronized(this) {
                    if (!isResolved) {
                        val bestLocation = selectBestLocation(location, oldLocation)
                        if (bestLocation == location) {
                            isResolved = true
                            handler.removeCallbacksAndMessages(null)

                            try {
                                locationManager.removeUpdates(this)
                            } catch (e: Exception) {
                                // Ignore
                            }

                            val request = pendingPositionRequests.remove(requestId)
                            if (request != null) {
                                val position = locationToPosition(location)
                                request.resolver(Result.success(position))
                            }
                        }
                        oldLocation = location
                    }
                }
            }

            override fun onProviderDisabled(provider: String) {}
            override fun onProviderEnabled(provider: String) {}
            @Deprecated("Deprecated in Java")
            override fun onStatusChanged(provider: String?, status: Int, extras: android.os.Bundle?) {}
        }

        // Timeout handler
        val timeoutRunnable = Runnable {
            synchronized(listener) {
                if (!isResolved) {
                    isResolved = true
                    try {
                        locationManager.removeUpdates(listener)
                    } catch (e: Exception) {
                        // Ignore
                    }
                    handlePositionTimeout(requestId)
                }
            }
        }

        try {
            locationManager.requestLocationUpdates(
                provider,
                100, // min time (ms)
                1f,  // min distance (m)
                listener,
                Looper.getMainLooper()
            )

            handler.postDelayed(timeoutRunnable, options.timeout.toLong())

        } catch (e: SecurityException) {
            pendingPositionRequests.remove(requestId)?.resolver(Result.failure(createLocationError(
                PERMISSION_DENIED,
                "Security exception: ${e.message}"
            )))
        }
    }

    private fun selectBestLocation(newLocation: Location, currentBest: Location?): Location {
        if (currentBest == null) return newLocation

        val timeDelta = newLocation.time - currentBest.time
        val isSignificantlyNewer = timeDelta > TWO_MINUTES_MS
        val isSignificantlyOlder = timeDelta < -TWO_MINUTES_MS

        if (isSignificantlyNewer) return newLocation
        if (isSignificantlyOlder) return currentBest

        val accuracyDelta = (newLocation.accuracy - currentBest.accuracy).toInt()
        val isMoreAccurate = accuracyDelta < 0
        val isSignificantlyLessAccurate = accuracyDelta > 200
        val isNewer = timeDelta > 0
        val isLessAccurate = accuracyDelta > 0
        val isFromSameProvider = newLocation.provider == currentBest.provider

        return when {
            isMoreAccurate -> newLocation
            isNewer && !isLessAccurate -> newLocation
            isNewer && !isSignificantlyLessAccurate && isFromSameProvider -> newLocation
            else -> currentBest
        }
    }

    private fun handlePositionTimeout(requestId: UUID) {
        val request = pendingPositionRequests.remove(requestId)
        if (request != null) {
            request.cancellationSignal?.cancel()
            request.handler.removeCallbacksAndMessages(null)

            val timeoutSeconds = request.options.timeout / 1000.0
            val message = String.format("Unable to fetch location within %.1fs.", timeoutSeconds)
            val error = createLocationError(TIMEOUT, message)

            request.resolver(Result.failure(error))
        }
    }

    // MARK: - Helper Functions - Watch Position

    private fun startWatchingLocation() {
        // Determine best provider and options from all subscriptions
        var useHighAccuracy = false
        var smallestInterval = Double.MAX_VALUE
        var smallestDistanceFilter = Float.MAX_VALUE

        for ((_, subscription) in watchSubscriptions) {
            if (subscription.options.enableHighAccuracy) {
                useHighAccuracy = true
            }
            smallestInterval = minOf(smallestInterval, subscription.options.interval)
            smallestDistanceFilter = minOf(smallestDistanceFilter, subscription.options.distanceFilter.toFloat())
        }

        val provider = getValidProvider(useHighAccuracy) ?: return
        currentWatchProvider = provider

        val listener = object : LocationListener {
            override fun onLocationChanged(location: Location) {
                val position = locationToPosition(location)

                // Notify all subscribers
                for ((_, subscription) in watchSubscriptions) {
                    subscription.success(position)
                }
            }

            override fun onProviderDisabled(provider: String) {
                val error = createLocationError(POSITION_UNAVAILABLE, "Provider disabled: $provider")

                for ((_, subscription) in watchSubscriptions) {
                    subscription.error?.invoke(error)
                }
            }

            override fun onProviderEnabled(provider: String) {}
            @Deprecated("Deprecated in Java")
            override fun onStatusChanged(provider: String?, status: Int, extras: android.os.Bundle?) {}
        }

        watchLocationListener = listener

        try {
            locationManager.requestLocationUpdates(
                provider,
                smallestInterval.toLong(),
                smallestDistanceFilter,
                listener,
                Looper.getMainLooper()
            )
        } catch (e: SecurityException) {
            val error = createLocationError(PERMISSION_DENIED, "Permission denied: ${e.message}")

            for ((_, subscription) in watchSubscriptions) {
                subscription.error?.invoke(error)
            }
        }
    }

    private fun stopWatchingLocation() {
        watchLocationListener?.let { listener ->
            try {
                locationManager.removeUpdates(listener)
            } catch (e: Exception) {
                // Ignore
            }
        }
        watchLocationListener = null
        currentWatchProvider = null
    }

    // MARK: - Helper Functions - Conversion

    private fun locationToPosition(location: Location): GeolocationResponse {
        val altitude = if (location.hasAltitude()) location.altitude else 0.0
        val altitudeAccuracy = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && location.hasVerticalAccuracy()) {
            location.verticalAccuracyMeters.toDouble()
        } else {
            0.0
        }
        val heading = if (location.hasBearing()) location.bearing.toDouble() else -1.0
        val speed = if (location.hasSpeed()) location.speed.toDouble() else 0.0

        val coords = GeolocationCoordinates(
            latitude = location.latitude,
            longitude = location.longitude,
            altitude = Variant.ofVariantDouble(altitude),
            accuracy = location.accuracy.toDouble(),
            altitudeAccuracy = Variant.ofVariantDouble(altitudeAccuracy),
            heading = Variant.ofVariantDouble(heading),
            speed = Variant.ofVariantDouble(speed)
        )

        return GeolocationResponse(
            coords = coords,
            timestamp = location.time.toDouble()
        )
    }

    private fun createLocationError(code: Double, message: String): Exception {
        val locationError = LocationError(
            code = code,
            message = message
        )
        return GeolocationErrorException(locationError)
    }

    companion object {
        private const val PERMISSION_REQUEST_CODE = 8947
        private const val TWO_MINUTES_MS = 2 * 60 * 1000L
    }
}
