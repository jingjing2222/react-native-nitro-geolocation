package com.margelo.nitro.nitrogeolocation.background

import android.Manifest
import android.annotation.SuppressLint
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import android.os.Build
import androidx.core.content.ContextCompat
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.ReactApplicationContext
import com.google.android.gms.location.Geofence
import com.google.android.gms.location.ActivityRecognition
import com.google.android.gms.location.ActivityRecognitionResult
import com.google.android.gms.location.GeofencingEvent
import com.google.android.gms.location.GeofencingRequest
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.Task
import com.margelo.nitro.nitrogeolocation.*
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.UUID

private const val ACTION_LOCATION_UPDATE =
    "com.margelo.nitro.nitrogeolocation.background.LOCATION_UPDATE"
private const val ACTION_GEOFENCE_UPDATE =
    "com.margelo.nitro.nitrogeolocation.background.GEOFENCE_UPDATE"
private const val ACTION_ACTIVITY_UPDATE =
    "com.margelo.nitro.nitrogeolocation.background.ACTIVITY_UPDATE"

// LocationError codes mirror the W3C GeolocationPositionError contract.
private const val ERROR_CODE_PERMISSION_DENIED = 1
private const val ERROR_CODE_POSITION_UNAVAILABLE = 2

// Default store caps so an unconfigured store cannot grow without bound over a long trip.
private const val DEFAULT_MAX_STORED_LOCATIONS = 10_000
private const val DEFAULT_MAX_STORED_EVENTS = 10_000

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
        appContext.getSharedPreferences("nitro_background_location", Context.MODE_PRIVATE)
    private val permissions = AndroidBackgroundPermissions(appContext) { getConfigOrNull() }
    private val httpSync = AndroidBackgroundHttpSync()
    private val taskExecutor = Executors.newSingleThreadExecutor()

    // Serializes HTTP-sync uploads: a burst of locations queues onto one worker instead of
    // spawning an unbounded number of raw threads.
    private val syncExecutor = Executors.newSingleThreadExecutor()

    @Volatile
    private var config: BackgroundLocationOptions? = null

    @Volatile
    private var state = BackgroundLocationState.IDLE

    @Volatile
    private var lastError: LocationError? = null

    // Serializes lifecycle transitions (configure/start/stop/reset), which are invoked from
    // Nitro Promise.async worker threads and must not interleave on the shared singleton.
    private val lifecycleLock = Any()

    fun checkBackgroundPermission(): BackgroundPermissionResult {
        return permissions.checkBackgroundPermission()
    }

    fun requestBackgroundPermission(reactContext: ReactApplicationContext): BackgroundPermissionResult {
        return permissions.requestBackgroundPermission(reactContext)
    }

    fun openAppLocationSettings() {
        permissions.openAppLocationSettings()
    }

    fun configure(options: BackgroundLocationOptions) {
        synchronized(lifecycleLock) {
            validate(options)
            config = options
            persistConfig(options)
        }
    }

    fun getConfigOrNull(): BackgroundLocationOptions? {
        return config ?: restoreConfig()?.also { config = it }
    }

    fun requireConfig(): BackgroundLocationOptions {
        return getConfigOrNull() ?: throw IllegalStateException(
            "Background location is not configured. Call configureBackgroundLocation() or startBackgroundLocation(options) first."
        )
    }

    fun start(options: BackgroundLocationOptions?) {
        synchronized(lifecycleLock) {
            options?.let(::configure)
            val current = requireConfig()
            validate(current)
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
            state = BackgroundLocationState.STARTING
            prefs.edit().putBoolean("running", true).apply()
            ContextCompat.startForegroundService(
                appContext,
                Intent(appContext, NitroBackgroundLocationService::class.java)
            )
            // State stays STARTING until the service actually registers updates and the provider
            // confirms (see startNativeLocationUpdates) — only then do we report RUNNING.
            NitroGeoLog.d("start(): foreground service requested, state=STARTING")
        }
    }

    fun stop() {
        synchronized(lifecycleLock) {
            NitroGeoLog.d("stop(): tearing down location updates")
            state = BackgroundLocationState.STOPPING
            stopNativeLocationUpdates()
            stopActivityRecognition()
            appContext.stopService(Intent(appContext, NitroBackgroundLocationService::class.java))
            prefs.edit().putBoolean("running", false).apply()
            state = BackgroundLocationState.STOPPED
        }
    }

    fun reset() {
        synchronized(lifecycleLock) {
            stop()
            removeGeofences(null)
            config = null
            prefs.edit().clear().apply()
            store.clearEvents(null)
            store.clearLocations(null)
        }
    }

    fun getStatus(): BackgroundLocationStatus {
        val providerEnabled = runCatching {
            val manager = appContext.getSystemService(Context.LOCATION_SERVICE) as LocationManager
            manager.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
                manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
        }.getOrDefault(false)

        return BackgroundLocationStatus(
            state,
            prefs.getBoolean("running", false),
            config != null || prefs.getBoolean("configured", false),
            permissions.foregroundPermission(),
            permissions.backgroundPermission(),
            permissions.accuracyAuthorization(),
            providerEnabled,
            null,
            store.count("background_locations"),
            store.count("background_events"),
            store.count("geofences"),
            AndroidBackgroundLocationStatus(
                prefs.getBoolean("running", false),
                null,
                permissions.notificationPermission()
            ),
            null,
            currentLastError()
        )
    }

    internal fun recordError(code: Int, message: String, throwable: Throwable? = null) {
        val error = LocationError(code.toDouble(), message)
        lastError = error
        prefs.edit()
            .putInt("lastErrorCode", code)
            .putString("lastErrorMessage", message)
            .putLong("lastErrorAt", System.currentTimeMillis())
            .apply()
        NitroGeoLog.e("background location error [$code]: $message", throwable)
        runCatching {
            dispatchEvent(
                BackgroundEventEnvelope(
                    null,
                    null,
                    null,
                    null,
                    null,
                    error,
                    UUID.randomUUID().toString(),
                    BackgroundEventType.ERROR,
                    System.currentTimeMillis().toDouble(),
                    false
                )
            )
        }
    }

    internal fun recordError(message: String, throwable: Throwable) =
        recordError(ERROR_CODE_POSITION_UNAVAILABLE, message, throwable)

    private fun clearError() {
        lastError = null
        prefs.edit()
            .remove("lastErrorCode")
            .remove("lastErrorMessage")
            .remove("lastErrorAt")
            .apply()
    }

    private fun currentLastError(): LocationError? {
        lastError?.let { return it }
        val message = prefs.getString("lastErrorMessage", null) ?: return null
        return LocationError(prefs.getInt("lastErrorCode", 0).toDouble(), message)
            .also { lastError = it }
    }

    @SuppressLint("MissingPermission")
    fun startNativeLocationUpdates() {
        val current = requireConfig()
        if (current.android?.locationProvider == AndroidBackgroundProvider.ANDROID_PLATFORM) {
            NitroGeoLog.d("startNativeLocationUpdates(): ANDROID_PLATFORM LocationManager path")
            startPlatformLocationUpdates(current)
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

        try {
            fusedLocationClient.requestLocationUpdates(request, locationPendingIntent())
                .addOnSuccessListener {
                    NitroGeoLog.d("startNativeLocationUpdates(): fused registration accepted")
                    state = BackgroundLocationState.RUNNING
                    clearError()
                }
                .addOnFailureListener { error ->
                    recordError(
                        ERROR_CODE_POSITION_UNAVAILABLE,
                        "Failed to register fused location updates: ${error.message}",
                        error
                    )
                }
        } catch (error: SecurityException) {
            recordError(
                ERROR_CODE_PERMISSION_DENIED,
                "Missing location permission for fused updates: ${error.message}",
                error
            )
        }
    }

    fun stopNativeLocationUpdates() {
        fusedLocationClient.removeLocationUpdates(locationPendingIntent())
        runCatching { platformLocationManager.removeUpdates(locationPendingIntent()) }
    }

    fun handleNativeLocation(location: Location, source: BackgroundLocationSource) {
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
            UUID.randomUUID().toString(),
            BackgroundEventType.LOCATION,
            System.currentTimeMillis().toDouble(),
            false
        )
        if (shouldPersist()) {
            store.insertLocation(backgroundLocation)
            store.pruneLocations(currentMaxStoredLocations())
            store.insertEvent(event)
            store.pruneEvents(currentMaxStoredEvents())
        }
        dispatchEvent(event)
        scheduleSyncIfNeeded()
    }

    fun handleGeofenceEvent(geofencingEvent: GeofencingEvent) {
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
                UUID.randomUUID().toString(),
                BackgroundEventType.GEOFENCE,
                now,
                false
            )
            persistEventIfNeeded(event)
            dispatchEvent(event)
        }
    }

    @SuppressLint("MissingPermission")
    fun startActivityRecognition(options: ActivityRecognitionOptions?) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
            ContextCompat.checkSelfPermission(
                appContext,
                Manifest.permission.ACTIVITY_RECOGNITION
            ) != PackageManager.PERMISSION_GRANTED) {
            throw SecurityException("Activity recognition permission is required")
        }
        activityRecognitionClient.requestActivityUpdates(
            (options?.interval ?: 10_000.0).toLong(),
            activityPendingIntent()
        )
    }

    fun stopActivityRecognition() {
        activityRecognitionClient.removeActivityUpdates(activityPendingIntent())
    }

    fun handleActivityRecognition(intent: Intent) {
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
            UUID.randomUUID().toString(),
            BackgroundEventType.ACTIVITY,
            detected.timestamp,
            false
        )
        persistEventIfNeeded(event)
        dispatchEvent(event)
        applyActivityAwareTracking(detected)
    }

    fun addGeofences(regions: Array<GeofenceRegion>, options: GeofencingOptions?) {
        if (permissions.backgroundPermission() != BackgroundPermissionStatus.GRANTED) {
            throw SecurityException("Background location permission is required to register geofences")
        }
        val geofences = regions.map { region ->
            Geofence.Builder()
                .setRequestId(region.identifier)
                .setCircularRegion(region.latitude, region.longitude, region.radius.toFloat())
                .setTransitionTypes(region.toTransitionTypes())
                .setLoiteringDelay(region.loiteringDelay?.toInt() ?: 0)
                .setExpirationDuration(region.expirationDuration?.toLong() ?: Geofence.NEVER_EXPIRE)
                .apply {
                    options?.notificationResponsiveness?.toInt()?.takeIf { it >= 0 }?.let {
                        setNotificationResponsiveness(it)
                    }
                }
                .build()
        }
        if (geofences.isEmpty()) return

        waitForTask(geofencingClient.addGeofences(
            GeofencingRequest.Builder()
                .setInitialTrigger(options.toInitialTrigger())
                .addGeofences(geofences)
                .build(),
            geofencePendingIntent()
        ))
        store.saveGeofences(regions)
    }

    fun removeGeofences(identifiers: Array<String>?) {
        waitForTask(if (identifiers == null) {
            geofencingClient.removeGeofences(geofencePendingIntent())
        } else {
            geofencingClient.removeGeofences(identifiers.toList())
        })
        store.removeGeofences(identifiers)
    }

    fun registerPersistedGeofencesIfNeeded() {
        val geofences = store.getGeofences()
        if (geofences.isNotEmpty()) {
            addGeofences(geofences, null)
        }
    }

    fun syncStoredLocations(): BackgroundHttpSyncResult {
        val sync = requireConfig().sync
        val locations = store.getLocations(
            GetStoredBackgroundLocationsOptions(
                sync?.batchSize ?: 50.0,
                null,
                true,
                false
            )
        )
        val ids = locations.map { it.id }
        if (ids.isEmpty()) {
            return BackgroundHttpSyncResult(true, null, emptyArray(), emptyArray(), null)
        }
        if (sync == null) {
            return BackgroundHttpSyncResult(true, null, emptyArray(), emptyArray(), null)
        }
        val result = httpSync.uploadLocationsWithRetry(sync, locations)
        store.markSynced(result.syncedLocationIds.toList())
        if (sync.autoClear == true) {
            store.clearLocations(result.syncedLocationIds)
        }
        return result
    }

    private fun scheduleSyncIfNeeded() {
        val sync = getConfigOrNull()?.sync ?: return
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

        val now = System.currentTimeMillis()
        val interval = sync.syncInterval?.toLong()?.takeIf { it > 0 } ?: 0L
        val lastSyncAt = prefs.getLong("lastSyncAt", 0L)
        if (interval > 0 && now - lastSyncAt < interval) return
        prefs.edit().putLong("lastSyncAt", now).apply()

        syncExecutor.execute {
            val result = runCatching { syncStoredLocations() }.getOrElse { error ->
                BackgroundHttpSyncResult(
                    false,
                    null,
                    emptyArray(),
                    unsynced.map { it.id }.toTypedArray(),
                    error.message ?: "HTTP sync failed"
                )
            }
            val event = BackgroundEventEnvelope(
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
            persistEventIfNeeded(event)
            dispatchEvent(event)
        }
    }

    private fun shouldPersist(): Boolean {
        return getConfigOrNull()?.persist != false
    }

    private fun persistEventIfNeeded(event: BackgroundEventEnvelope) {
        if (!shouldPersist()) return
        store.insertEvent(event)
        store.pruneEvents(currentMaxStoredEvents())
    }

    private fun currentMaxStoredLocations(): Int {
        return getConfigOrNull()?.maxStoredLocations?.toInt()?.takeIf { it > 0 }
            ?: DEFAULT_MAX_STORED_LOCATIONS
    }

    private fun currentMaxStoredEvents(): Int {
        return getConfigOrNull()?.maxStoredEvents?.toInt()?.takeIf { it > 0 }
            ?: DEFAULT_MAX_STORED_EVENTS
    }

    @SuppressLint("MissingPermission")
    private fun startPlatformLocationUpdates(options: BackgroundLocationOptions) {
        val interval = options.interval?.toLong() ?: 10_000L
        val distance = (options.distanceFilter ?: 0.0).toFloat()
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
                    locationPendingIntent()
                )
                registered = true
            } catch (error: SecurityException) {
                recordError(
                    ERROR_CODE_PERMISSION_DENIED,
                    "Missing location permission for $provider updates: ${error.message}",
                    error
                )
            }
        }
        if (registered) {
            state = BackgroundLocationState.RUNNING
        }
    }

    private fun applyActivityAwareTracking(activity: DetectedActivity) {
        val current = getConfigOrNull() ?: return
        val options = current.activityRecognition
        if (current.trackingMode != BackgroundTrackingMode.ACTIVITYAWARE &&
            options?.stopOnStill != true) {
            return
        }
        val stopOnStill = options?.stopOnStill ?: (current.trackingMode == BackgroundTrackingMode.ACTIVITYAWARE)
        val minimumConfidence = options?.minimumConfidence ?: 0.0
        if (activity.confidence < minimumConfidence) return
        if (activity.type == DetectedActivityType.STILL && stopOnStill) {
            stopNativeLocationUpdates()
            return
        }
        if (activity.type != DetectedActivityType.STILL &&
            activity.type != DetectedActivityType.UNKNOWN &&
            prefs.getBoolean("running", false)) {
            runCatching { startNativeLocationUpdates() }
        }
    }

    private fun validate(options: BackgroundLocationOptions) {
        if (options.android?.foregroundService == null) {
            throw IllegalArgumentException(
                "Android background tracking requires android.foregroundService notification options"
            )
        }
    }

    private fun dispatchEvent(event: BackgroundEventEnvelope) {
        eventHub.emit(event)
        val intent = Intent(appContext, NitroBackgroundHeadlessTaskService::class.java)
            .putExtra("event", event.toJson().toString())
        appContext.startService(intent)
        HeadlessJsTaskService.acquireWakeLockNow(appContext)
    }

    private fun waitForTask(task: Task<Void>) {
        val latch = CountDownLatch(1)
        var failure: Exception? = null
        task.addOnCompleteListener(taskExecutor) {
            failure = it.exception
            latch.countDown()
        }
        latch.await(30, TimeUnit.SECONDS)
        failure?.let { throw it }
        if (!task.isSuccessful) {
            throw IllegalStateException("Google Play services task failed")
        }
    }

    private fun persistConfig(options: BackgroundLocationOptions) {
        val service = options.android?.foregroundService
        prefs.edit()
            .putBoolean("configured", true)
            .putBoolean("running", prefs.getBoolean("running", false))
            .putBoolean("startOnBoot", options.startOnBoot == true)
            .putBoolean("stopOnTerminate", options.stopOnTerminate != false)
            .putString("trackingMode", options.trackingMode?.name)
            .putString("accuracyAndroid", options.accuracy?.android?.name)
            .putString("accuracyIos", options.accuracy?.ios?.name)
            .putString("granularity", options.granularity?.name)
            .putString("androidLocationProvider", options.android?.locationProvider?.name)
            .putBoolean(
                "androidRequestNotificationPermission",
                options.android?.requestNotificationPermission != false
            )
            .putBoolean(
                "androidRequestIgnoreBatteryOptimizations",
                options.android?.requestIgnoreBatteryOptimizations == true
            )
            .putFloat("interval", (options.interval ?: 10_000.0).toFloat())
            .putFloat("fastestInterval", (options.fastestInterval ?: 5_000.0).toFloat())
            .putFloat("distanceFilter", (options.distanceFilter ?: 0.0).toFloat())
            .putFloat("maxUpdateDelay", (options.maxUpdateDelay ?: 0.0).toFloat())
            .putBoolean("waitForAccurateLocation", options.waitForAccurateLocation == true)
            .putBoolean("persist", options.persist != false)
            .putFloat("maxStoredLocations", (options.maxStoredLocations ?: 0.0).toFloat())
            .putFloat("maxStoredEvents", (options.maxStoredEvents ?: 0.0).toFloat())
            .putBoolean("activityConfigured", options.activityRecognition != null)
            .putBoolean("activityEnabled", options.activityRecognition?.enabled == true)
            .putFloat("activityInterval", (options.activityRecognition?.interval ?: 10_000.0).toFloat())
            .putBoolean("activityStopOnStill", options.activityRecognition?.stopOnStill == true)
            .putFloat(
                "activityMinimumConfidence",
                (options.activityRecognition?.minimumConfidence ?: 0.0).toFloat()
            )
            .putFloat("notificationId", (service?.notificationId ?: 9471.0).toFloat())
            .putString("notificationTitle", service?.notificationTitle)
            .putString("notificationText", service?.notificationText)
            .putString("notificationChannelId", service?.notificationChannelId)
            .putString("notificationChannelName", service?.notificationChannelName)
            .putString("notificationChannelDescription", service?.notificationChannelDescription)
            .putString("notificationIcon", service?.notificationIcon)
            .putString("notificationColor", service?.notificationColor)
            .putString("stopActionTitle", service?.stopActionTitle)
            .putString("syncUrl", options.sync?.url)
            .putString("syncMethod", options.sync?.method?.name)
            .putString("syncHeaders", options.sync?.headers?.let(::stringMapToJson))
            .putString("syncBodyTemplate", options.sync?.bodyTemplate?.let(::variantMapToJson))
            .putBoolean("syncBatchConfigured", options.sync?.batch != null)
            .putFloat("syncBatchSize", (options.sync?.batchSize ?: 50.0).toFloat())
            .putFloat("syncThreshold", (options.sync?.syncThreshold ?: 1.0).toFloat())
            .putFloat("syncInterval", (options.sync?.syncInterval ?: 0.0).toFloat())
            .putBoolean("syncBatch", options.sync?.batch == true)
            .putBoolean("syncRetry", options.sync?.retry == true)
            .putFloat("syncMaxRetries", (options.sync?.maxRetries ?: 3.0).toFloat())
            .putBoolean("syncAutoClear", options.sync?.autoClear == true)
            .apply()
    }

    private fun restoreConfig(): BackgroundLocationOptions? {
        if (!prefs.getBoolean("configured", false)) return null
        val title = prefs.getString("notificationTitle", null) ?: return null
        val text = prefs.getString("notificationText", null) ?: return null
        val service = AndroidForegroundServiceOptions(
            prefs.getFloat("notificationId", 9471f).toDouble(),
            title,
            text,
            prefs.getString("notificationChannelId", null),
            prefs.getString("notificationChannelName", null),
            prefs.getString("notificationChannelDescription", null),
            prefs.getString("notificationIcon", null),
            prefs.getString("notificationColor", null),
            prefs.getString("stopActionTitle", null)
        )
        val sync = prefs.getString("syncUrl", null)?.let { url ->
            BackgroundHttpSyncOptions(
                url,
                prefs.getString("syncMethod", null)?.let {
                    runCatching { enumValueOf<BackgroundHttpMethod>(it) }.getOrNull()
                },
                prefs.getString("syncHeaders", null)?.let(::jsonToStringMap),
                if (prefs.getBoolean("syncBatchConfigured", false)) {
                    prefs.getBoolean("syncBatch", false)
                } else {
                    null
                },
                prefs.getFloat("syncBatchSize", 50f).toDouble(),
                prefs.getFloat("syncThreshold", 1f).toDouble(),
                prefs.getFloat("syncInterval", 0f).toDouble(),
                prefs.getBoolean("syncRetry", false),
                prefs.getFloat("syncMaxRetries", 3f).toDouble(),
                prefs.getString("syncBodyTemplate", null)?.let(::jsonToVariantMap),
                prefs.getBoolean("syncAutoClear", false)
            )
        }
        val accuracyAndroid = prefs.getString("accuracyAndroid", null)?.let {
            runCatching { enumValueOf<AndroidAccuracyPreset>(it) }.getOrNull()
        }
        val accuracyIos = prefs.getString("accuracyIos", null)?.let {
            runCatching { enumValueOf<IOSAccuracyPreset>(it) }.getOrNull()
        }
        val accuracy = if (accuracyAndroid != null || accuracyIos != null) {
            LocationAccuracyOptions(accuracyAndroid, accuracyIos)
        } else {
            null
        }
        val activityRecognition = if (prefs.getBoolean("activityConfigured", false)) {
            ActivityRecognitionOptions(
                prefs.getBoolean("activityEnabled", false),
                prefs.getFloat("activityInterval", 10_000f).toDouble(),
                prefs.getBoolean("activityStopOnStill", false),
                prefs.getFloat("activityMinimumConfidence", 0f).toDouble()
            )
        } else {
            null
        }
        return BackgroundLocationOptions(
            prefs.getString("trackingMode", null)?.let {
                runCatching { enumValueOf<BackgroundTrackingMode>(it) }.getOrNull()
            },
            accuracy,
            prefs.getString("granularity", null)?.let {
                runCatching { enumValueOf<AndroidGranularity>(it) }.getOrNull()
            },
            prefs.getFloat("interval", 10_000f).toDouble(),
            prefs.getFloat("fastestInterval", 5_000f).toDouble(),
            prefs.getFloat("distanceFilter", 0f).toDouble(),
            prefs.getFloat("maxUpdateDelay", 0f).toDouble(),
            prefs.getBoolean("waitForAccurateLocation", false),
            prefs.getBoolean("persist", true),
            prefs.getFloat("maxStoredLocations", 0f).toDouble().takeIf { it > 0 },
            prefs.getFloat("maxStoredEvents", 0f).toDouble().takeIf { it > 0 },
            prefs.getBoolean("stopOnTerminate", true),
            prefs.getBoolean("startOnBoot", false),
            AndroidBackgroundLocationOptions(
                prefs.getString("androidLocationProvider", null)?.let {
                    runCatching { enumValueOf<AndroidBackgroundProvider>(it) }.getOrNull()
                } ?: AndroidBackgroundProvider.AUTO,
                service,
                prefs.getBoolean("androidRequestNotificationPermission", true),
                prefs.getBoolean("androidRequestIgnoreBatteryOptimizations", false)
            ),
            null,
            null,
            activityRecognition,
            sync
        )
    }

    private fun mutablePendingIntentFlags(): Int {
        // The platform / Google Play Services inject the result (LocationResult, GeofencingEvent,
        // ActivityRecognitionResult) into the broadcast at send time, which requires a mutable
        // PendingIntent. Android 12+ (S) defaults to immutable and rejects an immutable callback
        // intent outright with "ApiException: 10: PendingIntent must be mutable", silently killing
        // delivery. Request FLAG_MUTABLE explicitly there; pre-S PendingIntents are mutable already.
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }
    }

    private fun locationPendingIntent(): PendingIntent {
        val intent = Intent(appContext, NitroLocationUpdateReceiver::class.java)
            .setAction(ACTION_LOCATION_UPDATE)
        return PendingIntent.getBroadcast(
            appContext,
            1001,
            intent,
            mutablePendingIntentFlags()
        )
    }

    private fun geofencePendingIntent(): PendingIntent {
        val intent = Intent(appContext, NitroGeofenceReceiver::class.java)
            .setAction(ACTION_GEOFENCE_UPDATE)
        return PendingIntent.getBroadcast(
            appContext,
            1002,
            intent,
            mutablePendingIntentFlags()
        )
    }

    private fun activityPendingIntent(): PendingIntent {
        val intent = Intent(appContext, NitroActivityRecognitionReceiver::class.java)
            .setAction(ACTION_ACTIVITY_UPDATE)
        return PendingIntent.getBroadcast(
            appContext,
            1003,
            intent,
            mutablePendingIntentFlags()
        )
    }

    private fun resolvePriority(options: BackgroundLocationOptions): Int {
        return when (options.accuracy?.android) {
            AndroidAccuracyPreset.HIGH -> Priority.PRIORITY_HIGH_ACCURACY
            AndroidAccuracyPreset.LOW -> Priority.PRIORITY_LOW_POWER
            AndroidAccuracyPreset.PASSIVE -> Priority.PRIORITY_PASSIVE
            else -> Priority.PRIORITY_BALANCED_POWER_ACCURACY
        }
    }

    companion object {
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
