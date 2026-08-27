package com.margelo.nitro.nitrogeolocation

import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Looper
import android.os.SystemClock
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationResult
import java.util.UUID

internal class AndroidPositionWatchManager(
    private val locationManager: LocationManager,
    private val fusedLocationClient: FusedLocationProviderClient,
    private val fusedLocationProvider: AndroidFusedLocationProvider,
    private val providerRoute: () -> AndroidProviderRoute,
    private val configuredProvider: () -> LocationProvider?,
    private val getValidProvider: (ParsedOptions) -> String?,
    private val getNoProviderMessage: (ParsedOptions) -> String,
    private val locationToPosition: (Location, LocationProviderUsed?) -> GeolocationResponse,
    private val dispatcher: AndroidWatchSerialDispatcher = createAndroidMainWatchDispatcher()
) {
    private val subscriptions = AndroidWatchCollection<WatchSubscription>()
    private var platformListener: LocationListener? = null
    private var fusedCallback: LocationCallback? = null
    private var activeRequestOptions: ParsedOptions? = null
    private var generation = 0L

    fun watch(
        success: (GeolocationResponse) -> Unit,
        error: ((LocationError) -> Unit)?,
        options: ParsedOptions
    ): String {
        val token = UUID.randomUUID().toString()
        dispatcher.sync {
            applyTransition(subscriptions.add(
                token,
                WatchSubscription(token, success, error, options)
            ))
        }
        return token
    }

    fun unwatch(token: String): Boolean = dispatcher.sync {
        val transition = subscriptions.remove(token)
        applyTransition(transition)
        transition != AndroidWatchTransition.NONE
    }

    fun activeWatches(): Array<ActiveWatch> = dispatcher.sync {
        subscriptions.tokens()
            .map { ActiveWatch(token = it, kind = ActiveWatchKind.POSITION) }
            .toTypedArray()
    }

    fun stopObserving() {
        dispatcher.sync { applyTransition(subscriptions.clear()) }
    }

    private fun start(options: ParsedOptions = mergeOptions()) {
        val activeGeneration = generation
        activeRequestOptions = options
        if (providerRoute() == AndroidProviderRoute.FUSED) {
            startFused(activeGeneration, options)
        } else {
            startPlatform(activeGeneration, options)
        }
    }

    private fun isActive(activeGeneration: Long): Boolean =
        !subscriptions.isEmpty() && generation == activeGeneration

    private fun startPlatform(
        activeGeneration: Long,
        options: ParsedOptions = mergeOptions()
    ) {
        if (!isActive(activeGeneration)) return
        val provider = getValidProvider(options)
        if (provider == null) {
            activeRequestOptions = null
            notifyProviderUnavailable()
            return
        }

        val listener = object : LocationListener {
            override fun onLocationChanged(location: Location) {
                dispatcher.sync {
                    if (!isActive(activeGeneration)) return@sync
                    deliver(location, null)
                }
            }

            override fun onProviderDisabled(provider: String) {
                dispatcher.sync {
                    if (!isActive(activeGeneration)) return@sync
                    activeRequestOptions = null
                    notifyError(LocationError(
                        code = SETTINGS_NOT_SATISFIED,
                        message = "Provider disabled: $provider"
                    ))
                }
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
            activeRequestOptions = null
            notifyError(LocationError(
                code = PERMISSION_DENIED,
                message = "Permission denied: ${error.message}"
            ))
        }
    }

    private fun startFused(activeGeneration: Long, options: ParsedOptions) {
        if (!isActive(activeGeneration)) return
        val callback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                val location = result.lastLocation ?: return
                dispatcher.sync {
                    if (!isActive(activeGeneration)) return@sync
                    deliver(location, LocationProviderUsed.FUSED)
                }
            }
        }

        removeFusedCallback()
        fusedCallback = callback

        fun handleFailure(error: LocationError? = null) {
            dispatcher.sync {
                if (!isActive(activeGeneration)) return@sync
                removeFusedCallback()
                runAndroidWatchPositionFallbackAfterFusedFailure(
                    locationProvider = configuredProvider(),
                    runPlatformFallback = { startPlatform(activeGeneration, options) },
                    failWithoutFallback = {
                        activeRequestOptions = null
                        if (error != null) notifyError(error) else notifyProviderUnavailable()
                    }
                )
            }
        }

        fusedLocationProvider.requestWatchUpdates(
            options = options,
            callback = callback,
            onInactiveStart = {
                dispatcher.sync {
                    if (!isActive(activeGeneration)) {
                        runCatching { fusedLocationClient.removeLocationUpdates(callback) }
                    }
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

        for (subscription in subscriptions.values()) {
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

    private fun deliver(location: Location, provider: LocationProviderUsed?) {
        var removedFinishedWatch = false
        var position: GeolocationResponse? = null
        val elapsedRealtimeMillis = SystemClock.elapsedRealtime()
        subscriptions.forEachCurrent { token, subscription ->
            val decision = evaluateAndroidWatchDelivery(
                previous = subscription.deliveryState,
                latitude = location.latitude,
                longitude = location.longitude,
                elapsedRealtimeMillis = elapsedRealtimeMillis,
                minimumIntervalMillis = subscription.options.interval,
                distanceFilterMeters = subscription.options.distanceFilter
            )
            if (!decision.shouldDeliver) return@forEachCurrent

            subscription.deliveryState = decision.nextState
            subscription.deliveredUpdates += 1
            val deliveredPosition = position ?: locationToPosition(location, provider).also {
                position = it
            }
            subscription.success(deliveredPosition)
            val maxUpdates = subscription.options.maxUpdates
            if (maxUpdates != null && subscription.deliveredUpdates >= maxUpdates) {
                removedFinishedWatch = subscriptions.removeCurrent(token, subscription) ||
                    removedFinishedWatch
            }
        }
        if (removedFinishedWatch) {
            applyTransition(subscriptions.transitionAfterRemoval())
        }
    }

    private fun notifyProviderUnavailable() {
        subscriptions.forEachCurrent { _, subscription ->
            subscription.error?.invoke(LocationError(
                code = SETTINGS_NOT_SATISFIED,
                message = getNoProviderMessage(subscription.options)
            ))
        }
    }

    private fun notifyError(error: LocationError) {
        subscriptions.forEachCurrent { _, subscription -> subscription.error?.invoke(error) }
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
        generation += 1
        activeRequestOptions = null
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

    private fun restart(options: ParsedOptions) {
        stop()
        start(options)
    }

    private fun applyTransition(transition: AndroidWatchTransition) {
        when (transition) {
            AndroidWatchTransition.NONE -> Unit
            AndroidWatchTransition.START -> start()
            AndroidWatchTransition.RESTART -> {
                val options = mergeOptions()
                if (options != activeRequestOptions) restart(options)
            }
            AndroidWatchTransition.STOP -> stop()
        }
    }
}
