package com.margelo.nitro.nitrogeolocation

import android.Manifest
import android.content.Context
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
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.margelo.nitro.NitroModules
import com.margelo.nitro.core.Promise
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

private const val NO_LOCATION_PROVIDER_AVAILABLE_MESSAGE = "No location provider available"
private const val NO_APPROXIMATE_LOCATION_PROVIDER_AVAILABLE_MESSAGE =
    "No location provider is available for approximate location. " +
        "ACCESS_COARSE_LOCATION is granted, but no enabled coarse-compatible provider is available."

/**
 * Geolocation implementation for Android.
 *
 * Key features:
 * - Callback-based native permission and getCurrentPosition for structured errors
 * - Token-based watch subscriptions (first-class functions!)
 * - WatchPositionResult discriminated union
 * - Automatic subscription management
 */
@DoNotStrip
class NitroGeolocation(
    private val reactContext: ReactApplicationContext = NitroModules.applicationContext!!
) : HybridNitroGeolocationSpec() {

    // MARK: - Types

    private data class ParsedOptions(
        val timeout: Double,
        val maximumAge: Double,
        val androidAccuracy: AndroidAccuracyResolution,
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
                val enableHighAccuracy = options?.enableHighAccuracy ?: false
                return ParsedOptions(
                    timeout = options?.timeout ?: DEFAULT_TIMEOUT,
                    maximumAge = options?.maximumAge ?: DEFAULT_MAXIMUM_AGE,
                    androidAccuracy = resolveAndroidAccuracy(
                        options?.accuracy,
                        enableHighAccuracy
                    ),
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

    private sealed interface PositionResult {
        data class Success(val position: GeolocationResponse) : PositionResult
        data class Failure(val error: LocationError) : PositionResult
    }

    private data class PositionRequest(
        val id: UUID,
        val resolver: (PositionResult) -> Unit,
        val options: ParsedOptions,
        val handler: Handler,
        val providers: List<String>,
        val deadlineElapsedRealtime: Long,
        var providerIndex: Int = 0,
        var cancellationSignal: CancellationSignal? = null
    ) {
        fun remainingTimeoutMillis(): Long {
            return (deadlineElapsedRealtime - SystemClock.elapsedRealtime()).coerceAtLeast(0L)
        }
    }

    // MARK: - Properties

    private var configuration: GeolocationConfiguration? = null
    private val locationManager: AndroidLocationManager by lazy {
        reactContext.getSystemService(Context.LOCATION_SERVICE) as AndroidLocationManager
    }
    private val locationSettings: AndroidLocationSettings by lazy {
        AndroidLocationSettings(
            reactContext = reactContext,
            locationManager = locationManager,
            createLocationError = ::createLocationError,
            createPlayServicesUnavailableError = ::createPlayServicesUnavailableError
        )
    }

    // Permission callbacks
    private val pendingPermissionResolvers = mutableListOf<(PermissionStatus) -> Unit>()

    // getCurrentPosition requests
    private val pendingPositionRequests = ConcurrentHashMap<UUID, PositionRequest>()

    // Watch subscriptions (token -> callback)
    private val watchSubscriptions = ConcurrentHashMap<String, WatchSubscription>()

    // Location listener for watch subscriptions
    private var watchLocationListener: LocationListener? = null
    private var currentWatchProvider: String? = null

    // Error codes
    private val INTERNAL_ERROR = -1.0
    private val PERMISSION_DENIED = 1.0
    private val POSITION_UNAVAILABLE = 2.0
    private val TIMEOUT = 3.0
    private val PLAY_SERVICE_NOT_AVAILABLE = 4.0
    private val SETTINGS_NOT_SATISFIED = 5.0

    // MARK: - Configuration

    override fun setConfiguration(config: GeolocationConfiguration) {
        this.configuration = config
    }

    // MARK: - Permission API

    override fun checkPermission(): Promise<PermissionStatus> {
        return Promise.async {
            val status = getCurrentPermissionStatus()
            status
        }
    }

    override fun requestPermission(
        success: (PermissionStatus) -> Unit,
        error: ((LocationError) -> Unit)?
    ): Unit {
        // Check if already determined
        val currentStatus = getCurrentPermissionStatus()
        if (currentStatus != PermissionStatus.UNDETERMINED) {
            success(currentStatus)
            return
        }

        // Check if we have an activity
        val activity = reactContext.currentActivity
        if (activity == null) {
            error?.invoke(createLocationError(
                INTERNAL_ERROR,
                "No activity available"
            ))
            return
        }

        // Queue resolver
        pendingPermissionResolvers.add(success)

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

    // MARK: - Provider/Settings API

    override fun hasServicesEnabled(): Promise<Boolean> {
        return Promise.async {
            locationSettings.hasServicesEnabled()
        }
    }

    override fun getProviderStatus(): Promise<LocationProviderStatus> {
        return Promise.async {
            locationSettings.getProviderStatus()
        }
    }

    override fun requestLocationSettings(
        success: (LocationProviderStatus) -> Unit,
        error: ((LocationError) -> Unit)?,
        options: LocationSettingsOptions?
    ) {
        locationSettings.requestLocationSettings(success, error, options)
    }

    // MARK: - Get Current Position

    override fun getCurrentPosition(
        success: (GeolocationResponse) -> Unit,
        error: ((LocationError) -> Unit)?,
        options: LocationRequestOptions?
    ): Unit {
        // Check permission
        if (!hasLocationPermission()) {
            error?.invoke(createLocationError(
                PERMISSION_DENIED,
                "Location permission not granted"
            ))
            return
        }

        val parsedOptions = ParsedOptions.parse(options)
        if (requiresPlayServices() && !isGooglePlayServicesAvailable()) {
            error?.invoke(createPlayServicesUnavailableError())
            return
        }

        val providers = getValidProviders(parsedOptions.androidAccuracy)
        if (providers.isEmpty()) {
            error?.invoke(createNoLocationProviderError(parsedOptions))
            return
        }

        val cachedLocation = getBestCachedLocation(providers, parsedOptions)
        if (cachedLocation != null) {
            success(locationToPosition(cachedLocation))
            return
        }

        // Request fresh location
        requestFreshLocation(providers, parsedOptions) { result ->
            when (result) {
                is PositionResult.Success -> success(result.position)
                is PositionResult.Failure -> error?.invoke(result.error)
            }
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
        } else {
            restartWatchingLocation()
        }

        return token
    }

    override fun unwatch(token: String) {
        watchSubscriptions.remove(token)

        // Stop watching if no more subscribers
        if (watchSubscriptions.isEmpty()) {
            stopWatchingLocation()
        } else {
            restartWatchingLocation()
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
            return PermissionStatus.GRANTED
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
            fineLocationGranted || coarseLocationGranted -> PermissionStatus.GRANTED
            else -> {
                // On Android, there's no "restricted" state like iOS
                // We could check if permission was previously denied, but for simplicity:
                PermissionStatus.DENIED
            }
        }
    }

    private fun hasLocationPermission(): Boolean {
        return getCurrentPermissionStatus() == PermissionStatus.GRANTED
    }

    private fun hasFineLocationPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            reactContext,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
    }

    private fun hasCoarseLocationPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            reactContext,
            Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
    }

    // Handle permission request result (called from Activity)
    fun onPermissionResult(requestCode: Int, grantResults: IntArray) {
        if (requestCode != PERMISSION_REQUEST_CODE) return

        val granted = grantResults.isNotEmpty() && grantResults.any { it == PackageManager.PERMISSION_GRANTED }
        val status = if (granted) PermissionStatus.GRANTED else PermissionStatus.DENIED

        // Resolve all pending permission requests
        for (resolver in pendingPermissionResolvers) {
            resolver(status)
        }
        pendingPermissionResolvers.clear()
    }

    // MARK: - Helper Functions - Provider Selection

    private fun requiresPlayServices(): Boolean {
        return configuration?.locationProvider == LocationProvider.PLAYSERVICES
    }

    private fun isGooglePlayServicesAvailable(): Boolean {
        return GoogleApiAvailability.getInstance()
            .isGooglePlayServicesAvailable(reactContext) == ConnectionResult.SUCCESS
    }

    private fun getValidProvider(accuracy: AndroidAccuracyResolution): String? {
        return getValidProviders(accuracy).firstOrNull()
    }

    private fun getValidProviders(accuracy: AndroidAccuracyResolution): List<String> {
        return accuracy.providerOrder()
            .distinct()
            .filter { provider -> isProviderValid(provider) }
    }

    private fun isProviderValid(provider: String): Boolean {
        return try {
            if (!locationManager.isProviderEnabled(provider)) return false

            when (provider) {
                AndroidLocationManager.GPS_PROVIDER -> hasFineLocationPermission()
                AndroidLocationManager.NETWORK_PROVIDER -> hasCoarseLocationPermission() || hasFineLocationPermission()
                AndroidLocationManager.PASSIVE_PROVIDER -> hasLocationPermission()
                else -> hasLocationPermission()
            }
        } catch (e: Exception) {
            false
        }
    }

    private fun createNoLocationProviderError(options: ParsedOptions): LocationError {
        return createLocationError(
            SETTINGS_NOT_SATISFIED,
            getNoLocationProviderMessage(options)
        )
    }

    private fun getNoLocationProviderMessage(options: ParsedOptions): String {
        if (
            options.androidAccuracy.mode != AndroidAccuracyMode.HIGH &&
            hasCoarseLocationPermission() &&
            !hasFineLocationPermission()
        ) {
            return NO_APPROXIMATE_LOCATION_PROVIDER_AVAILABLE_MESSAGE
        }

        return NO_LOCATION_PROVIDER_AVAILABLE_MESSAGE
    }

    // MARK: - Helper Functions - Cache Validation

    private fun isCachedLocationValid(location: Location, options: ParsedOptions): Boolean {
        val locationAge = SystemClock.elapsedRealtime() - location.elapsedRealtimeNanos / 1_000_000
        return locationAge < options.maximumAge
    }

    private fun getBestCachedLocation(providers: List<String>, options: ParsedOptions): Location? {
        var bestLocation: Location? = null

        for (provider in providers) {
            val lastKnownLocation = try {
                locationManager.getLastKnownLocation(provider)
            } catch (e: SecurityException) {
                null
            }

            if (
                lastKnownLocation != null &&
                (isCachedLocationValid(lastKnownLocation, options) ||
                    options.maximumAge == Double.POSITIVE_INFINITY)
            ) {
                bestLocation = selectBestLocation(lastKnownLocation, bestLocation)
            }
        }

        return bestLocation
    }

    // MARK: - Helper Functions - Request Fresh Location

    private fun requestFreshLocation(
        providers: List<String>,
        options: ParsedOptions,
        resolver: (PositionResult) -> Unit
    ) {
        val id = UUID.randomUUID()
        val handler = Handler(Looper.getMainLooper())

        val request = PositionRequest(
            id = id,
            resolver = resolver,
            options = options,
            handler = handler,
            providers = providers,
            deadlineElapsedRealtime = createRequestDeadlineElapsedRealtime(options.timeout)
        )

        pendingPositionRequests[id] = request
        requestFreshLocationForCurrentProvider(id)
    }

    private fun requestFreshLocationForCurrentProvider(requestId: UUID) {
        val request = pendingPositionRequests[requestId] ?: return
        val provider = request.providers.getOrNull(request.providerIndex)
        val remainingTimeoutMillis = request.remainingTimeoutMillis()

        if (provider == null) {
            pendingPositionRequests.remove(requestId)?.resolver(
                PositionResult.Failure(createNoLocationProviderError(request.options))
            )
            return
        }

        if (remainingTimeoutMillis <= 0L) {
            pendingPositionRequests.remove(requestId)?.resolver(
                PositionResult.Failure(createPositionTimeoutError(request.options))
            )
            return
        }

        // Use the Android 11+ platform API when available.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            requestCurrentLocationModern(provider, requestId, request.handler, remainingTimeoutMillis)
        } else {
            requestCurrentLocationLegacy(provider, requestId, request.handler, remainingTimeoutMillis)
        }
    }

    @androidx.annotation.RequiresApi(Build.VERSION_CODES.R)
    private fun requestCurrentLocationModern(
        provider: String,
        requestId: UUID,
        handler: Handler,
        timeoutMillis: Long
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

                val request = pendingPositionRequests[requestId]
                if (request != null) {
                    if (location != null) {
                        pendingPositionRequests.remove(requestId)
                        val position = locationToPosition(location)
                        request.resolver(PositionResult.Success(position))
                    } else {
                        handleProviderFailure(requestId, createLocationError(
                            POSITION_UNAVAILABLE,
                            "Unable to get location"
                        ))
                    }
                }
            }

            handler.postDelayed(timeoutRunnable, timeoutMillis)

            pendingPositionRequests[requestId]?.cancellationSignal = cancellationSignal

        } catch (e: SecurityException) {
            handler.removeCallbacks(timeoutRunnable)
            handleProviderFailure(requestId, createLocationError(
                PERMISSION_DENIED,
                "Security exception: ${e.message}"
            ))
        }
    }

    private fun requestCurrentLocationLegacy(
        provider: String,
        requestId: UUID,
        handler: Handler,
        timeoutMillis: Long
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
                                request.resolver(PositionResult.Success(position))
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

            handler.postDelayed(timeoutRunnable, timeoutMillis)

        } catch (e: SecurityException) {
            handleProviderFailure(requestId, createLocationError(
                PERMISSION_DENIED,
                "Security exception: ${e.message}"
            ))
        }
    }

    private fun handleProviderFailure(requestId: UUID, error: LocationError) {
        val request = pendingPositionRequests[requestId] ?: return

        request.cancellationSignal?.cancel()
        request.cancellationSignal = null
        request.providerIndex += 1

        if (request.providerIndex < request.providers.size) {
            if (request.remainingTimeoutMillis() <= 0L) {
                pendingPositionRequests.remove(requestId)?.resolver(
                    PositionResult.Failure(createPositionTimeoutError(request.options))
                )
                return
            }

            requestFreshLocationForCurrentProvider(requestId)
            return
        }

        pendingPositionRequests.remove(requestId)?.resolver(PositionResult.Failure(error))
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
        val request = pendingPositionRequests[requestId]
        if (request != null) {
            request.handler.removeCallbacksAndMessages(null)
            request.cancellationSignal?.cancel()
            request.cancellationSignal = null

            pendingPositionRequests.remove(requestId)?.resolver(
                PositionResult.Failure(createPositionTimeoutError(request.options))
            )
        }
    }

    // MARK: - Helper Functions - Watch Position

    private fun startWatchingLocation() {
        if (requiresPlayServices() && !isGooglePlayServicesAvailable()) {
            notifyWatchPlayServicesUnavailable()
            return
        }

        // Determine best provider and options from all subscriptions
        var androidAccuracy: AndroidAccuracyResolution? = null
        var smallestInterval = Double.MAX_VALUE
        var smallestDistanceFilter = Float.MAX_VALUE

        for ((_, subscription) in watchSubscriptions) {
            androidAccuracy = mostDemandingAndroidAccuracy(
                androidAccuracy,
                subscription.options.androidAccuracy
            )
            smallestInterval = minOf(smallestInterval, subscription.options.interval)
            smallestDistanceFilter = minOf(smallestDistanceFilter, subscription.options.distanceFilter.toFloat())
        }

        val provider = getValidProvider(
            androidAccuracy ?: resolveAndroidAccuracy(null, enableHighAccuracy = false)
        )
        if (provider == null) {
            notifyWatchProviderUnavailable()
            return
        }
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
                val error = LocationError(
                    code = SETTINGS_NOT_SATISFIED,
                    message = "Provider disabled: $provider"
                )

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
            val error = LocationError(
                code = PERMISSION_DENIED,
                message = "Permission denied: ${e.message}"
            )

            for ((_, subscription) in watchSubscriptions) {
                subscription.error?.invoke(error)
            }
        }
    }

    private fun notifyWatchProviderUnavailable() {
        for ((_, subscription) in watchSubscriptions) {
            subscription.error?.invoke(LocationError(
                code = SETTINGS_NOT_SATISFIED,
                message = getNoLocationProviderMessage(subscription.options)
            ))
        }
    }

    private fun notifyWatchPlayServicesUnavailable() {
        for ((_, subscription) in watchSubscriptions) {
            subscription.error?.invoke(createPlayServicesUnavailableError())
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

    private fun restartWatchingLocation() {
        stopWatchingLocation()
        startWatchingLocation()
    }

    // MARK: - Helper Functions - Conversion

    private fun locationToPosition(location: Location): GeolocationResponse {
        val coords = GeolocationCoordinates(
            latitude = location.latitude,
            longitude = location.longitude,
            altitude = location.altitudeValue(),
            accuracy = location.accuracy.toDouble(),
            altitudeAccuracy = location.altitudeAccuracyValue(),
            heading = location.headingValue(),
            speed = location.speedValue()
        )

        return GeolocationResponse(
            coords = coords,
            timestamp = location.time.toDouble(),
            mocked = location.isMocked(),
            provider = location.providerUsed()
        )
    }

    private fun createLocationError(code: Double, message: String): LocationError {
        return LocationError(
            code = code,
            message = message
        )
    }

    private fun createPlayServicesUnavailableError(): LocationError {
        return createLocationError(
            PLAY_SERVICE_NOT_AVAILABLE,
            "Google Play Services location provider is not available."
        )
    }

    private fun createPositionTimeoutError(options: ParsedOptions): LocationError {
        val timeoutSeconds = options.timeout / 1000.0
        val message = String.format("Unable to fetch location within %.1fs.", timeoutSeconds)
        return createLocationError(TIMEOUT, message)
    }

    private fun createRequestDeadlineElapsedRealtime(timeout: Double): Long {
        val now = SystemClock.elapsedRealtime()
        val timeoutMillis = coerceTimeoutMillis(timeout)
        val maxTimeoutMillis = Long.MAX_VALUE - now

        return if (timeoutMillis >= maxTimeoutMillis) {
            Long.MAX_VALUE
        } else {
            now + timeoutMillis
        }
    }

    private fun coerceTimeoutMillis(timeout: Double): Long {
        return when {
            timeout.isNaN() || timeout <= 0.0 -> 0L
            timeout.isInfinite() || timeout >= Long.MAX_VALUE.toDouble() -> Long.MAX_VALUE
            else -> timeout.toLong()
        }
    }

    companion object {
        private const val PERMISSION_REQUEST_CODE = 8947
        private const val TWO_MINUTES_MS = 2 * 60 * 1000L
    }
}
