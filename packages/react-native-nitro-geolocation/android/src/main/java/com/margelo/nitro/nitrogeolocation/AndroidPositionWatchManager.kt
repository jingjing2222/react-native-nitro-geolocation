package com.margelo.nitro.nitrogeolocation

import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Looper
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationResult
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicLong

internal class AndroidPositionWatchManager(
    private val locationManager: LocationManager,
    private val fusedLocationClient: FusedLocationProviderClient,
    private val fusedLocationProvider: AndroidFusedLocationProvider,
    private val providerRoute: () -> AndroidProviderRoute,
    private val configuredProvider: () -> LocationProvider?,
    private val getValidProvider: (ParsedOptions) -> String?,
    private val getNoProviderMessage: (ParsedOptions) -> String,
    private val locationToPosition: (Location, LocationProviderUsed?) -> GeolocationResponse
) {
    private val subscriptions = ConcurrentHashMap<String, WatchSubscription>()
    private var platformListener: LocationListener? = null
    private var fusedCallback: LocationCallback? = null
    private val generation = AtomicLong(0L)

    fun watch(
        success: (GeolocationResponse) -> Unit,
        error: ((LocationError) -> Unit)?,
        options: ParsedOptions
    ): String {
        val token = UUID.randomUUID().toString()
        subscriptions[token] = WatchSubscription(token, success, error, options)
        if (subscriptions.size == 1) start() else restart()
        return token
    }

    fun unwatch(token: String): Boolean {
        if (subscriptions.remove(token) == null) return false
        if (subscriptions.isEmpty()) stop() else restart()
        return true
    }

    fun activeWatches(): Array<ActiveWatch> = subscriptions.keys
        .map { ActiveWatch(token = it, kind = ActiveWatchKind.POSITION) }
        .sortedBy { it.token }
        .toTypedArray()

    fun stopObserving() {
        subscriptions.clear()
        stop()
    }

    private fun start() {
        val activeGeneration = generation.get()
        if (providerRoute() == AndroidProviderRoute.FUSED) {
            startFused(activeGeneration)
        } else {
            startPlatform(activeGeneration)
        }
    }

    private fun isActive(activeGeneration: Long): Boolean =
        subscriptions.isNotEmpty() && generation.get() == activeGeneration

    private fun startPlatform(activeGeneration: Long) {
        if (!isActive(activeGeneration)) return
        val options = mergeOptions()
        val provider = getValidProvider(options)
        if (provider == null) {
            notifyProviderUnavailable()
            return
        }

        val listener = object : LocationListener {
            override fun onLocationChanged(location: Location) {
                if (!isActive(activeGeneration)) return
                deliver(locationToPosition(location, null))
            }

            override fun onProviderDisabled(provider: String) {
                if (!isActive(activeGeneration)) return
                notifyError(LocationError(
                    code = SETTINGS_NOT_SATISFIED,
                    message = "Provider disabled: $provider"
                ))
            }

            override fun onProviderEnabled(provider: String) = Unit

            @Deprecated("Deprecated in Java")
            override fun onStatusChanged(
                provider: String?,
                status: Int,
                extras: android.os.Bundle?
            ) = Unit
        }

        removePlatformListener()
        platformListener = listener
        try {
            locationManager.requestLocationUpdates(
                provider,
                options.interval.toLong(),
                options.distanceFilter.toFloat(),
                listener,
                Looper.getMainLooper()
            )
        } catch (error: SecurityException) {
            notifyError(LocationError(
                code = PERMISSION_DENIED,
                message = "Permission denied: ${error.message}"
            ))
        }
    }

    private fun startFused(activeGeneration: Long) {
        if (!isActive(activeGeneration)) return
        val options = mergeOptions()
        val callback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                if (!isActive(activeGeneration)) return
                val location = result.lastLocation ?: return
                deliver(locationToPosition(location, LocationProviderUsed.FUSED))
            }
        }

        removeFusedCallback()
        fusedCallback = callback

        fun handleFailure(error: LocationError? = null) {
            if (!isActive(activeGeneration)) return
            removeFusedCallback()
            runAndroidWatchPositionFallbackAfterFusedFailure(
                locationProvider = configuredProvider(),
                runPlatformFallback = { startPlatform(activeGeneration) },
                failWithoutFallback = {
                    if (error != null) notifyError(error) else notifyProviderUnavailable()
                }
            )
        }

        fusedLocationProvider.requestWatchUpdates(
            options = options,
            callback = callback,
            onInactiveStart = {
                if (!isActive(activeGeneration)) {
                    runCatching { fusedLocationClient.removeLocationUpdates(callback) }
                }
            },
            onFailure = { error -> handleFailure(error) }
        )
    }

    private fun mergeOptions(): ParsedOptions {
        var androidAccuracy: AndroidAccuracyResolution? = null
        var interval = Double.MAX_VALUE
        var fastestInterval = Double.MAX_VALUE
        var distanceFilter = Double.MAX_VALUE
        var granularity = AndroidGranularity.PERMISSION
        var waitForAccurateLocation = false
        var maxUpdateAge: Double? = null
        var maxUpdateDelay = Double.MAX_VALUE

        for (subscription in subscriptions.values) {
            androidAccuracy = mostDemandingAndroidAccuracy(
                androidAccuracy,
                subscription.options.androidAccuracy
            )
            interval = minOf(interval, subscription.options.interval)
            fastestInterval = minOf(fastestInterval, subscription.options.fastestInterval)
            distanceFilter = minOf(distanceFilter, subscription.options.distanceFilter)
            granularity = mergeGranularity(granularity, subscription.options.granularity)
            waitForAccurateLocation = waitForAccurateLocation ||
                subscription.options.waitForAccurateLocation
            maxUpdateAge = mergeNullableMinimum(maxUpdateAge, subscription.options.maxUpdateAge)
            maxUpdateDelay = minOf(maxUpdateDelay, subscription.options.maxUpdateDelay)
        }

        return ParsedOptions(
            timeout = Double.POSITIVE_INFINITY,
            maximumAge = 0.0,
            androidAccuracy = androidAccuracy ?:
                resolveAndroidAccuracy(null, enableHighAccuracy = false),
            interval = interval,
            fastestInterval = fastestInterval,
            distanceFilter = distanceFilter,
            granularity = granularity,
            waitForAccurateLocation = waitForAccurateLocation,
            maxUpdateAge = maxUpdateAge,
            maxUpdateDelay = if (maxUpdateDelay == Double.MAX_VALUE) 0.0 else maxUpdateDelay,
            maxUpdates = null
        )
    }

    private fun deliver(position: GeolocationResponse) {
        val finishedTokens = mutableListOf<String>()
        for ((token, subscription) in subscriptions) {
            subscription.success(position)
            subscription.deliveredUpdates += 1
            val maxUpdates = subscription.options.maxUpdates
            if (maxUpdates != null && subscription.deliveredUpdates >= maxUpdates) {
                finishedTokens.add(token)
            }
        }
        finishedTokens.forEach(subscriptions::remove)
        if (finishedTokens.isNotEmpty()) {
            if (subscriptions.isEmpty()) stop() else restart()
        }
    }

    private fun notifyProviderUnavailable() {
        for (subscription in subscriptions.values) {
            subscription.error?.invoke(LocationError(
                code = SETTINGS_NOT_SATISFIED,
                message = getNoProviderMessage(subscription.options)
            ))
        }
    }

    private fun notifyError(error: LocationError) {
        subscriptions.values.forEach { it.error?.invoke(error) }
    }

    private fun mergeGranularity(
        current: AndroidGranularity,
        next: AndroidGranularity
    ): AndroidGranularity = when {
        current == AndroidGranularity.COARSE || next == AndroidGranularity.COARSE -> {
            AndroidGranularity.COARSE
        }
        current == AndroidGranularity.FINE || next == AndroidGranularity.FINE -> {
            AndroidGranularity.FINE
        }
        else -> AndroidGranularity.PERMISSION
    }

    private fun stop() {
        generation.incrementAndGet()
        removePlatformListener()
        removeFusedCallback()
    }

    private fun removePlatformListener() {
        platformListener?.let { listener ->
            runCatching { locationManager.removeUpdates(listener) }
        }
        platformListener = null
    }

    private fun removeFusedCallback() {
        fusedCallback?.let { callback ->
            runCatching { fusedLocationClient.removeLocationUpdates(callback) }
        }
        fusedCallback = null
    }

    private fun restart() {
        stop()
        start()
    }
}
