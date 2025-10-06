package com.margelo.nitro.nitrogeolocation

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.ReactApplicationContext

class GetCurrentPosition(private val reactContext: ReactApplicationContext) {

    fun execute(
            success: (position: GeolocationPosition) -> Unit,
            error: ((error: GeolocationError) -> Unit)?,
            options: GeolocationOptions?
    ) {
        val locationManager =
                reactContext.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
        if (locationManager == null) {
            Log.e(TAG, "LocationManager is not available")
            error?.invoke(createError(POSITION_UNAVAILABLE, "LocationManager is not available"))
            return
        }

        val opts = parseOptions(options)
        val provider = getValidProvider(locationManager, opts.enableHighAccuracy)

        if (provider == null) {
            Log.e(TAG, "No location provider available")
            error?.invoke(createError(POSITION_UNAVAILABLE, "No location provider available"))
            return
        }

        try {
            val lastKnownLocation = locationManager.getLastKnownLocation(provider)

            // Check if cached location is fresh enough
            if (lastKnownLocation != null && isCachedLocationValid(lastKnownLocation, opts)) {
                success(locationToPosition(lastKnownLocation))
                return
            }

            // If maximumAge is Infinity and we have a last known location, use it
            if (lastKnownLocation != null && opts.maximumAge == Double.POSITIVE_INFINITY) {
                success(locationToPosition(lastKnownLocation))
                return
            }

            // Request fresh location
            requestFreshLocation(locationManager, provider, opts, success, error, lastKnownLocation)
        } catch (e: SecurityException) {
            Log.e(TAG, "Security exception: ${e.message}")
            error?.invoke(
                    createError(PERMISSION_DENIED, "Location permission denied: ${e.message}")
            )
        }
    }

    // ===== Helper Functions =====

    private fun parseOptions(options: GeolocationOptions?): ParsedOptions {
        return ParsedOptions(
                timeout = options?.timeout ?: DEFAULT_TIMEOUT,
                maximumAge = options?.maximumAge ?: DEFAULT_MAXIMUM_AGE,
                enableHighAccuracy = options?.enableHighAccuracy ?: false
        )
    }

    private fun isCachedLocationValid(location: Location, options: ParsedOptions): Boolean {
        val age = System.currentTimeMillis() - location.time
        return age < options.maximumAge
    }

    private fun getValidProvider(locationManager: LocationManager, highAccuracy: Boolean): String? {
        val preferredProvider =
                if (highAccuracy) LocationManager.GPS_PROVIDER else LocationManager.NETWORK_PROVIDER
        val fallbackProvider =
                if (highAccuracy) LocationManager.NETWORK_PROVIDER else LocationManager.GPS_PROVIDER

        return when {
            isProviderValid(locationManager, preferredProvider) -> preferredProvider
            isProviderValid(locationManager, fallbackProvider) -> fallbackProvider
            else -> null
        }
    }

    private fun isProviderValid(locationManager: LocationManager, provider: String): Boolean {
        if (!locationManager.isProviderEnabled(provider)) return false

        val permission =
                if (provider == LocationManager.GPS_PROVIDER)
                        Manifest.permission.ACCESS_FINE_LOCATION
                else Manifest.permission.ACCESS_COARSE_LOCATION

        return ContextCompat.checkSelfPermission(reactContext, permission) ==
                PackageManager.PERMISSION_GRANTED
    }

    private fun requestFreshLocation(
            locationManager: LocationManager,
            provider: String,
            options: ParsedOptions,
            success: (GeolocationPosition) -> Unit,
            error: ((GeolocationError) -> Unit)?,
            fallbackLocation: Location?
    ) {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
            // Android 11+ supports getCurrentLocation
            requestCurrentLocationModern(
                    locationManager,
                    provider,
                    options,
                    success,
                    error,
                    fallbackLocation
            )
        } else {
            // Fallback to requestLocationUpdates
            requestCurrentLocationLegacy(
                    locationManager,
                    provider,
                    options,
                    success,
                    error,
                    fallbackLocation
            )
        }
    }

    @androidx.annotation.RequiresApi(android.os.Build.VERSION_CODES.R)
    private fun requestCurrentLocationModern(
            locationManager: LocationManager,
            provider: String,
            options: ParsedOptions,
            success: (GeolocationPosition) -> Unit,
            error: ((GeolocationError) -> Unit)?,
            fallbackLocation: Location?
    ) {
        val handler = Handler(Looper.getMainLooper())
        val cancellationSignal = android.os.CancellationSignal()

        val timeoutRunnable = Runnable {
            cancellationSignal.cancel()
            error?.invoke(createError(TIMEOUT, "Location request timed out"))
        }

        try {
            locationManager.getCurrentLocation(
                    provider,
                    cancellationSignal,
                    { runnable -> handler.post(runnable) }
            ) { location ->
                handler.removeCallbacks(timeoutRunnable)

                val bestLocation = selectBestLocation(location, fallbackLocation)

                if (bestLocation != null) {
                    success(locationToPosition(bestLocation))
                } else {
                    Log.e(TAG, "No location available")
                    error?.invoke(createError(POSITION_UNAVAILABLE, "Unable to get location"))
                }
            }
            handler.postDelayed(timeoutRunnable, options.timeout.toLong())
        } catch (e: SecurityException) {
            Log.e(TAG, "SecurityException: ${e.message}")
            error?.invoke(createError(PERMISSION_DENIED, "Permission denied: ${e.message}"))
        }
    }

    private fun selectBestLocation(newLocation: Location?, fallbackLocation: Location?): Location? {
        return when {
            newLocation == null -> fallbackLocation
            fallbackLocation == null -> newLocation
            isBetterLocation(newLocation, fallbackLocation) -> newLocation
            else -> fallbackLocation
        }
    }

    private fun requestCurrentLocationLegacy(
            locationManager: LocationManager,
            provider: String,
            options: ParsedOptions,
            success: (GeolocationPosition) -> Unit,
            error: ((GeolocationError) -> Unit)?,
            fallbackLocation: Location?
    ) {
        val handler = Handler(Looper.getMainLooper())
        var isResolved = false
        var oldLocation = fallbackLocation
        lateinit var listener: LocationListener

        val timeoutRunnable = Runnable {
            if (!isResolved) {
                isResolved = true
                locationManager.removeUpdates(listener)
                error?.invoke(createError(TIMEOUT, "Location request timed out"))
            }
        }

        listener =
                object : LocationListener {
                    override fun onLocationChanged(location: Location) {
                        synchronized(this) {
                            if (!isResolved) {
                                val bestLocation = selectBestLocation(location, oldLocation)
                                if (bestLocation == location) {
                                    isResolved = true
                                    handler.removeCallbacks(timeoutRunnable)
                                    locationManager.removeUpdates(this)
                                    success(locationToPosition(location))
                                }
                                oldLocation = location
                            }
                        }
                    }

                    override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
                    override fun onProviderEnabled(provider: String) {}
                    override fun onProviderDisabled(provider: String) {}
                }

        try {
            locationManager.requestLocationUpdates(
                    provider,
                    100,
                    1f,
                    listener,
                    Looper.getMainLooper()
            )
            handler.postDelayed(timeoutRunnable, options.timeout.toLong())
        } catch (e: SecurityException) {
            Log.e(TAG, "SecurityException in requestLocationUpdates: ${e.message}")
            error?.invoke(createError(PERMISSION_DENIED, "Permission denied: ${e.message}"))
        }
    }

    /**
     * Determines whether one Location reading is better than the current Location fix Taken from
     * Android Examples: https://developer.android.com/guide/topics/location/strategies.html
     */
    private fun isBetterLocation(location: Location, currentBestLocation: Location?): Boolean {
        if (currentBestLocation == null) {
            return true
        }

        val timeDelta = location.time - currentBestLocation.time
        val isSignificantlyNewer = timeDelta > TWO_MINUTES
        val isSignificantlyOlder = timeDelta < -TWO_MINUTES
        val isNewer = timeDelta > 0

        if (isSignificantlyNewer) {
            return true
        } else if (isSignificantlyOlder) {
            return false
        }

        val accuracyDelta = (location.accuracy - currentBestLocation.accuracy).toInt()
        val isLessAccurate = accuracyDelta > 0
        val isMoreAccurate = accuracyDelta < 0
        val isSignificantlyLessAccurate = accuracyDelta > 200

        val isFromSameProvider = isSameProvider(location.provider, currentBestLocation.provider)

        return when {
            isMoreAccurate -> true
            isNewer && !isLessAccurate -> true
            isNewer && !isSignificantlyLessAccurate && isFromSameProvider -> true
            else -> false
        }
    }

    private fun isSameProvider(provider1: String?, provider2: String?): Boolean {
        if (provider1 == null) {
            return provider2 == null
        }
        return provider1 == provider2
    }

    // ===== Data Conversion =====

    private fun locationToPosition(location: Location): GeolocationPosition {
        return GeolocationPosition(
                coords =
                        GeolocationCoordinates(
                                latitude = location.latitude,
                                longitude = location.longitude,
                                altitude = if (location.hasAltitude()) location.altitude else null,
                                accuracy = location.accuracy.toDouble(),
                                altitudeAccuracy =
                                        if (android.os.Build.VERSION.SDK_INT >=
                                                        android.os.Build.VERSION_CODES.O &&
                                                        location.hasVerticalAccuracy()
                                        )
                                                location.verticalAccuracyMeters.toDouble()
                                        else null,
                                heading =
                                        if (location.hasBearing()) location.bearing.toDouble()
                                        else null,
                                speed = if (location.hasSpeed()) location.speed.toDouble() else null
                        ),
                timestamp = location.time.toDouble()
        )
    }

    private fun createError(code: Int, message: String): GeolocationError {
        return GeolocationError(
                code = code.toDouble(),
                message = message,
                PERMISSION_DENIED = PERMISSION_DENIED.toDouble(),
                POSITION_UNAVAILABLE = POSITION_UNAVAILABLE.toDouble(),
                TIMEOUT = TIMEOUT.toDouble()
        )
    }

    // ===== Data Classes =====

    private data class ParsedOptions(
            val timeout: Double,
            val maximumAge: Double,
            val enableHighAccuracy: Boolean
    )

    companion object {
        private const val TAG = "GetCurrentPosition"
        const val PERMISSION_DENIED = 1
        const val POSITION_UNAVAILABLE = 2
        const val TIMEOUT = 3

        const val DEFAULT_TIMEOUT = 10 * 60 * 1000.0 // 10 minutes
        const val DEFAULT_MAXIMUM_AGE = Double.POSITIVE_INFINITY

        private const val TWO_MINUTES = 1000 * 60 * 2L // 2 minutes in milliseconds
    }
}
