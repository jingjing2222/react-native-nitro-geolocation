package com.margelo.nitro.nitrogeolocation

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import android.os.Looper
import android.util.Log
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.ReactApplicationContext
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger

class WatchPosition(private val reactContext: ReactApplicationContext) {

    private val watchCallbacks = ConcurrentHashMap<Int, WatchCallback>()
    private val watchIdGenerator = AtomicInteger(0)
    private var locationListener: LocationListener? = null
    private var watchedProvider: String? = null
    private var currentOptions: GeolocationOptions? = null

    data class WatchCallback(
        val success: (GeolocationPosition) -> Unit,
        val error: ((GeolocationError) -> Unit)?,
        val options: GeolocationOptions?
    )

    fun watch(
        success: (GeolocationPosition) -> Unit,
        error: ((GeolocationError) -> Unit)?,
        options: GeolocationOptions?
    ): Int {
        val watchId = watchIdGenerator.incrementAndGet()
        watchCallbacks[watchId] = WatchCallback(success, error, options)

        // Start observing if this is the first watch
        if (watchCallbacks.size == 1) {
            startObserving(options)
        }

        return watchId
    }

    fun clearWatch(watchId: Int) {
        watchCallbacks.remove(watchId)

        // Stop observing if no more watches
        if (watchCallbacks.isEmpty()) {
            stopObserving()
        }
    }

    fun stopObserving() {
        val locationManager =
            reactContext.getSystemService(Context.LOCATION_SERVICE) as? LocationManager

        locationListener?.let { listener ->
            locationManager?.removeUpdates(listener)
        }

        locationListener = null
        watchedProvider = null
        currentOptions = null
        watchCallbacks.clear()
    }

    private fun startObserving(options: GeolocationOptions?) {
        val locationManager =
            reactContext.getSystemService(Context.LOCATION_SERVICE) as? LocationManager

        if (locationManager == null) {
            Log.e(TAG, "LocationManager is not available")
            emitErrorToAll(
                createError(
                    GetCurrentPosition.POSITION_UNAVAILABLE,
                    "LocationManager is not available"
                )
            )
            return
        }

        val opts = parseOptions(options)
        val provider = getValidProvider(locationManager, opts.enableHighAccuracy)

        if (provider == null) {
            Log.e(TAG, "No location provider available")
            emitErrorToAll(
                createError(
                    GetCurrentPosition.POSITION_UNAVAILABLE,
                    "No location provider available"
                )
            )
            return
        }

        // If already watching with the same provider, don't restart
        if (provider == watchedProvider) {
            return
        }

        try {
            // Remove old listener if exists
            locationListener?.let { locationManager.removeUpdates(it) }

            // Create new listener
            val listener = object : LocationListener {
                override fun onLocationChanged(location: Location) {
                    val position = locationToPosition(location)
                    // Call all watch callbacks
                    watchCallbacks.values.forEach { callback ->
                        callback.success(position)
                    }
                }

                override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
                override fun onProviderEnabled(provider: String) {}
                override fun onProviderDisabled(provider: String) {}
            }

            locationManager.requestLocationUpdates(
                provider,
                opts.interval.toLong(),
                opts.distanceFilter.toFloat(),
                listener,
                Looper.getMainLooper()
            )

            locationListener = listener
            watchedProvider = provider
            currentOptions = options
        } catch (e: SecurityException) {
            Log.e(TAG, "SecurityException: ${e.message}")
            emitErrorToAll(
                createError(
                    GetCurrentPosition.PERMISSION_DENIED,
                    "Location permission denied: ${e.message}"
                )
            )
        }
    }

    private fun emitErrorToAll(error: GeolocationError) {
        watchCallbacks.values.forEach { callback ->
            callback.error?.invoke(error)
        }
    }

    private fun parseOptions(options: GeolocationOptions?): ParsedOptions {
        return ParsedOptions(
            interval = options?.interval ?: DEFAULT_INTERVAL,
            distanceFilter = options?.distanceFilter ?: DEFAULT_DISTANCE_FILTER,
            enableHighAccuracy = options?.enableHighAccuracy ?: false
        )
    }

    private fun getValidProvider(
        locationManager: LocationManager,
        highAccuracy: Boolean
    ): String? {
        val preferredProvider =
            if (highAccuracy) LocationManager.GPS_PROVIDER
            else LocationManager.NETWORK_PROVIDER
        val fallbackProvider =
            if (highAccuracy) LocationManager.NETWORK_PROVIDER
            else LocationManager.GPS_PROVIDER

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
            PERMISSION_DENIED = GetCurrentPosition.PERMISSION_DENIED.toDouble(),
            POSITION_UNAVAILABLE = GetCurrentPosition.POSITION_UNAVAILABLE.toDouble(),
            TIMEOUT = GetCurrentPosition.TIMEOUT.toDouble()
        )
    }

    private data class ParsedOptions(
        val interval: Double,
        val distanceFilter: Double,
        val enableHighAccuracy: Boolean
    )

    companion object {
        private const val TAG = "WatchPosition"
        const val DEFAULT_INTERVAL = 1000.0 // 1 second
        const val DEFAULT_DISTANCE_FILTER = 100.0 // 100 meters
    }
}
