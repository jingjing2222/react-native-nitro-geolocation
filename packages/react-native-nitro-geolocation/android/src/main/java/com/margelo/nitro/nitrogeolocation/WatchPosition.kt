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

    private sealed interface WatchCallback {
        val error: ((CompatGeolocationError) -> Unit)?
        val options: CompatGeolocationOptions?
    }

    private data class PositionWatchCallback(
            val success: (CompatGeolocationResponse) -> Unit,
            override val error: ((CompatGeolocationError) -> Unit)?,
            override val options: CompatGeolocationOptions?
    ) : WatchCallback

    private data class MetadataWatchCallback(
            val success: (CompatGeolocationResponseWithMetadataInternal) -> Unit,
            override val error: ((CompatGeolocationError) -> Unit)?,
            override val options: CompatGeolocationOptions?
    ) : WatchCallback

    fun watch(
            success: (CompatGeolocationResponse) -> Unit,
            error: ((CompatGeolocationError) -> Unit)?,
            options: CompatGeolocationOptions?
    ): Int {
        return addWatch(PositionWatchCallback(success, error, options))
    }

    fun watchWithMetadata(
            success: (CompatGeolocationResponseWithMetadataInternal) -> Unit,
            error: ((CompatGeolocationError) -> Unit)?,
            options: CompatGeolocationOptions?
    ): Int {
        return addWatch(MetadataWatchCallback(success, error, options))
    }

    private fun addWatch(callback: WatchCallback): Int {
        val watchId = watchIdGenerator.incrementAndGet()
        watchCallbacks[watchId] = callback

        // Start observing if this is the first watch
        if (watchCallbacks.size == 1) {
            startObserving(callback.options)
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

        locationListener?.let { listener -> locationManager?.removeUpdates(listener) }

        locationListener = null
        watchedProvider = null
        watchCallbacks.clear()
    }

    private fun startObserving(options: CompatGeolocationOptions?) {
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
        val provider = getValidProvider(locationManager, opts.androidAccuracy)

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
            val listener =
                    object : LocationListener {
                        override fun onLocationChanged(location: Location) {
                            var position: CompatGeolocationResponse? = null
                            var positionWithMetadata: CompatGeolocationResponseWithMetadataInternal? = null
                            watchCallbacks.values.forEach { callback ->
                                when (callback) {
                                    is PositionWatchCallback -> {
                                        val response = position
                                            ?: location.toCompatGeolocationResponse().also {
                                                position = it
                                            }
                                        callback.success(response)
                                    }
                                    is MetadataWatchCallback -> {
                                        val response = positionWithMetadata
                                            ?: location.toCompatGeolocationResponseWithMetadata().also {
                                                positionWithMetadata = it
                                            }
                                        callback.success(response)
                                    }
                                }
                            }
                        }

                        override fun onStatusChanged(
                                provider: String?,
                                status: Int,
                                extras: Bundle?
                        ) {}
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

    private fun emitErrorToAll(error: CompatGeolocationError) {
        watchCallbacks.values.forEach { callback -> callback.error?.invoke(error) }
    }

    private fun parseOptions(options: CompatGeolocationOptions?): ParsedOptions {
        return ParsedOptions(
                interval = options?.interval ?: DEFAULT_INTERVAL,
                distanceFilter = options?.distanceFilter ?: DEFAULT_DISTANCE_FILTER,
                androidAccuracy =
                        resolveAndroidAccuracy(
                                options?.accuracy,
                                options?.enableHighAccuracy ?: false
                        )
        )
    }

    private fun getValidProvider(
            locationManager: LocationManager,
            accuracy: AndroidAccuracyResolution
    ): String? {
        val fineGranted = hasPermission(Manifest.permission.ACCESS_FINE_LOCATION)
        val coarseGranted = fineGranted || hasPermission(Manifest.permission.ACCESS_COARSE_LOCATION)
        return accuracy.providerOrder().firstOrNull { provider ->
            isProviderValid(locationManager, provider, fineGranted, coarseGranted)
        }
    }

    private fun isProviderValid(
            locationManager: LocationManager,
            provider: String,
            fineGranted: Boolean,
            coarseGranted: Boolean
    ): Boolean {
        if (!locationManager.isProviderEnabled(provider)) return false

        return if (provider == LocationManager.GPS_PROVIDER) {
            fineGranted
        } else {
            coarseGranted || fineGranted
        }
    }

    private fun hasPermission(permission: String): Boolean =
            ContextCompat.checkSelfPermission(reactContext, permission) ==
                    PackageManager.PERMISSION_GRANTED

    private fun createError(code: Int, message: String): CompatGeolocationError {
        return CompatGeolocationError(
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
            val androidAccuracy: AndroidAccuracyResolution
    )

    companion object {
        private const val TAG = "WatchPosition"
        const val DEFAULT_INTERVAL = 1000.0 // 1 second
        const val DEFAULT_DISTANCE_FILTER = 100.0 // 100 meters
    }
}
