package com.margelo.nitro.nitrogeolocation.background

import android.annotation.SuppressLint
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.location.Location
import android.location.LocationManager
import android.os.Build
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.ReactApplicationContext
import com.google.android.gms.location.Geofence
import com.google.android.gms.location.ActivityRecognition
import com.google.android.gms.location.ActivityRecognitionResult
import com.google.android.gms.location.GeofencingEvent
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationServices
import com.margelo.nitro.nitrogeolocation.*
import java.util.concurrent.CompletableFuture
import java.util.UUID
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

class NitroBackgroundLocationController private constructor(
    private val context: Context
) {
    val eventHub = NitroBackgroundEventHub()
    val store = NitroBackgroundStore(context)
    private val appContext = context.applicationContext
    private val fusedLocationClient by lazy {
        LocationServices.getFusedLocationProviderClient(appContext)
    }
    private val geofencingClient by lazy {
        LocationServices.getGeofencingClient(appContext)
    }
    private val activityRecognitionClient by lazy {
        ActivityRecognition.getClient(appContext)
    }
    private val platformLocationManager by lazy {
        appContext.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    }
    private val prefs =
        appContext.getSharedPreferences(BACKGROUND_LOCATION_PREFS, Context.MODE_PRIVATE)
    private val permissions = AndroidBackgroundPermissions(appContext) { getConfigOrNull() }
    private val httpSync = AndroidBackgroundHttpSync()
    private val configStore = NitroBackgroundConfigStore(prefs)
    private val pendingIntents by lazy { NitroBackgroundPendingIntents(appContext) }
    private val registrations = NitroBackgroundRegistrations(prefs)
    private val serviceStartup = NitroBackgroundServiceStartup()
    private val syncGate = NitroBackgroundSyncGate(registrations, prefs)
    private val serviceCommandLock = ReentrantLock()
    private val geofenceCoordinator by lazy {
        NitroBackgroundGeofenceCoordinator(
            geofencingClient,
            pendingIntents,
            store,
            permissions::backgroundPermission,
            { runGeneration },
            ::activeServiceGeneration,
            ::recordError
        )
    }
    private val activityCoordinator by lazy {
        NitroBackgroundActivityCoordinator(
            pendingIntents,
            registrations,
            { runGeneration },
            { interval, callback ->
                activityRecognitionClient.requestActivityUpdates(interval, callback)
            },
            { callback -> activityRecognitionClient.removeActivityUpdates(callback) }
        )
    }

    @Volatile
    private var config: BackgroundLocationOptions? = null

    @Volatile
    private var state = BackgroundLocationState.IDLE

    // Promise workers must not interleave lifecycle transitions on the singleton.
    private val lifecycleLock = Any()
    private val storageLock = Any()

    @Volatile
    private var runGeneration = prefs.getLong(PREF_RUN_GENERATION, 0L)
    @Volatile
    private var configRevision = 0L
    private val syncCoordinator = NitroBackgroundSyncCoordinator(
        store,
        httpSync,
        syncGate,
        lifecycleLock,
        storageLock,
        { runGeneration },
        { configRevision },
        { requireConfig().sync },
        { generation -> configForGeneration(generation)?.sync },
        ::isActiveLocationRegistration
    )
    private val errorState = NitroBackgroundErrorState(prefs)
    private val eventDispatcher = NitroBackgroundEventDispatcher(
        appContext,
        eventHub,
        { runGeneration },
        registrations::currentServiceGeneration
    )
    private val registrationDispatcher = NitroBackgroundRegistrationDispatcher(
        registrations,
        eventDispatcher,
        ::activeServiceGeneration
    )

    fun checkBackgroundPermission(reactContext: ReactApplicationContext): BackgroundPermissionResult {
        return permissions.checkBackgroundPermission(reactContext.currentActivity)
    }

    fun checkBackgroundPermission(): BackgroundPermissionResult = permissions.checkBackgroundPermission()

    fun requestBackgroundPermission(reactContext: ReactApplicationContext): BackgroundPermissionResult = permissions.requestBackgroundPermission(reactContext)

    fun openAppLocationSettings() = permissions.openAppLocationSettings()

    fun configure(options: BackgroundLocationOptions) = serviceCommandLock.withLock {
        synchronized(lifecycleLock) {
            validateAndroidBackgroundOptions(options)
            configRevision += 1L
            config = options
            configStore.persist(options)
        }
    }

    fun getConfigOrNull(): BackgroundLocationOptions? = synchronized(lifecycleLock) {
        config ?: configStore.restore()?.also { config = it }
    }

    fun requireConfig(): BackgroundLocationOptions {
        return getConfigOrNull() ?: throw IllegalStateException(
            "Background location is not configured. Call configureBackgroundLocation() or startBackgroundLocation(options) first."
        )
    }

    internal fun activeServiceGeneration(): Long? = synchronized(lifecycleLock) {
        runningServiceGeneration()?.takeIf { getConfigOrNull() != null }
    }

    internal fun runningServiceGeneration(): Long? = registrations.currentServiceGeneration().takeIf { prefs.getBoolean("running", false) }

    fun start(options: BackgroundLocationOptions?) = serviceCommandLock.withLock {
        awaitServiceStart(requestServiceStart(options))
    }

    internal fun startFromBoot() = serviceCommandLock.withLock {
        requestServiceStart(null)
    }

    private fun requestServiceStart(options: BackgroundLocationOptions?): Long =
        synchronized(lifecycleLock) {
            options?.let(::configure)
            val current = requireConfig()
            validateAndroidBackgroundOptions(current)
            NitroGeoLog.d(
                "start(): provider=${current.android?.locationProvider} interval=${current.interval} state=$state"
            )
            if (permissions.foregroundPermission() != PermissionStatus.GRANTED) {
                throw SecurityException("Foreground location permission is required")
            }
            if (current.android?.foregroundService == null &&
                permissions.backgroundPermission() != BackgroundPermissionStatus.GRANTED) {
                throw SecurityException("Background location permission is required")
            }
            activeServiceGeneration()?.let { previousGeneration ->
                stopNativeLocationUpdates(previousGeneration)
                stopActivityRecognition(previousGeneration)
            }
            val nextServiceGeneration = registrations.nextServiceGeneration()
            state = BackgroundLocationState.STARTING
            prefs.edit().putBoolean("running", true).commit()
            serviceStartup.begin(
                nextServiceGeneration,
                requiresActivityRecognition(current)
            )
            try {
                ContextCompat.startForegroundService(
                    appContext,
                    backgroundServiceIntent(
                        appContext,
                        nextServiceGeneration,
                        current.android!!.foregroundService
                    )
                )
            } catch (error: Exception) {
                serviceStartup.discard(nextServiceGeneration)
                failStartup(
                    nextServiceGeneration,
                    ERROR_CODE_POSITION_UNAVAILABLE,
                    "Failed to launch foreground location service: ${error.message}",
                    error
                )
                throw error
            }
            // State stays STARTING until the service actually registers updates and the provider
            // confirms (see startNativeLocationUpdates) — only then do we report RUNNING.
            NitroGeoLog.d("start(): foreground service requested, state=STARTING")
            nextServiceGeneration
        }

    private fun awaitServiceStart(serviceGeneration: Long) {
        val failure = try {
            serviceStartup.await(serviceGeneration, SERVICE_START_TIMEOUT_MS)
        } catch (error: Exception) {
            failStartup(
                serviceGeneration,
                ERROR_CODE_POSITION_UNAVAILABLE,
                "Foreground location service did not start: ${error.message}",
                error
            )
            throw error
        }
        if (failure != null) {
            failStartup(
                serviceGeneration,
                ERROR_CODE_POSITION_UNAVAILABLE,
                "Foreground location service failed to start: ${failure.message}",
                failure
            )
            throw IllegalStateException("Foreground location service failed to start", failure)
        }
    }

    fun stop(expectedGeneration: Long? = null) = serviceCommandLock.withLock {
        stopFromService(expectedGeneration)
    }

    internal fun stopFromService(expectedGeneration: Long? = null) {
        synchronized(lifecycleLock) {
            val activeGeneration = runningServiceGeneration()
            if (expectedGeneration != null && activeGeneration != expectedGeneration) return
            if (expectedGeneration != null && state == BackgroundLocationState.STARTING) {
                serviceStartup.stopped(expectedGeneration)
            }
            val serviceGeneration = expectedGeneration
                ?: registrations.currentServiceGeneration()
            NitroGeoLog.d("stop(): tearing down location updates")
            state = BackgroundLocationState.STOPPING
            prefs.edit().putBoolean("running", false).commit()
            stopNativeLocationUpdates(serviceGeneration)
            stopActivityRecognition(serviceGeneration)
            appContext.stopService(Intent(appContext, NitroBackgroundLocationService::class.java))
            state = BackgroundLocationState.STOPPED
        }
    }

    fun reset() = serviceCommandLock.withLock {
        stopFromService()
        stopActivityRecognition()
        activityCoordinator.awaitIdle()
        geofenceCoordinator.reset {
            synchronized(lifecycleLock) {
                val nextGeneration = runGeneration + 1L
                val editor = prefs.edit().clear().putLong(PREF_RUN_GENERATION, nextGeneration)
                registrations.invalidateForReset(editor)
                synchronized(storageLock) {
                    runGeneration = nextGeneration
                    config = null
                    errorState.clear()
                    editor.commit()
                    store.clearEvents(null)
                    store.clearLocations(null)
                    store.removeGeofences(null)
                }
            }
        }
        eventDispatcher.awaitIdle()
    }

    internal fun serviceForegroundDidPromote(serviceGeneration: Long) = serviceStartup.foregroundPromoted(serviceGeneration)

    internal fun prepareRecoveredService(serviceGeneration: Long, activityRequired: Boolean) =
        synchronized(lifecycleLock) {
            if (activeServiceGeneration() != serviceGeneration) return@synchronized
            serviceStartup.beginIfAbsent(serviceGeneration, activityRequired)
            state = BackgroundLocationState.STARTING
        }

    internal fun serviceProviderDidRegister(serviceGeneration: Long) =
        serviceStartup.providerRegistered(serviceGeneration).also { ready ->
            if (ready) markServiceRunning(serviceGeneration)
        }

    internal fun serviceActivityDidRegister(serviceGeneration: Long) =
        serviceStartup.activityProviderRegistered(serviceGeneration).also { ready ->
            if (ready) markServiceRunning(serviceGeneration)
        }

    fun getStatus(): BackgroundLocationStatus = readBackgroundLocationStatus(
            appContext,
            prefs,
            store,
            permissions,
            state,
            config != null,
            errorState.current()
        )

    internal fun recordError(
        code: LocationErrorCode,
        message: String,
        throwable: Throwable? = null,
        expectedServiceGeneration: Long? = null
    ) {
        val dispatch = synchronized(lifecycleLock) {
            if (expectedServiceGeneration != null &&
                activeServiceGeneration() != expectedServiceGeneration) return
            runGeneration to errorState.store(code, message)
        }
        NitroGeoLog.e("background location error [${locationErrorCodeToWireValue(code)}]: $message", throwable)
        runCatching {
            dispatchEvent(
                dispatch.second,
                dispatch.first,
                expectedServiceGeneration
            )
        }
    }

    internal fun failStartup(
        serviceGeneration: Long,
        code: LocationErrorCode,
        message: String,
        throwable: Throwable? = null
    ) {
        serviceStartup.fail(
            serviceGeneration,
            throwable ?: IllegalStateException(message)
        )
        val dispatch = synchronized(lifecycleLock) {
            if (!shouldApplyStartupFailure(runningServiceGeneration(), serviceGeneration)) {
                return
            }
            val errorDispatch = runGeneration to errorState.store(code, message)
            prefs.edit().putBoolean("running", false).commit()
            stopNativeLocationUpdates(serviceGeneration)
            stopActivityRecognition(serviceGeneration)
            appContext.stopService(Intent(appContext, NitroBackgroundLocationService::class.java))
            state = BackgroundLocationState.ERROR
            errorDispatch
        }
        NitroGeoLog.e("background location error [${locationErrorCodeToWireValue(code)}]: $message", throwable)
        runCatching { dispatchEvent(dispatch.second, dispatch.first, serviceGeneration) }
    }

    internal fun recordError(
        message: String,
        throwable: Throwable,
        expectedServiceGeneration: Long? = null
    ) = recordError(
        ERROR_CODE_POSITION_UNAVAILABLE,
        message,
        throwable,
        expectedServiceGeneration
    )

    @SuppressLint("MissingPermission")
    fun startNativeLocationUpdates(expectedGeneration: Long? = null) {
        synchronized(lifecycleLock) {
            val serviceGeneration = expectedGeneration ?: activeServiceGeneration() ?: return
            if (activeServiceGeneration() != serviceGeneration) return
            val current = requireConfig()
            val callbackGeneration = runGeneration
            val (previous, registration) = registrations.replaceLocation(serviceGeneration)
            previous?.let {
                removeLocationUpdates(pendingIntents.location(callbackGeneration, it.generation))
            }
            if (current.android?.locationProvider == AndroidBackgroundProvider.ANDROID_PLATFORM) {
                NitroGeoLog.d("startNativeLocationUpdates(): ANDROID_PLATFORM LocationManager path")
                startPlatformLocationUpdates(current, callbackGeneration, registration)
                return
            }
            NitroGeoLog.d("startNativeLocationUpdates(): FUSED provider, registering broadcast PendingIntent")
            val request = LocationRequest.Builder(
                resolvePriority(current),
                current.interval?.toLong() ?: 10_000L
            )
                .setMinUpdateIntervalMillis(current.fastestInterval?.toLong() ?: 5_000L)
                .setMinUpdateDistanceMeters((current.distanceFilter ?: 0.0).toFloat())
                .setWaitForAccurateLocation(current.waitForAccurateLocation == true)
                .setMaxUpdateDelayMillis(current.maxUpdateDelay?.toLong() ?: 0L)
                .build()
            val callback = pendingIntents.location(callbackGeneration, registration.generation)

            removeLegacyLocationUpdates()
            try {
                fusedLocationClient.requestLocationUpdates(request, callback)
                    .addOnSuccessListener {
                        synchronized(lifecycleLock) {
                            if (!isActiveLocationRegistration(
                                    callbackGeneration,
                                    registration
                                )) {
                                removeLocationUpdates(callback)
                                return@synchronized
                            }
                            NitroGeoLog.d("startNativeLocationUpdates(): fused registration accepted")
                            serviceProviderDidRegister(serviceGeneration)
                        }
                    }
                    .addOnFailureListener { error ->
                        if (!isActiveLocationRegistration(
                                callbackGeneration,
                                registration
                            )) return@addOnFailureListener
                        failStartup(
                            serviceGeneration,
                            ERROR_CODE_POSITION_UNAVAILABLE,
                            "Failed to register fused location updates: ${error.message}",
                            error
                        )
                    }
            } catch (error: SecurityException) {
                if (isActiveLocationRegistration(callbackGeneration, registration)) {
                    failStartup(
                        serviceGeneration,
                        ERROR_CODE_PERMISSION_DENIED,
                        "Missing location permission for fused updates: ${error.message}",
                        error
                    )
                }
            }
        }
    }

    fun stopNativeLocationUpdates(expectedGeneration: Long? = null) {
        synchronized(lifecycleLock) {
            registrations.removeLocation(expectedGeneration)?.let { registration ->
                removeLocationUpdates(
                    pendingIntents.location(runGeneration, registration.generation)
                )
            }
            removeLegacyLocationUpdates()
        }
    }

    fun handleNativeLocation(
        location: Location,
        source: BackgroundLocationSource,
        callbackGeneration: Long,
        registrationGeneration: Long
    ) {
        if (!isActiveLocationRegistration(callbackGeneration, registrationGeneration)) return
        val serviceGeneration = activeServiceGeneration() ?: return
        NitroGeoLog.d("handleNativeLocation(): src=$source lat=${location.latitude} lng=${location.longitude}")
        val id = UUID.randomUUID().toString()
        val backgroundLocation = BackgroundLocation(
            id,
            source,
            true,
            backgroundProviderFrom(location.provider),
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) location.isMock else location.isFromMockProvider,
            System.currentTimeMillis().toDouble(),
            null,
            null,
            GeolocationCoordinates(
                location.latitude,
                location.longitude,
                location.takeIf { it.hasAltitude() }?.altitude?.let { NullableDouble.create(it) },
                location.accuracy.toDouble(),
                null,
                location.takeIf { it.hasBearing() }?.bearing?.toDouble()?.let { NullableDouble.create(it) },
                location.takeIf { it.hasSpeed() }?.speed?.toDouble()?.let { NullableDouble.create(it) }
            ),
            location.time.toDouble()
        )
        val event = BackgroundEventEnvelope(
            backgroundLocation,
            null,
            null,
            null,
            null,
            null,
            null,
            UUID.randomUUID().toString(),
            BackgroundEventType.LOCATION,
            System.currentTimeMillis().toDouble(),
            false
        )
        val current = configForGeneration(callbackGeneration)
        if (!registrationDispatcher.dispatchLocation(
                event,
                callbackGeneration,
                registrationGeneration
            ) {
                synchronized(storageLock) {
                    if (!shouldPersist(current, callbackGeneration)) return@synchronized
                store.insertLocation(backgroundLocation)
                store.pruneLocations(maxStoredLocations(current))
                store.insertEvent(event)
                store.pruneEvents(maxStoredEvents(current))
                }
            }
        ) return
        scheduleSyncIfNeeded(
            callbackGeneration,
            registrationGeneration,
            serviceGeneration
        )
    }

    fun handleGeofenceEvent(geofencingEvent: GeofencingEvent, callbackGeneration: Long) {
        if (!isCurrentGeneration(callbackGeneration)) return
        val transition = when (geofencingEvent.geofenceTransition) {
            Geofence.GEOFENCE_TRANSITION_ENTER -> GeofenceTransition.ENTER
            Geofence.GEOFENCE_TRANSITION_EXIT -> GeofenceTransition.EXIT
            Geofence.GEOFENCE_TRANSITION_DWELL -> GeofenceTransition.DWELL
            else -> return
        }
        val regions = store.getGeofences().associateBy { it.identifier }
        for (trigger in geofencingEvent.triggeringGeofences ?: emptyList()) {
            val region = regions[trigger.requestId] ?: continue
            val now = System.currentTimeMillis().toDouble()
            val event = BackgroundEventEnvelope(
                null,
                GeofenceEvent(region, transition, null, now),
                null,
                null,
                null,
                null,
                null,
                UUID.randomUUID().toString(),
                BackgroundEventType.GEOFENCE,
                now,
                false
            )
            persistEventIfNeeded(event, callbackGeneration, allowUnconfigured = true)
            if (!isCurrentGeneration(callbackGeneration)) return
            dispatchEvent(event, callbackGeneration)
        }
    }

    @SuppressLint("MissingPermission")
    fun startActivityRecognition(
        options: ActivityRecognitionOptions?,
        expectedGeneration: Long? = null
    ) {
        if (expectedGeneration == null) {
            serviceCommandLock.withLock {
                val future = prepareActivityRecognition(options, null) ?: return@withLock
                try {
                    awaitActivityCommand(future)
                } catch (error: Exception) {
                    recordError(
                        "Failed to register activity recognition: ${error.message}",
                        error
                    )
                    throw error
                }
            }
            return
        }

        val future = prepareActivityRecognition(options, expectedGeneration) ?: return
        future.whenComplete { _, error ->
            if (error == null && activeServiceGeneration() == expectedGeneration) {
                serviceActivityDidRegister(expectedGeneration)
            } else if (error == null) {
                activityCoordinator.stop(expectedGeneration)
            } else {
                val cause = unwrapActivityCommandError(error)
                failStartup(
                    expectedGeneration,
                    ERROR_CODE_POSITION_UNAVAILABLE,
                    "Failed to register activity recognition: ${cause.message}",
                    cause
                )
            }
        }
    }

    fun stopActivityRecognition(expectedGeneration: Long? = null) {
        if (expectedGeneration == null) {
            serviceCommandLock.withLock {
                awaitActivityCommand(activityCoordinator.stop(null))
            }
        } else {
            activityCoordinator.stop(expectedGeneration)
        }
    }

    fun handleActivityRecognition(
        intent: Intent,
        callbackGeneration: Long,
        registrationGeneration: Long
    ) {
        if (!isActiveActivityRegistration(callbackGeneration, registrationGeneration)) return
        val result = ActivityRecognitionResult.extractResult(intent) ?: return
        val activity = result.mostProbableActivity ?: return
        val detected = DetectedActivity(
            activity.toNitroActivityType(),
            activity.confidence.toDouble(),
            System.currentTimeMillis().toDouble()
        )
        val event = BackgroundEventEnvelope(
            null,
            null,
            detected,
            null,
            null,
            null,
            null,
            UUID.randomUUID().toString(),
            BackgroundEventType.ACTIVITY,
            detected.timestamp,
            false
        )
        val current = configForGeneration(callbackGeneration)
        if (!registrationDispatcher.dispatchActivity(
                event,
                callbackGeneration,
                registrationGeneration
            ) {
                synchronized(storageLock) {
                    if (!shouldPersist(current, callbackGeneration, allowUnconfigured = true)) {
                        return@synchronized
                    }
                    store.insertEvent(event)
                    store.pruneEvents(maxStoredEvents(current))
                }
            }
        ) return
        synchronized(lifecycleLock) {
            if (isActiveActivityRegistration(callbackGeneration, registrationGeneration)) {
                applyActivityAwareTracking(detected)
            }
        }
    }

    fun addGeofences(regions: Array<GeofenceRegion>, options: GeofencingOptions?) =
        geofenceCoordinator.add(regions, options)

    fun removeGeofences(identifiers: Array<String>?) = geofenceCoordinator.remove(identifiers)

    fun registerPersistedGeofencesIfNeeded(expectedGeneration: Long? = null) =
        geofenceCoordinator.restore(expectedGeneration)

    internal fun registerPersistedGeofencesBlockingIfNeeded() =
        geofenceCoordinator.restoreBlocking()

    fun syncStoredLocations(): BackgroundHttpSyncResult {
        val callbackGeneration = runGeneration
        return syncCoordinator.syncManual(callbackGeneration)
    }

    private fun scheduleSyncIfNeeded(
        callbackGeneration: Long,
        registrationGeneration: Long,
        serviceGeneration: Long
    ) {
        if (!isActiveLocationRegistration(callbackGeneration, registrationGeneration)) return
        val sync = configForGeneration(callbackGeneration)?.sync ?: return
        val threshold = sync.syncThreshold?.toInt()?.takeIf { it > 0 } ?: 1
        val unsynced = store.getLocations(
            GetStoredBackgroundLocationsOptions(
                threshold.toDouble(),
                null,
                true,
                false
            )
        )
        if (unsynced.size < threshold) return

        syncCoordinator.scheduleAutomatic(
            callbackGeneration,
            registrationGeneration,
            serviceGeneration,
            onResult = { result ->
                val event = BackgroundEventEnvelope(
                    null,
                    null,
                    null,
                    null,
                    null,
                    result,
                    null,
                    UUID.randomUUID().toString(),
                    BackgroundEventType.HTTPSYNC,
                    System.currentTimeMillis().toDouble(),
                    false
                )
                val current = configForGeneration(callbackGeneration)
                registrationDispatcher.dispatchLocation(
                    event,
                    callbackGeneration,
                    registrationGeneration
                ) {
                    synchronized(storageLock) {
                        if (!shouldPersist(current, callbackGeneration)) return@synchronized
                        store.insertEvent(event)
                        store.pruneEvents(maxStoredEvents(current))
                    }
                }
            },
            onFailure = { error ->
                recordError(
                    "Automatic background HTTP sync failed: ${error.message}",
                    error,
                    serviceGeneration
                )
            }
        )
    }

    private fun isCurrentGeneration(callbackGeneration: Long): Boolean =
        runGeneration == callbackGeneration

    private fun isActiveLocationRegistration(
        callbackGeneration: Long,
        registration: BackgroundRegistration
    ): Boolean = isActiveLocationRegistration(callbackGeneration, registration.generation)

    private fun isActiveLocationRegistration(
        callbackGeneration: Long,
        registrationGeneration: Long
    ): Boolean = synchronized(lifecycleLock) {
        val serviceGeneration = activeServiceGeneration() ?: return@synchronized false
        isCurrentGeneration(callbackGeneration) &&
            registrations.isCurrentLocation(registrationGeneration, serviceGeneration)
    }

    private fun isActiveActivityRegistration(
        callbackGeneration: Long,
        registrationGeneration: Long
    ): Boolean = synchronized(lifecycleLock) {
        if (!isCurrentGeneration(callbackGeneration)) return@synchronized false
        registrations.isCurrentActivity(
            registrationGeneration,
            activeServiceGeneration()
        )
    }

    private fun configForGeneration(callbackGeneration: Long): BackgroundLocationOptions? {
        if (!isCurrentGeneration(callbackGeneration)) return null
        return getConfigOrNull()
    }

    private fun shouldPersist(
        current: BackgroundLocationOptions?,
        callbackGeneration: Long,
        allowUnconfigured: Boolean = false
    ): Boolean {
        return shouldPersistForGeneration(
            current != null,
            current?.persist,
            runGeneration,
            callbackGeneration,
            allowUnconfigured
        )
    }

    private fun persistEventIfNeeded(
        event: BackgroundEventEnvelope,
        callbackGeneration: Long,
        allowUnconfigured: Boolean = false
    ) {
        val current = configForGeneration(callbackGeneration)
        synchronized(storageLock) {
            if (!shouldPersist(current, callbackGeneration, allowUnconfigured)) return
            store.insertEvent(event)
            store.pruneEvents(maxStoredEvents(current))
        }
    }

    @SuppressLint("MissingPermission")
    private fun startPlatformLocationUpdates(
        options: BackgroundLocationOptions,
        callbackGeneration: Long,
        registration: BackgroundRegistration
    ) {
        val interval = options.interval?.toLong() ?: 10_000L
        val distance = (options.distanceFilter ?: 0.0).toFloat()
        val callback = pendingIntents.location(callbackGeneration, registration.generation)
        removeLegacyLocationUpdates()
        val providers = listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)
            .filter { provider -> runCatching { platformLocationManager.isProviderEnabled(provider) }.getOrDefault(false) }
            .ifEmpty { listOf(LocationManager.GPS_PROVIDER) }
        var registered = false
        providers.forEach { provider ->
            try {
                platformLocationManager.requestLocationUpdates(
                    provider,
                    interval,
                    distance,
                    callback
                )
                registered = true
            } catch (error: SecurityException) {
                recordError(
                    ERROR_CODE_PERMISSION_DENIED,
                    "Missing location permission for $provider updates: ${error.message}",
                    error,
                    registration.ownerServiceGeneration
                )
            }
        }
        if (registered) {
            registration.ownerServiceGeneration?.let(::serviceProviderDidRegister)
        } else {
            failStartup(
                registration.ownerServiceGeneration
                    ?: registrations.currentServiceGeneration(),
                ERROR_CODE_POSITION_UNAVAILABLE,
                "No Android location provider accepted background updates"
            )
        }
    }

    private fun applyActivityAwareTracking(activity: DetectedActivity) {
        val current = getConfigOrNull() ?: return
        when (activityTrackingAction(current, activity, prefs.getBoolean("running", false))) {
            ActivityTrackingAction.STOP -> stopNativeLocationUpdates()
            ActivityTrackingAction.START -> runCatching { startNativeLocationUpdates() }
            ActivityTrackingAction.NONE -> Unit
        }
    }

    private fun markServiceRunning(serviceGeneration: Long) = synchronized(lifecycleLock) {
        if (activeServiceGeneration() == serviceGeneration &&
            state == BackgroundLocationState.STARTING) {
            state = BackgroundLocationState.RUNNING
            errorState.clear()
        }
    }

    @SuppressLint("MissingPermission")
    private fun prepareActivityRecognition(
        options: ActivityRecognitionOptions?,
        expectedGeneration: Long?
    ): CompletableFuture<Void>? = synchronized(lifecycleLock) {
        if (expectedGeneration != null && activeServiceGeneration() != expectedGeneration) {
            return@synchronized null
        }
        requireActivityRecognitionPermission(appContext)
        activityCoordinator.start(
            (options?.interval ?: 10_000.0).toLong(),
            expectedGeneration
        )
    }

    private fun dispatchEvent(
        event: BackgroundEventEnvelope,
        callbackGeneration: Long,
        callbackServiceGeneration: Long? = null
    ) = eventDispatcher.dispatch(event, callbackGeneration, callbackServiceGeneration)

    private fun removeLocationUpdates(callback: PendingIntent) {
        runCatching { platformLocationManager.removeUpdates(callback) }
        fusedLocationClient.removeLocationUpdates(callback)
            .addOnCompleteListener { callback.cancel() }
    }

    private fun removeLegacyLocationUpdates() =
        pendingIntents.legacyLocation()?.let(::removeLocationUpdates)

    companion object {
        private const val SERVICE_START_TIMEOUT_MS = 10_000L

        @Volatile
        private var instance: NitroBackgroundLocationController? = null

        fun getInstance(context: Context): NitroBackgroundLocationController {
            return instance ?: synchronized(this) {
                instance ?: NitroBackgroundLocationController(context.applicationContext).also {
                    instance = it
                }
            }
        }
    }
}
