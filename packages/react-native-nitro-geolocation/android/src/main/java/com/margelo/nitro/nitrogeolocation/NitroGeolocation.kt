package com.margelo.nitro.nitrogeolocation

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager as AndroidLocationManager
import android.os.Build
import android.os.SystemClock
import androidx.core.content.ContextCompat
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.modules.core.PermissionAwareActivity
import com.facebook.react.modules.core.PermissionListener
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.location.LocationServices
import com.margelo.nitro.NitroModules
import com.margelo.nitro.core.Promise
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

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
            createLocationError = ::createLocationError
        )
    }
    private val providerStatusWatcherDelegate = lazy { AndroidProviderStatusWatcher(reactContext, locationSettings) }
    private val providerStatusWatcher by providerStatusWatcherDelegate
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
    private val currentPositionManager by lazy {
        AndroidCurrentPositionManager(
            locationManager = locationManager,
            isCachedLocationValid = ::isCachedLocationValid,
            effectiveMaximumAge = ::effectiveMaximumAge,
            createNoProviderError = ::createNoLocationProviderError,
            createTimeoutError = ::createPositionTimeoutError,
            locationToPosition = { location -> locationToPosition(location) }
        )
    }
    private val positionWatchManager by lazy {
        AndroidPositionWatchManager(
            locationManager = locationManager,
            fusedLocationClient = fusedLocationClient,
            fusedLocationProvider = fusedLocationProvider,
            providerRoute = {
                currentProviderRoute(isGooglePlayServicesAvailable())
            },
            configuredProvider = { configuration?.locationProvider },
            getValidProvider = ::getValidProvider,
            getNoProviderMessage = ::getNoLocationProviderMessage,
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
    private val geocoder by lazy { AndroidGeocoder(reactContext) }
    private var lastLocation: Location? = null

    // Permission callbacks
    private val pendingPermissionResolvers = mutableListOf<(PermissionStatus) -> Unit>()

    // getCurrentPosition requests
    private val cancellablePositionRequests =
        ConcurrentHashMap<String, CurrentPositionCancellationState>()

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
        // Android reports missing location permission as DENIED even before a
        // runtime prompt has been shown, so denied must still request.
        val currentStatus = getCurrentPermissionStatus()
        if (currentStatus == PermissionStatus.GRANTED) {
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

    override fun watchProviderStatus(success: (LocationProviderStatus) -> Unit) = providerStatusWatcher.watch(success)

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
        success: (LocationSettingsResult) -> Unit,
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
        getCurrentPositionInternal(success, options, error, null, null)
    }

    override fun getCurrentPositionCancellable(
        requestId: String,
        success: (GeolocationResponse) -> Unit,
        options: LocationRequestOptions,
        error: ((LocationError) -> Unit)?
    ) {
        val cancellationState = CurrentPositionCancellationState()
        cancellablePositionRequests.put(requestId, cancellationState)?.cancel()

        val finishRequest = {
            cancellablePositionRequests.remove(requestId)
        }
        getCurrentPositionInternal(
            success = { position ->
                if (cancellationState.finish()) {
                    finishRequest()
                    success(position)
                }
            },
            options = options,
            error = { locationError ->
                if (cancellationState.finish()) {
                    finishRequest()
                    error?.invoke(locationError)
                }
            },
            requestId = requestId,
            cancellationState = cancellationState
        )
    }

    override fun cancelCurrentPositionRequest(requestId: String) {
        cancellablePositionRequests.remove(requestId)?.cancel()
    }

    private fun getCurrentPositionInternal(
        success: (GeolocationResponse) -> Unit,
        options: LocationRequestOptions,
        error: ((LocationError) -> Unit)?,
        requestId: String?,
        cancellationState: CurrentPositionCancellationState?
    ) {
        if (cancellationState?.isActive() == false) return

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
                    if (cancellationState?.isActive() == false) return@getCurrentPosition
                    runAndroidCurrentPositionFallbackAfterFusedFailure(
                        locationProvider = configuration?.locationProvider,
                        runPlatformFallback = {
                            getCurrentPositionWithPlatform(
                                success,
                                error,
                                parsedOptions,
                                deadlineElapsedRealtime,
                                requestId,
                                cancellationState
                            )
                        },
                        failWithoutFallback = {
                            error?.invoke(fusedError)
                        }
                    )
                },
                parsedOptions,
                deadlineElapsedRealtime,
                onCancellationReady = { action ->
                    cancellationState?.setCancellationAction(action)
                }
            )
            return
        }

        getCurrentPositionWithPlatform(
            success,
            error,
            parsedOptions,
            deadlineElapsedRealtime,
            requestId,
            cancellationState
        )
    }

    private fun getCurrentPositionWithPlatform(
        success: (GeolocationResponse) -> Unit,
        error: ((LocationError) -> Unit)?,
        parsedOptions: ParsedOptions,
        deadlineElapsedRealtime: Long = createRequestDeadlineElapsedRealtime(parsedOptions.timeout),
        requestId: String? = null,
        cancellationState: CurrentPositionCancellationState? = null
    ) {
        if (cancellationState?.isActive() == false) return

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
        currentPositionManager.requestFreshLocation(
            providers,
            parsedOptions,
            deadlineElapsedRealtime,
            { result ->
                when (result) {
                    is PositionResult.Success -> success(result.position)
                    is PositionResult.Failure -> error?.invoke(result.error)
                }
            },
            requestId,
            onCancellationReady = { action ->
                cancellationState?.setCancellationAction(action)
            }
        )
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
        geocoder.geocode(address, success, error)
    }

    override fun reverseGeocode(
        coords: GeocodingCoordinates,
        success: (Array<ReverseGeocodedAddress>) -> Unit,
        error: ((LocationError) -> Unit)?
    ) {
        geocoder.reverseGeocode(coords, success, error)
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

        return positionWatchManager.watch(success, error, parsedOptions)
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
        positionWatchManager.unwatch(token)
        headingManager.unwatch(token)
        providerStatusWatcherDelegate.takeIf { it.isInitialized() }?.value?.unwatch(token)
    }

    override fun getActiveWatches(): Array<ActiveWatch> {
        val watches = positionWatchManager.activeWatches()
        val headings = headingManager.getActiveWatchTokens().map {
            ActiveWatch(token = it, kind = ActiveWatchKind.HEADING)
        }
        return (watches + headings).sortedBy { it.token }.toTypedArray()
    }

    override fun stopObserving() {
        positionWatchManager.stopObserving()
        headingManager.stopObserving()
        providerStatusWatcherDelegate.takeIf { it.isInitialized() }?.value?.stopObserving()
    }
    override fun dispose() {
        runCatching { providerStatusWatcherDelegate.takeIf { it.isInitialized() }?.value?.dispose() }
        super.dispose()
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

    // MARK: - Helper Functions - Conversion

    private fun locationToPosition(
        location: Location,
        providerOverride: LocationProviderUsed? = null
    ): GeolocationResponse {
        lastLocation = location

        return location.toGeolocationResponse(providerOverride)
    }

    companion object {
        private const val PERMISSION_REQUEST_CODE = 8947
    }
}
