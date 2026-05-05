package com.margelo.nitro.nitrogeolocation

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Address
import android.location.Geocoder
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
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest as GmsLocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.margelo.nitro.NitroModules
import com.margelo.nitro.core.Promise
import java.io.IOException
import java.util.Locale
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean

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
                val enableHighAccuracy = options?.enableHighAccuracy ?: false
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
                        enableHighAccuracy
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

    private data class WatchSubscription(
        val token: String,
        val success: (GeolocationResponse) -> Unit,
        val error: ((LocationError) -> Unit)?,
        val options: ParsedOptions,
        var deliveredUpdates: Int = 0
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
    private val fusedLocationClient by lazy {
        LocationServices.getFusedLocationProviderClient(reactContext)
    }
    private val headingManager: AndroidHeadingManager by lazy {
        AndroidHeadingManager(
            context = reactContext,
            createLocationError = ::createLocationError,
            getReferenceLocation = {
                lastLocation ?: getBestCachedLocation(
                    getValidProviders(resolveAndroidAccuracy(null, enableHighAccuracy = false)),
                    ParsedOptions.parseLastKnown(null)
                )
            }
        )
    }
    private var lastLocation: Location? = null

    // Permission callbacks
    private val pendingPermissionResolvers = mutableListOf<(PermissionStatus) -> Unit>()

    // getCurrentPosition requests
    private val pendingPositionRequests = ConcurrentHashMap<UUID, PositionRequest>()

    // Watch subscriptions (token -> callback)
    private val watchSubscriptions = ConcurrentHashMap<String, WatchSubscription>()

    // Location listener for watch subscriptions
    private var watchLocationListener: LocationListener? = null
    private var fusedWatchLocationCallback: LocationCallback? = null
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
        val promise = Promise<LocationProviderStatus>()
        locationSettings.getProviderStatus { status ->
            promise.resolve(status)
        }
        return promise
    }

    override fun getLocationAvailability(): Promise<LocationAvailability> {
        val promise = Promise<LocationAvailability>()

        if (!hasLocationPermission()) {
            promise.resolve(createLocationAvailability(false, "permissionDenied"))
            return promise
        }

        if (!locationSettings.hasServicesEnabled()) {
            promise.resolve(createLocationAvailability(false, "locationServicesDisabled"))
            return promise
        }

        if (requiresPlayServices()) {
            if (!isGooglePlayServicesAvailable()) {
                promise.resolve(createLocationAvailability(false, "playServicesUnavailable"))
                return promise
            }

            fusedLocationClient.locationAvailability
                .addOnSuccessListener { availability ->
                    promise.resolve(
                        createLocationAvailability(
                            availability.isLocationAvailable,
                            if (availability.isLocationAvailable) null else "fusedLocationUnavailable"
                        )
                    )
                }
                .addOnFailureListener { exception ->
                    promise.resolve(createLocationAvailability(
                        false,
                        "fusedLocationUnavailable: ${exception.message ?: "unknown error"}"
                    ))
                }
                .addOnCanceledListener {
                    promise.resolve(createLocationAvailability(false, "fusedLocationUnavailable"))
                }
            return promise
        }

        val providers = getValidProviders(resolveAndroidAccuracy(null, enableHighAccuracy = false))
        val reason = if (providers.isEmpty()) "noLocationProvider" else null
        promise.resolve(createLocationAvailability(providers.isNotEmpty(), reason))
        return promise
    }

    override fun requestLocationSettings(
        success: (LocationProviderStatus) -> Unit,
        error: ((LocationError) -> Unit)?,
        options: LocationSettingsOptions?
    ) {
        locationSettings.requestLocationSettings(success, error, options)
    }

    override fun getAccuracyAuthorization(): Promise<AccuracyAuthorization> {
        return Promise.async {
            getCurrentAccuracyAuthorization()
        }
    }

    override fun requestTemporaryFullAccuracy(
        purposeKey: String,
        success: (AccuracyAuthorization) -> Unit,
        error: ((LocationError) -> Unit)?
    ) {
        if (purposeKey.isBlank()) {
            error?.invoke(createLocationError(
                INTERNAL_ERROR,
                "purposeKey must not be empty."
            ))
            return
        }

        success(getCurrentAccuracyAuthorization())
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
        val validationError = validateParsedOptions(parsedOptions)
        if (validationError != null) {
            error?.invoke(validationError)
            return
        }
        val permissionError = validateRequestPermission(parsedOptions)
        if (permissionError != null) {
            error?.invoke(permissionError)
            return
        }
        if (requiresPlayServices() && !isGooglePlayServicesAvailable()) {
            error?.invoke(createPlayServicesUnavailableError())
            return
        }

        if (requiresPlayServices()) {
            getCurrentPositionWithFused(success, error, parsedOptions)
            return
        }

        val providers = getValidProviders(parsedOptions)
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

    override fun getLastKnownPosition(
        success: (GeolocationResponse) -> Unit,
        error: ((LocationError) -> Unit)?,
        options: LocationRequestOptions?
    ) {
        if (!hasLocationPermission()) {
            error?.invoke(createLocationError(
                PERMISSION_DENIED,
                "Location permission not granted"
            ))
            return
        }

        val parsedOptions = ParsedOptions.parseLastKnown(options)
        val validationError = validateParsedOptions(parsedOptions)
        if (validationError != null) {
            error?.invoke(validationError)
            return
        }
        val permissionError = validateRequestPermission(parsedOptions)
        if (permissionError != null) {
            error?.invoke(permissionError)
            return
        }
        if (requiresPlayServices() && !isGooglePlayServicesAvailable()) {
            error?.invoke(createPlayServicesUnavailableError())
            return
        }

        if (requiresPlayServices()) {
            getLastKnownPositionWithFused(success, error, parsedOptions)
            return
        }

        val providers = getValidProviders(parsedOptions)
        if (providers.isEmpty()) {
            error?.invoke(createNoLocationProviderError(parsedOptions))
            return
        }

        val cachedLocation = getBestCachedLocation(providers, parsedOptions)
        if (cachedLocation != null) {
            success(locationToPosition(cachedLocation))
            return
        }

        error?.invoke(createLocationError(
            POSITION_UNAVAILABLE,
            "No cached location available"
        ))
    }

    // MARK: - Geocoding

    override fun geocode(
        address: String,
        success: (Array<GeocodedLocation>) -> Unit,
        error: ((LocationError) -> Unit)?
    ) {
        val query = address.trim()
        if (query.isEmpty()) {
            error?.invoke(createLocationError(
                INTERNAL_ERROR,
                "address must not be empty."
            ))
            return
        }

        runGeocoderOperation(success, error, "Unable to geocode address") {
            val geocoder = Geocoder(reactContext, Locale.getDefault())
            @Suppress("DEPRECATION")
            geocoder.getFromLocationName(query, GEOCODER_MAX_RESULTS)
                .orEmpty()
                .mapNotNull { geocodedAddressToLocation(it) }
                .toTypedArray()
        }
    }

    override fun reverseGeocode(
        coords: GeocodingCoordinates,
        success: (Array<ReverseGeocodedAddress>) -> Unit,
        error: ((LocationError) -> Unit)?
    ) {
        val validationError = validateGeocodingCoordinates(coords)
        if (validationError != null) {
            error?.invoke(validationError)
            return
        }

        runGeocoderOperation(success, error, "Unable to reverse geocode coordinates") {
            val geocoder = Geocoder(reactContext, Locale.getDefault())
            @Suppress("DEPRECATION")
            geocoder.getFromLocation(
                coords.latitude,
                coords.longitude,
                GEOCODER_MAX_RESULTS
            )
                .orEmpty()
                .map { addressToReverseGeocodedAddress(it) }
                .toTypedArray()
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
        val validationError = validateParsedOptions(parsedOptions)
        if (validationError != null) {
            error?.invoke(validationError)
            return token
        }
        val permissionError = if (!hasLocationPermission()) {
            createLocationError(
                PERMISSION_DENIED,
                "Location permission not granted"
            )
        } else {
            validateRequestPermission(parsedOptions)
        }
        if (permissionError != null) {
            error?.invoke(permissionError)
            return token
        }

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

    override fun getHeading(
        success: (Heading) -> Unit,
        error: ((LocationError) -> Unit)?
    ) {
        if (!hasLocationPermission()) {
            error?.invoke(createLocationError(
                PERMISSION_DENIED,
                "Location permission not granted"
            ))
            return
        }

        headingManager.getHeading(success, error)
    }

    override fun watchHeading(
        success: (Heading) -> Unit,
        error: ((LocationError) -> Unit)?,
        options: HeadingOptions?
    ): String {
        if (!hasLocationPermission()) {
            val token = UUID.randomUUID().toString()
            error?.invoke(createLocationError(
                PERMISSION_DENIED,
                "Location permission not granted"
            ))
            return token
        }

        return headingManager.watchHeading(success, error, options)
    }

    override fun unwatch(token: String) {
        val didRemoveLocationSubscription = watchSubscriptions.remove(token) != null
        headingManager.unwatch(token)

        if (!didRemoveLocationSubscription) {
            return
        }

        // Stop watching if no more subscribers
        if (watchSubscriptions.isEmpty()) {
            stopWatchingLocation()
        } else {
            restartWatchingLocation()
        }
    }

    override fun stopObserving() {
        watchSubscriptions.clear()
        headingManager.stopObserving()
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

    private fun getCurrentAccuracyAuthorization(): AccuracyAuthorization {
        return when {
            hasFineLocationPermission() -> AccuracyAuthorization.FULL
            hasCoarseLocationPermission() -> AccuracyAuthorization.REDUCED
            else -> AccuracyAuthorization.UNKNOWN
        }
    }

    private fun validateParsedOptions(options: ParsedOptions): LocationError? {
        if (!options.timeout.isFinite() || options.timeout < 0.0) {
            return createLocationError(
                INTERNAL_ERROR,
                "timeout must be a finite number greater than or equal to 0."
            )
        }

        if (!options.maximumAge.isFinite() && options.maximumAge != Double.POSITIVE_INFINITY) {
            return createLocationError(
                INTERNAL_ERROR,
                "maximumAge must be a finite number greater than or equal to 0."
            )
        }

        if (options.maximumAge < 0.0) {
            return createLocationError(
                INTERNAL_ERROR,
                "maximumAge must be greater than or equal to 0."
            )
        }

        if (!options.interval.isFinite() || options.interval <= 0.0) {
            return createLocationError(
                INTERNAL_ERROR,
                "interval must be a finite number greater than 0."
            )
        }

        if (!options.fastestInterval.isFinite() || options.fastestInterval <= 0.0) {
            return createLocationError(
                INTERNAL_ERROR,
                "fastestInterval must be a finite number greater than 0."
            )
        }

        if (!options.distanceFilter.isFinite() || options.distanceFilter < 0.0) {
            return createLocationError(
                INTERNAL_ERROR,
                "distanceFilter must be a finite number greater than or equal to 0."
            )
        }

        val maxUpdateAge = options.maxUpdateAge
        if (maxUpdateAge != null && (!maxUpdateAge.isFinite() || maxUpdateAge < 0.0)) {
            return createLocationError(
                INTERNAL_ERROR,
                "maxUpdateAge must be a finite number greater than or equal to 0."
            )
        }

        if (!options.maxUpdateDelay.isFinite() || options.maxUpdateDelay < 0.0) {
            return createLocationError(
                INTERNAL_ERROR,
                "maxUpdateDelay must be a finite number greater than or equal to 0."
            )
        }

        val maxUpdates = options.maxUpdates
        if (maxUpdates != null && maxUpdates < 1) {
            return createLocationError(
                INTERNAL_ERROR,
                "maxUpdates must be greater than or equal to 1."
            )
        }

        return null
    }

    private fun validateRequestPermission(options: ParsedOptions): LocationError? {
        if (options.granularity == AndroidGranularity.FINE && !hasFineLocationPermission()) {
            return createLocationError(
                PERMISSION_DENIED,
                "Fine location permission is required for granularity=fine."
            )
        }

        return null
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

    private fun getValidProvider(options: ParsedOptions): String? {
        return getValidProviders(options).firstOrNull()
    }

    private fun getValidProviders(options: ParsedOptions): List<String> {
        return getValidProviders(options.androidAccuracy)
            .filter { provider -> options.granularity.allowsProvider(provider) }
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
        val maximumAge = effectiveMaximumAge(options)
        if (maximumAge <= 0.0) return false

        val locationAge = SystemClock.elapsedRealtime() - location.elapsedRealtimeNanos / 1_000_000
        if (locationAge.coerceAtLeast(0L) >= maximumAge) {
            return false
        }

        if (options.waitForAccurateLocation && !isLocationAccurateEnough(location, options)) {
            return false
        }

        return true
    }

    private fun effectiveMaximumAge(options: ParsedOptions): Double {
        val maxUpdateAge = options.maxUpdateAge ?: return options.maximumAge
        return minOf(options.maximumAge, maxUpdateAge)
    }

    private fun isLocationAccurateEnough(location: Location, options: ParsedOptions): Boolean {
        if (!location.hasAccuracy()) return false

        val requiredAccuracy = when (options.androidAccuracy.mode) {
            AndroidAccuracyMode.HIGH -> 25f
            AndroidAccuracyMode.BALANCED -> 100f
            AndroidAccuracyMode.LOW -> 500f
            AndroidAccuracyMode.PASSIVE -> Float.MAX_VALUE
        }

        return location.accuracy <= requiredAccuracy
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
                    (options.maximumAge == Double.POSITIVE_INFINITY && options.maxUpdateAge == null))
            ) {
                bestLocation = selectBestLocation(lastKnownLocation, bestLocation)
            }
        }

        return bestLocation
    }

    private fun getCurrentPositionWithFused(
        success: (GeolocationResponse) -> Unit,
        error: ((LocationError) -> Unit)?,
        options: ParsedOptions
    ) {
        if (effectiveMaximumAge(options) > 0.0) {
            getFusedCachedLocation(options) { cachedLocation ->
                if (cachedLocation != null) {
                    success(locationToPosition(cachedLocation))
                    return@getFusedCachedLocation
                }

                requestFusedFreshLocation(success, error, options)
            }
            return
        }

        requestFusedFreshLocation(success, error, options)
    }

    private fun getLastKnownPositionWithFused(
        success: (GeolocationResponse) -> Unit,
        error: ((LocationError) -> Unit)?,
        options: ParsedOptions
    ) {
        getFusedCachedLocation(options) { cachedLocation ->
            if (cachedLocation != null) {
                success(locationToPosition(cachedLocation))
                return@getFusedCachedLocation
            }

            error?.invoke(createLocationError(
                POSITION_UNAVAILABLE,
                "No cached location available"
            ))
        }
    }

    private fun getFusedCachedLocation(
        options: ParsedOptions,
        completion: (Location?) -> Unit
    ) {
        // Fused lastLocation is not requested with LocationRequest granularity,
        // so it cannot prove that a cached fix satisfies coarse-only callers.
        if (options.granularity == AndroidGranularity.COARSE) {
            completion(null)
            return
        }

        try {
            fusedLocationClient.lastLocation
                .addOnSuccessListener { location ->
                    completion(location?.takeIf { isCachedLocationValid(it, options) })
                }
                .addOnFailureListener {
                    completion(null)
                }
                .addOnCanceledListener {
                    completion(null)
                }
        } catch (e: SecurityException) {
            completion(null)
        }
    }

    private fun requestFusedFreshLocation(
        success: (GeolocationResponse) -> Unit,
        error: ((LocationError) -> Unit)?,
        options: ParsedOptions
    ) {
        val handler = Handler(Looper.getMainLooper())
        val didComplete = AtomicBoolean(false)
        lateinit var callback: LocationCallback

        fun complete(result: PositionResult) {
            if (!didComplete.compareAndSet(false, true)) return

            handler.removeCallbacksAndMessages(null)
            try {
                fusedLocationClient.removeLocationUpdates(callback)
            } catch (_: Exception) {
                // Ignore cleanup races.
            }

            when (result) {
                is PositionResult.Success -> success(result.position)
                is PositionResult.Failure -> error?.invoke(result.error)
            }
        }

        callback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                val location = result.lastLocation
                if (location != null) {
                    complete(PositionResult.Success(locationToPosition(location)))
                }
            }
        }

        val timeoutRunnable = Runnable {
            complete(PositionResult.Failure(createPositionTimeoutError(options)))
        }

        try {
            fusedLocationClient.requestLocationUpdates(
                buildFusedLocationRequest(
                    options,
                    maxUpdatesOverride = 1,
                    includeDistanceFilter = false
                ),
                callback,
                Looper.getMainLooper()
            )
            handler.postDelayed(timeoutRunnable, coerceTimeoutMillis(options.timeout))
        } catch (e: SecurityException) {
            complete(PositionResult.Failure(createLocationError(
                PERMISSION_DENIED,
                "Security exception: ${e.message}"
            )))
        } catch (e: Exception) {
            complete(PositionResult.Failure(createLocationError(
                POSITION_UNAVAILABLE,
                "Unable to request fused location: ${e.message}"
            )))
        }
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

        // Android's getCurrentLocation may resolve a recent historical fix. A maximumAge of 0
        // means callers explicitly asked us to wait for a fresh provider update.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && request.options.maximumAge > 0.0) {
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

        if (requiresPlayServices()) {
            startWatchingFusedLocation()
            return
        }

        val mergedOptions = mergeWatchOptions()
        val provider = getValidProvider(mergedOptions)
        if (provider == null) {
            notifyWatchProviderUnavailable()
            return
        }
        currentWatchProvider = provider

        val listener = object : LocationListener {
            override fun onLocationChanged(location: Location) {
                val position = locationToPosition(location)
                deliverWatchPosition(position)
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
                mergedOptions.interval.toLong(),
                mergedOptions.distanceFilter.toFloat(),
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

    private fun startWatchingFusedLocation() {
        val mergedOptions = mergeWatchOptions()
        val callback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                val location = result.lastLocation ?: return
                deliverWatchPosition(locationToPosition(location))
            }
        }

        fusedWatchLocationCallback = callback

        try {
            fusedLocationClient.requestLocationUpdates(
                buildFusedLocationRequest(mergedOptions),
                callback,
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
        } catch (e: Exception) {
            val error = LocationError(
                code = POSITION_UNAVAILABLE,
                message = "Unable to request fused location updates: ${e.message}"
            )

            for ((_, subscription) in watchSubscriptions) {
                subscription.error?.invoke(error)
            }
        }
    }

    private fun mergeWatchOptions(): ParsedOptions {
        var androidAccuracy: AndroidAccuracyResolution? = null
        var smallestInterval = Double.MAX_VALUE
        var smallestFastestInterval = Double.MAX_VALUE
        var smallestDistanceFilter = Double.MAX_VALUE
        var granularity = AndroidGranularity.PERMISSION
        var waitForAccurateLocation = false
        var maxUpdateAge: Double? = null
        var smallestMaxUpdateDelay = Double.MAX_VALUE

        for ((_, subscription) in watchSubscriptions) {
            androidAccuracy = mostDemandingAndroidAccuracy(
                androidAccuracy,
                subscription.options.androidAccuracy
            )
            smallestInterval = minOf(smallestInterval, subscription.options.interval)
            smallestFastestInterval = minOf(
                smallestFastestInterval,
                subscription.options.fastestInterval
            )
            smallestDistanceFilter = minOf(
                smallestDistanceFilter,
                subscription.options.distanceFilter
            )
            granularity = mergeWatchGranularity(granularity, subscription.options.granularity)
            waitForAccurateLocation = waitForAccurateLocation ||
                subscription.options.waitForAccurateLocation
            maxUpdateAge = mergeNullableMinimum(maxUpdateAge, subscription.options.maxUpdateAge)
            smallestMaxUpdateDelay = minOf(
                smallestMaxUpdateDelay,
                subscription.options.maxUpdateDelay
            )
        }

        return ParsedOptions(
            timeout = Double.POSITIVE_INFINITY,
            maximumAge = 0.0,
            androidAccuracy = androidAccuracy ?: resolveAndroidAccuracy(null, enableHighAccuracy = false),
            interval = smallestInterval,
            fastestInterval = smallestFastestInterval,
            distanceFilter = smallestDistanceFilter,
            granularity = granularity,
            waitForAccurateLocation = waitForAccurateLocation,
            maxUpdateAge = maxUpdateAge,
            maxUpdateDelay = if (smallestMaxUpdateDelay == Double.MAX_VALUE) 0.0 else smallestMaxUpdateDelay,
            maxUpdates = null
        )
    }

    private fun deliverWatchPosition(position: GeolocationResponse) {
        val tokensToRemove = mutableListOf<String>()

        for ((token, subscription) in watchSubscriptions) {
            subscription.success(position)
            subscription.deliveredUpdates += 1

            val maxUpdates = subscription.options.maxUpdates
            if (maxUpdates != null && subscription.deliveredUpdates >= maxUpdates) {
                tokensToRemove.add(token)
            }
        }

        for (token in tokensToRemove) {
            watchSubscriptions.remove(token)
        }

        if (tokensToRemove.isNotEmpty()) {
            if (watchSubscriptions.isEmpty()) {
                stopWatchingLocation()
            } else {
                restartWatchingLocation()
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

    private fun mergeWatchGranularity(
        current: AndroidGranularity,
        next: AndroidGranularity
    ): AndroidGranularity {
        return when {
            current == AndroidGranularity.COARSE || next == AndroidGranularity.COARSE -> {
                AndroidGranularity.COARSE
            }
            current == AndroidGranularity.FINE || next == AndroidGranularity.FINE -> {
                AndroidGranularity.FINE
            }
            else -> AndroidGranularity.PERMISSION
        }
    }

    private fun mergeNullableMinimum(current: Double?, next: Double?): Double? {
        return when {
            current == null -> next
            next == null -> current
            else -> minOf(current, next)
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
        fusedWatchLocationCallback?.let { callback ->
            try {
                fusedLocationClient.removeLocationUpdates(callback)
            } catch (e: Exception) {
                // Ignore
            }
        }
        watchLocationListener = null
        fusedWatchLocationCallback = null
        currentWatchProvider = null
    }

    private fun restartWatchingLocation() {
        stopWatchingLocation()
        startWatchingLocation()
    }

    // MARK: - Helper Functions - Conversion

    private fun locationToPosition(location: Location): GeolocationResponse {
        lastLocation = location

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

    private fun geocodedAddressToLocation(address: Address): GeocodedLocation? {
        if (!address.hasLatitude() || !address.hasLongitude()) {
            return null
        }

        return GeocodedLocation(
            latitude = address.latitude,
            longitude = address.longitude,
            accuracy = null
        )
    }

    private fun addressToReverseGeocodedAddress(address: Address): ReverseGeocodedAddress {
        return ReverseGeocodedAddress(
            country = address.countryName.nonBlankOrNull(),
            region = address.adminArea.nonBlankOrNull(),
            city = (address.locality ?: address.subAdminArea).nonBlankOrNull(),
            district = address.subLocality.nonBlankOrNull(),
            street = formatStreet(address),
            postalCode = address.postalCode.nonBlankOrNull(),
            formattedAddress = formatAddressLines(address)
        )
    }

    private fun formatStreet(address: Address): String? {
        return listOf(address.subThoroughfare, address.thoroughfare)
            .mapNotNull { it.nonBlankOrNull() }
            .joinToString(" ")
            .nonBlankOrNull()
    }

    private fun formatAddressLines(address: Address): String? {
        if (address.maxAddressLineIndex < 0) {
            return null
        }

        return (0..address.maxAddressLineIndex)
            .mapNotNull { index -> address.getAddressLine(index).nonBlankOrNull() }
            .joinToString(", ")
            .nonBlankOrNull()
    }

    private fun validateGeocodingCoordinates(coords: GeocodingCoordinates): LocationError? {
        if (!coords.latitude.isFinite() || coords.latitude < -90.0 || coords.latitude > 90.0) {
            return createLocationError(
                INTERNAL_ERROR,
                "latitude must be a finite number between -90 and 90."
            )
        }

        if (!coords.longitude.isFinite() || coords.longitude < -180.0 || coords.longitude > 180.0) {
            return createLocationError(
                INTERNAL_ERROR,
                "longitude must be a finite number between -180 and 180."
            )
        }

        return null
    }

    private fun <T> runGeocoderOperation(
        success: (Array<T>) -> Unit,
        error: ((LocationError) -> Unit)?,
        failurePrefix: String,
        operation: () -> Array<T>
    ) {
        if (!Geocoder.isPresent()) {
            error?.invoke(createLocationError(
                POSITION_UNAVAILABLE,
                "Platform geocoder is not available."
            ))
            return
        }

        val handler = Handler(Looper.getMainLooper())

        Thread {
            try {
                val results = operation()
                handler.post { success(results) }
            } catch (e: IOException) {
                handler.post {
                    error?.invoke(createLocationError(
                        POSITION_UNAVAILABLE,
                        "$failurePrefix: ${e.message ?: "geocoder service unavailable"}"
                    ))
                }
            } catch (e: Exception) {
                handler.post {
                    error?.invoke(createLocationError(
                        INTERNAL_ERROR,
                        "$failurePrefix: ${e.message ?: "unknown error"}"
                    ))
                }
            }
        }.start()
    }

    private fun createLocationAvailability(
        available: Boolean,
        reason: String?
    ): LocationAvailability {
        return LocationAvailability(
            available = available,
            reason = reason
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

    private fun buildFusedLocationRequest(
        options: ParsedOptions,
        maxUpdatesOverride: Int? = null,
        includeDistanceFilter: Boolean = true
    ): GmsLocationRequest {
        val builder = GmsLocationRequest
            .Builder(options.androidAccuracy.gmsPriority(), coercePositiveMillis(options.interval))
            .setMinUpdateIntervalMillis(coercePositiveMillis(options.fastestInterval))
            .setGranularity(options.granularity.gmsGranularity())
            .setWaitForAccurateLocation(options.waitForAccurateLocation)
            .setMaxUpdateDelayMillis(coerceNonNegativeMillis(options.maxUpdateDelay))

        if (includeDistanceFilter) {
            builder.setMinUpdateDistanceMeters(options.distanceFilter.toFloat())
        }

        options.maxUpdateAge?.let { value ->
            builder.setMaxUpdateAgeMillis(coerceNonNegativeMillis(value))
        }

        val maxUpdates = maxUpdatesOverride ?: options.maxUpdates
        if (maxUpdates != null) {
            builder.setMaxUpdates(maxUpdates)
        }

        return builder.build()
    }

    private fun coercePositiveMillis(value: Double): Long {
        return when {
            value.isNaN() || value <= 0.0 -> 1L
            value.isInfinite() || value >= Long.MAX_VALUE.toDouble() -> Long.MAX_VALUE
            else -> value.toLong()
        }
    }

    private fun coerceNonNegativeMillis(value: Double): Long {
        return when {
            value.isNaN() || value <= 0.0 -> 0L
            value.isInfinite() || value >= Long.MAX_VALUE.toDouble() -> Long.MAX_VALUE
            else -> value.toLong()
        }
    }

    companion object {
        private const val PERMISSION_REQUEST_CODE = 8947
        private const val GEOCODER_MAX_RESULTS = 5
        private const val TWO_MINUTES_MS = 2 * 60 * 1000L
    }
}

private fun String?.nonBlankOrNull(): String? {
    return this?.trim()?.takeIf { it.isNotEmpty() }
}
