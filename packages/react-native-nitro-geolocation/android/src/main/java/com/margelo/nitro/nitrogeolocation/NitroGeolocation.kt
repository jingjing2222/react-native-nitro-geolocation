package com.margelo.nitro.nitrogeolocation

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Geocoder
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager as AndroidLocationManager
import android.os.Build
import android.os.CancellationSignal
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import androidx.core.content.ContextCompat
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.modules.core.PermissionAwareActivity
import com.facebook.react.modules.core.PermissionListener
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.margelo.nitro.NitroModules
import com.margelo.nitro.core.Promise
import java.io.IOException
import java.util.Locale
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicLong

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
    private val fusedLocationProvider by lazy {
        AndroidFusedLocationProvider(
            fusedLocationClient = fusedLocationClient,
            isCachedLocationValid = ::isCachedLocationValid,
            effectiveMaximumAge = ::effectiveMaximumAge,
            locationToPosition = ::locationToPosition
        )
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
    private val watchLocationGeneration = AtomicLong(0L)

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

        val permissionAware = activity as? PermissionAwareActivity
        if (permissionAware == null) {
            error?.invoke(createLocationError(
                INTERNAL_ERROR,
                "Current activity cannot request permissions"
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

        permissionAware.requestPermissions(
            permissions,
            PERMISSION_REQUEST_CODE,
            createPermissionListener()
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

        if (currentProviderRoute(isGooglePlayServicesAvailable()) == AndroidProviderRoute.FUSED) {
            fusedLocationClient.locationAvailability
                .addOnSuccessListener { availability ->
                    if (availability.isLocationAvailable) {
                        promise.resolve(createLocationAvailability(true, null))
                        return@addOnSuccessListener
                    }

                    promise.resolve(getPlatformLocationAvailability())
                }
                .addOnFailureListener {
                    promise.resolve(getPlatformLocationAvailability())
                }
                .addOnCanceledListener {
                    promise.resolve(getPlatformLocationAvailability())
                }
            return promise
        }

        promise.resolve(getPlatformLocationAvailability())
        return promise
    }

    override fun requestLocationSettings(
        success: (LocationProviderStatus) -> Unit,
        options: LocationSettingsOptions,
        error: ((LocationError) -> Unit)?
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
        options: LocationRequestOptions,
        error: ((LocationError) -> Unit)?
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
        val deadlineElapsedRealtime = createRequestDeadlineElapsedRealtime(parsedOptions.timeout)
        if (currentProviderRoute(isGooglePlayServicesAvailable()) == AndroidProviderRoute.FUSED) {
            fusedLocationProvider.getCurrentPosition(
                success,
                { fusedError ->
                    runAndroidCurrentPositionFallbackAfterFusedFailure(
                        locationProvider = configuration?.locationProvider,
                        runPlatformFallback = {
                            getCurrentPositionWithPlatform(
                                success,
                                error,
                                parsedOptions,
                                deadlineElapsedRealtime
                            )
                        },
                        failWithoutFallback = {
                            error?.invoke(fusedError)
                        }
                    )
                },
                parsedOptions,
                deadlineElapsedRealtime
            )
            return
        }

        getCurrentPositionWithPlatform(success, error, parsedOptions, deadlineElapsedRealtime)
    }

    private fun getCurrentPositionWithPlatform(
        success: (GeolocationResponse) -> Unit,
        error: ((LocationError) -> Unit)?,
        parsedOptions: ParsedOptions,
        deadlineElapsedRealtime: Long = createRequestDeadlineElapsedRealtime(parsedOptions.timeout)
    ) {
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

        if (remainingTimeoutMillis(deadlineElapsedRealtime) <= 0L) {
            error?.invoke(createPositionTimeoutError(parsedOptions))
            return
        }

        // Request fresh location
        requestFreshLocation(providers, parsedOptions, deadlineElapsedRealtime) { result ->
            when (result) {
                is PositionResult.Success -> success(result.position)
                is PositionResult.Failure -> error?.invoke(result.error)
            }
        }
    }

    override fun getLastKnownPosition(
        success: (GeolocationResponse) -> Unit,
        options: LocationRequestOptions,
        error: ((LocationError) -> Unit)?
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
        if (currentProviderRoute(isGooglePlayServicesAvailable()) == AndroidProviderRoute.FUSED) {
            fusedLocationProvider.getLastKnownPosition(
                success,
                { fusedError ->
                    runAndroidLastKnownPositionFallbackAfterFusedFailure(
                        locationProvider = configuration?.locationProvider,
                        runPlatformFallback = {
                            getLastKnownPositionWithPlatform(success, error, parsedOptions)
                        },
                        failWithoutFallback = {
                            error?.invoke(fusedError)
                        }
                    )
                },
                parsedOptions
            )
            return
        }

        getLastKnownPositionWithPlatform(success, error, parsedOptions)
    }

    private fun getLastKnownPositionWithPlatform(
        success: (GeolocationResponse) -> Unit,
        error: ((LocationError) -> Unit)?,
        parsedOptions: ParsedOptions
    ) {
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
                .mapNotNull { it.toGeocodedLocation() }
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
                .map { it.toReverseGeocodedAddress() }
                .toTypedArray()
        }
    }

    // MARK: - Watch Position (Callback-based with tokens)

    override fun watchPosition(
        success: (GeolocationResponse) -> Unit,
        options: LocationRequestOptions,
        error: ((LocationError) -> Unit)?
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
        options: HeadingOptions,
        error: ((LocationError) -> Unit)?
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

    private fun createPermissionListener() =
        PermissionListener { requestCode, _, grantResults ->
            onPermissionResult(requestCode, grantResults)
            requestCode == PERMISSION_REQUEST_CODE
        }

    private fun onPermissionResult(requestCode: Int, grantResults: IntArray) {
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

    private fun currentProviderRoute(
        googlePlayServicesAvailable: Boolean
    ): AndroidProviderRoute {
        return selectAndroidProviderRoute(
            locationProvider = configuration?.locationProvider,
            googlePlayServicesAvailable = googlePlayServicesAvailable
        )
    }

    private fun isGooglePlayServicesAvailable(): Boolean {
        return GoogleApiAvailability.getInstance()
            .isGooglePlayServicesAvailable(reactContext) == ConnectionResult.SUCCESS
    }

    private fun getPlatformLocationAvailability(): LocationAvailability {
        val providers = getValidProviders(resolveAndroidAccuracy(null, enableHighAccuracy = false))
        val reason = if (providers.isEmpty()) "noLocationProvider" else null
        return createLocationAvailability(providers.isNotEmpty(), reason)
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

    // MARK: - Helper Functions - Request Fresh Location

    private fun requestFreshLocation(
        providers: List<String>,
        options: ParsedOptions,
        deadlineElapsedRealtime: Long = createRequestDeadlineElapsedRealtime(options.timeout),
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
            deadlineElapsedRealtime = deadlineElapsedRealtime
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

        // Android's getCurrentLocation may resolve a recent historical fix. An effective
        // maximum age of 0 means callers explicitly asked us to wait for a fresh update.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && effectiveMaximumAge(request.options) > 0.0) {
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
                    if (location != null && isCachedLocationValid(location, request.options)) {
                        pendingPositionRequests.remove(requestId)
                        val position = locationToPosition(location)
                        request.resolver(PositionResult.Success(position))
                    } else if (location != null) {
                        retryCurrentLocationLegacyAfterStaleModern(
                            provider,
                            requestId,
                            handler,
                            request
                        )
                    } else {
                        handleProviderFailure(requestId, createLocationError(
                            POSITION_UNAVAILABLE,
                            "Unable to get fresh location"
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

    private fun retryCurrentLocationLegacyAfterStaleModern(
        provider: String,
        requestId: UUID,
        handler: Handler,
        request: PositionRequest
    ) {
        request.cancellationSignal?.cancel()
        request.cancellationSignal = null

        val remainingTimeoutMillis = request.remainingTimeoutMillis()
        if (remainingTimeoutMillis <= 0L) {
            handlePositionTimeout(requestId)
            return
        }

        requestCurrentLocationLegacy(provider, requestId, handler, remainingTimeoutMillis)
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
        val generation = watchLocationGeneration.get()

        if (currentProviderRoute(isGooglePlayServicesAvailable()) == AndroidProviderRoute.FUSED) {
            startWatchingFusedLocation(generation)
            return
        }

        startWatchingPlatformLocation(generation)
    }

    private fun isActiveWatchGeneration(generation: Long): Boolean {
        return watchSubscriptions.isNotEmpty() && watchLocationGeneration.get() == generation
    }

    private fun startWatchingPlatformLocation(generation: Long) {
        if (!isActiveWatchGeneration(generation)) return

        val mergedOptions = mergeWatchOptions()
        val provider = getValidProvider(mergedOptions)
        if (provider == null) {
            notifyWatchProviderUnavailable()
            return
        }

        val listener = object : LocationListener {
            override fun onLocationChanged(location: Location) {
                if (!isActiveWatchGeneration(generation)) return

                val position = locationToPosition(location)
                deliverWatchPosition(position)
            }

            override fun onProviderDisabled(provider: String) {
                if (!isActiveWatchGeneration(generation)) return

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

        removePlatformWatchLocationListener()
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

    private fun startWatchingFusedLocation(generation: Long) {
        if (!isActiveWatchGeneration(generation)) return

        val mergedOptions = mergeWatchOptions()
        val callback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                if (!isActiveWatchGeneration(generation)) return

                val location = result.lastLocation ?: return
                deliverWatchPosition(locationToPosition(location, LocationProviderUsed.FUSED))
            }
        }

        removeFusedWatchLocationCallback()
        fusedWatchLocationCallback = callback

        fun handleFusedRequestFailure(fusedError: LocationError? = null) {
            if (!isActiveWatchGeneration(generation)) return

            removeFusedWatchLocationCallback()
            runAndroidWatchPositionFallbackAfterFusedFailure(
                locationProvider = configuration?.locationProvider,
                runPlatformFallback = { startWatchingPlatformLocation(generation) },
                failWithoutFallback = {
                    if (fusedError != null) {
                        notifyWatchError(fusedError)
                    } else {
                        notifyWatchProviderUnavailable()
                    }
                }
            )
        }

        fusedLocationProvider.requestWatchUpdates(
            options = mergedOptions,
            callback = callback,
            onInactiveStart = {
                if (!isActiveWatchGeneration(generation)) {
                    try {
                        fusedLocationClient.removeLocationUpdates(callback)
                    } catch (e: Exception) {
                        // Ignore
                    }
                }
            },
            onFailure = { fusedError -> handleFusedRequestFailure(fusedError) }
        )
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

    private fun notifyWatchError(error: LocationError) {
        for ((_, subscription) in watchSubscriptions) {
            subscription.error?.invoke(error)
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
        watchLocationGeneration.incrementAndGet()
        removePlatformWatchLocationListener()
        removeFusedWatchLocationCallback()
    }

    private fun removePlatformWatchLocationListener() {
        watchLocationListener?.let { listener ->
            try {
                locationManager.removeUpdates(listener)
            } catch (e: Exception) {
                // Ignore
            }
        }
        watchLocationListener = null
    }

    private fun removeFusedWatchLocationCallback() {
        fusedWatchLocationCallback?.let { callback ->
            try {
                fusedLocationClient.removeLocationUpdates(callback)
            } catch (e: Exception) {
                // Ignore
            }
        }
        fusedWatchLocationCallback = null
    }

    private fun restartWatchingLocation() {
        stopWatchingLocation()
        startWatchingLocation()
    }

    // MARK: - Helper Functions - Conversion

    private fun locationToPosition(
        location: Location,
        providerOverride: LocationProviderUsed? = null
    ): GeolocationResponse {
        lastLocation = location

        return location.toGeolocationResponse(providerOverride)
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

    companion object {
        private const val PERMISSION_REQUEST_CODE = 8947
        private const val GEOCODER_MAX_RESULTS = 5
        private const val TWO_MINUTES_MS = 2 * 60 * 1000L
    }
}
