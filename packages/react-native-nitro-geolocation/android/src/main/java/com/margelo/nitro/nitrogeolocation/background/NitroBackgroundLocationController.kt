package com.margelo.nitro.nitrogeolocation.background

import android.Manifest
import android.annotation.SuppressLint
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import androidx.core.content.ContextCompat
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.modules.core.PermissionAwareActivity
import com.facebook.react.modules.core.PermissionListener
import com.margelo.nitro.core.NullType
import com.google.android.gms.location.Geofence
import com.google.android.gms.location.ActivityRecognition
import com.google.android.gms.location.ActivityRecognitionResult
import com.google.android.gms.location.GeofencingEvent
import com.google.android.gms.location.GeofencingRequest
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.location.DetectedActivity as GmsDetectedActivity
import com.google.android.gms.tasks.Task
import com.margelo.nitro.nitrogeolocation.*
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.UUID
import org.json.JSONArray
import org.json.JSONObject

private const val ACTION_LOCATION_UPDATE =
    "com.margelo.nitro.nitrogeolocation.background.LOCATION_UPDATE"
private const val ACTION_GEOFENCE_UPDATE =
    "com.margelo.nitro.nitrogeolocation.background.GEOFENCE_UPDATE"
private const val ACTION_ACTIVITY_UPDATE =
    "com.margelo.nitro.nitrogeolocation.background.ACTIVITY_UPDATE"

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
    private val taskExecutor = Executors.newSingleThreadExecutor()

    @Volatile
    private var config: BackgroundLocationOptions? = null

    @Volatile
    private var state = BackgroundLocationState.IDLE

    fun checkBackgroundPermission(): BackgroundPermissionResult {
        val foreground = foregroundPermission()
        val background = backgroundPermission()
        return BackgroundPermissionResult(
            foreground,
            background,
            accuracyAuthorization(),
            Build.VERSION.SDK_INT < Build.VERSION_CODES.R,
            background != BackgroundPermissionStatus.GRANTED
        )
    }

    fun requestBackgroundPermission(reactContext: ReactApplicationContext): BackgroundPermissionResult {
        val activity = reactContext.currentActivity
        if (activity != null) {
            val permissions = mutableListOf<String>()
            if (foregroundPermission() != PermissionStatus.GRANTED) {
                permissions += Manifest.permission.ACCESS_FINE_LOCATION
                permissions += Manifest.permission.ACCESS_COARSE_LOCATION
            }
            if (Build.VERSION.SDK_INT == Build.VERSION_CODES.Q &&
                backgroundPermission() != BackgroundPermissionStatus.GRANTED) {
                permissions += Manifest.permission.ACCESS_BACKGROUND_LOCATION
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                getConfigOrNull()?.android?.requestNotificationPermission != false &&
                notificationPermission() != PermissionStatus.GRANTED) {
                permissions += Manifest.permission.POST_NOTIFICATIONS
            }
            if (permissions.isNotEmpty()) {
                requestPermissionsAndWait(activity, permissions.toTypedArray())
            }
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R &&
            backgroundPermission() != BackgroundPermissionStatus.GRANTED) {
            openAppLocationSettings()
        }
        return checkBackgroundPermission()
    }

    fun openAppLocationSettings() {
        val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
            .setData(Uri.fromParts("package", appContext.packageName, null))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        appContext.startActivity(intent)
    }

    fun configure(options: BackgroundLocationOptions) {
        validate(options)
        config = options
        persistConfig(options)
        options.geofencing?.let { registerPersistedGeofencesIfNeeded() }
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
        options?.let(::configure)
        val current = requireConfig()
        validate(current)
        if (foregroundPermission() != PermissionStatus.GRANTED) {
            throw SecurityException("Foreground location permission is required")
        }
        if (backgroundPermission() != BackgroundPermissionStatus.GRANTED) {
            throw SecurityException("Background location permission is required")
        }
        state = BackgroundLocationState.STARTING
        prefs.edit().putBoolean("running", true).apply()
        ContextCompat.startForegroundService(
            appContext,
            Intent(appContext, NitroBackgroundLocationService::class.java)
        )
        state = BackgroundLocationState.RUNNING
    }

    fun stop() {
        state = BackgroundLocationState.STOPPING
        stopNativeLocationUpdates()
        stopActivityRecognition()
        appContext.stopService(Intent(appContext, NitroBackgroundLocationService::class.java))
        prefs.edit().putBoolean("running", false).apply()
        state = BackgroundLocationState.STOPPED
    }

    fun reset() {
        stop()
        removeGeofences(null)
        config = null
        prefs.edit().clear().apply()
        store.clearEvents(null)
        store.clearLocations(null)
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
            foregroundPermission(),
            backgroundPermission(),
            accuracyAuthorization(),
            providerEnabled,
            null,
            store.count("background_locations"),
            store.count("background_events"),
            store.count("geofences"),
            AndroidBackgroundLocationStatus(
                prefs.getBoolean("running", false),
                null,
                notificationPermission()
            ),
            null,
            null
        )
    }

    @SuppressLint("MissingPermission")
    fun startNativeLocationUpdates() {
        val current = requireConfig()
        if (current.android?.locationProvider == AndroidBackgroundProvider.ANDROID_PLATFORM) {
            startPlatformLocationUpdates(current)
            return
        }
        val request = LocationRequest.Builder(
            resolvePriority(current),
            current.interval?.toLong() ?: 10_000L
        )
            .setMinUpdateIntervalMillis(current.fastestInterval?.toLong() ?: 5_000L)
            .setMinUpdateDistanceMeters((current.distanceFilter ?: 0.0).toFloat())
            .setWaitForAccurateLocation(current.waitForAccurateLocation == true)
            .setMaxUpdateDelayMillis(current.maxUpdateDelay?.toLong() ?: 0L)
            .build()

        fusedLocationClient.requestLocationUpdates(request, locationPendingIntent())
    }

    fun stopNativeLocationUpdates() {
        fusedLocationClient.removeLocationUpdates(locationPendingIntent())
        runCatching { platformLocationManager.removeUpdates(locationPendingIntent()) }
    }

    fun handleNativeLocation(location: Location, source: BackgroundLocationSource) {
        val id = UUID.randomUUID().toString()
        val backgroundLocation = BackgroundLocation(
            id,
            source,
            true,
            providerFrom(location.provider),
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
        if (backgroundPermission() != BackgroundPermissionStatus.GRANTED) {
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
        val result = uploadLocationsWithRetry(sync, locations)
        store.markSynced(result.syncedLocationIds.toList())
        if (sync.autoClear == true) {
            store.clearLocations(result.syncedLocationIds)
        }
        return result
    }

    private fun uploadLocationsWithRetry(
        sync: BackgroundHttpSyncOptions,
        locations: Array<StoredBackgroundLocation>
    ): BackgroundHttpSyncResult {
        val ids = locations.map { it.id }
        val maxAttempts = if (sync.retry == true) {
            (sync.maxRetries?.toInt()?.takeIf { it >= 0 } ?: 3) + 1
        } else {
            1
        }
        var lastStatus: Int? = null
        var lastError: String? = null

        if (sync.batch == false) {
            return uploadSingleLocationsWithRetry(sync, locations, maxAttempts)
        }

        repeat(maxAttempts) { attempt ->
            try {
                val response = uploadLocations(sync, locations)
                lastStatus = response
                if (response in 200..299) {
                    return BackgroundHttpSyncResult(
                        true,
                        response.toDouble(),
                        ids.toTypedArray(),
                        emptyArray(),
                        null
                    )
                }
                lastError = "HTTP sync failed with status $response"
            } catch (error: Exception) {
                lastError = error.message ?: "HTTP sync failed"
            }
            if (attempt < maxAttempts - 1) {
                Thread.sleep(1_000L)
            }
        }

        return BackgroundHttpSyncResult(
            false,
            lastStatus?.toDouble(),
            emptyArray(),
            ids.toTypedArray(),
            lastError ?: "HTTP sync failed"
        )
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

        Thread {
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
        }.start()
    }

    private fun shouldPersist(): Boolean {
        return getConfigOrNull()?.persist != false
    }

    private fun persistEventIfNeeded(event: BackgroundEventEnvelope) {
        if (!shouldPersist()) return
        store.insertEvent(event)
        store.pruneEvents(currentMaxStoredEvents())
    }

    private fun currentMaxStoredLocations(): Int? {
        return getConfigOrNull()?.maxStoredLocations?.toInt()?.takeIf { it > 0 }
    }

    private fun currentMaxStoredEvents(): Int? {
        return getConfigOrNull()?.maxStoredEvents?.toInt()?.takeIf { it > 0 }
    }

    @SuppressLint("MissingPermission")
    private fun startPlatformLocationUpdates(options: BackgroundLocationOptions) {
        val interval = options.interval?.toLong() ?: 10_000L
        val distance = (options.distanceFilter ?: 0.0).toFloat()
        val providers = listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)
            .filter { provider -> runCatching { platformLocationManager.isProviderEnabled(provider) }.getOrDefault(false) }
            .ifEmpty { listOf(LocationManager.GPS_PROVIDER) }
        providers.forEach { provider ->
            platformLocationManager.requestLocationUpdates(
                provider,
                interval,
                distance,
                locationPendingIntent()
            )
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

    private fun requestPermissionsAndWait(
        activity: android.app.Activity,
        permissions: Array<String>
    ) {
        val permissionAware = activity as? PermissionAwareActivity
        val latch = CountDownLatch(1)
        var lifecycleCallbacks: android.app.Application.ActivityLifecycleCallbacks? = null
        fun finishNonPermissionAwareRequest() {
            latch.countDown()
            lifecycleCallbacks?.let {
                runCatching {
                    activity.application.unregisterActivityLifecycleCallbacks(it)
                }
                lifecycleCallbacks = null
            }
        }
        if (permissionAware == null) {
            lifecycleCallbacks = object : android.app.Application.ActivityLifecycleCallbacks {
                override fun onActivityCreated(
                    activity: android.app.Activity,
                    savedInstanceState: android.os.Bundle?
                ) = Unit
                override fun onActivityStarted(activity: android.app.Activity) = Unit
                override fun onActivityResumed(resumedActivity: android.app.Activity) {
                    if (resumedActivity === activity) {
                        finishNonPermissionAwareRequest()
                    }
                }
                override fun onActivityPaused(activity: android.app.Activity) = Unit
                override fun onActivityStopped(activity: android.app.Activity) = Unit
                override fun onActivitySaveInstanceState(
                    activity: android.app.Activity,
                    outState: android.os.Bundle
                ) = Unit
                override fun onActivityDestroyed(activity: android.app.Activity) = Unit
            }
            activity.application.registerActivityLifecycleCallbacks(lifecycleCallbacks)
        }
        Handler(Looper.getMainLooper()).post {
            if (permissionAware == null) {
                androidx.core.app.ActivityCompat.requestPermissions(activity, permissions, 9473)
                Handler(Looper.getMainLooper()).postDelayed(
                    { finishNonPermissionAwareRequest() },
                    60_000
                )
            } else {
                permissionAware.requestPermissions(
                    permissions,
                    9473,
                    PermissionListener { requestCode, _, _ ->
                        if (requestCode == 9473) {
                            latch.countDown()
                            true
                        } else {
                            false
                        }
                    }
                )
            }
        }
        if (Looper.myLooper() != Looper.getMainLooper()) {
            latch.await(60, TimeUnit.SECONDS)
        }
        if (permissionAware == null && Looper.myLooper() != Looper.getMainLooper()) {
            finishNonPermissionAwareRequest()
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

    private fun uploadLocations(
        sync: BackgroundHttpSyncOptions,
        locations: Array<StoredBackgroundLocation>
    ): Int {
        val connection = (URL(sync.url).openConnection() as HttpURLConnection).apply {
            requestMethod = sync.method?.name ?: "POST"
            connectTimeout = 15_000
            readTimeout = 15_000
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
            sync.headers?.forEach { (key, value) -> setRequestProperty(key, value) }
        }
        OutputStreamWriter(connection.outputStream).use { writer ->
            writer.write(sync.batchBody(locations).toString())
        }
        return connection.responseCode
    }

    private fun uploadSingleLocationsWithRetry(
        sync: BackgroundHttpSyncOptions,
        locations: Array<StoredBackgroundLocation>,
        maxAttempts: Int
    ): BackgroundHttpSyncResult {
        val synced = mutableListOf<String>()
        val failed = mutableListOf<String>()
        var lastStatus: Int? = null
        var lastError: String? = null

        for (location in locations) {
            var didSync = false
            for (attempt in 0 until maxAttempts) {
                try {
                    val response = uploadLocation(sync, location)
                    lastStatus = response
                    if (response in 200..299) {
                        synced += location.id
                        didSync = true
                        break
                    }
                    lastError = "HTTP sync failed with status $response"
                } catch (error: Exception) {
                    lastError = error.message ?: "HTTP sync failed"
                }
                if (!didSync && attempt < maxAttempts - 1) {
                    Thread.sleep(1_000L)
                }
            }
            if (!didSync) {
                failed += location.id
            }
        }

        return BackgroundHttpSyncResult(
            failed.isEmpty(),
            lastStatus?.toDouble(),
            synced.toTypedArray(),
            failed.toTypedArray(),
            if (failed.isEmpty()) null else lastError ?: "HTTP sync failed"
        )
    }

    private fun uploadLocation(
        sync: BackgroundHttpSyncOptions,
        location: StoredBackgroundLocation
    ): Int {
        val connection = (URL(sync.url).openConnection() as HttpURLConnection).apply {
            requestMethod = sync.method?.name ?: "POST"
            connectTimeout = 15_000
            readTimeout = 15_000
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
            sync.headers?.forEach { (key, value) -> setRequestProperty(key, value) }
        }
        OutputStreamWriter(connection.outputStream).use { writer ->
            writer.write(sync.singleBody(location).toString())
        }
        return connection.responseCode
    }

    private fun locationPendingIntent(): PendingIntent {
        val intent = Intent(appContext, NitroLocationUpdateReceiver::class.java)
            .setAction(ACTION_LOCATION_UPDATE)
        return PendingIntent.getBroadcast(
            appContext,
            1001,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    private fun geofencePendingIntent(): PendingIntent {
        val intent = Intent(appContext, NitroGeofenceReceiver::class.java)
            .setAction(ACTION_GEOFENCE_UPDATE)
        return PendingIntent.getBroadcast(
            appContext,
            1002,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    private fun activityPendingIntent(): PendingIntent {
        val intent = Intent(appContext, NitroActivityRecognitionReceiver::class.java)
            .setAction(ACTION_ACTIVITY_UPDATE)
        return PendingIntent.getBroadcast(
            appContext,
            1003,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    private fun foregroundPermission(): PermissionStatus {
        val fine = ContextCompat.checkSelfPermission(
            appContext,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        val coarse = ContextCompat.checkSelfPermission(
            appContext,
            Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        return if (fine || coarse) PermissionStatus.GRANTED else PermissionStatus.DENIED
    }

    private fun backgroundPermission(): BackgroundPermissionStatus {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            return BackgroundPermissionStatus.GRANTED
        }
        return if (
            ContextCompat.checkSelfPermission(
                appContext,
                Manifest.permission.ACCESS_BACKGROUND_LOCATION
            ) == PackageManager.PERMISSION_GRANTED
        ) {
            BackgroundPermissionStatus.GRANTED
        } else {
            BackgroundPermissionStatus.DENIED
        }
    }

    private fun notificationPermission(): PermissionStatus? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return null
        return if (
            ContextCompat.checkSelfPermission(
                appContext,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
        ) {
            PermissionStatus.GRANTED
        } else {
            PermissionStatus.DENIED
        }
    }

    private fun accuracyAuthorization(): AccuracyAuthorization {
        val fine = ContextCompat.checkSelfPermission(
            appContext,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        val coarse = ContextCompat.checkSelfPermission(
            appContext,
            Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        return when {
            fine -> AccuracyAuthorization.FULL
            coarse -> AccuracyAuthorization.REDUCED
            else -> AccuracyAuthorization.UNKNOWN
        }
    }

    private fun resolvePriority(options: BackgroundLocationOptions): Int {
        return when (options.accuracy?.android) {
            AndroidAccuracyPreset.HIGH -> Priority.PRIORITY_HIGH_ACCURACY
            AndroidAccuracyPreset.LOW -> Priority.PRIORITY_LOW_POWER
            AndroidAccuracyPreset.PASSIVE -> Priority.PRIORITY_PASSIVE
            else -> Priority.PRIORITY_BALANCED_POWER_ACCURACY
        }
    }

    private fun providerFrom(provider: String?): LocationProviderUsed {
        return when (provider) {
            LocationManager.GPS_PROVIDER -> LocationProviderUsed.GPS
            LocationManager.NETWORK_PROVIDER -> LocationProviderUsed.NETWORK
            LocationManager.PASSIVE_PROVIDER -> LocationProviderUsed.PASSIVE
            "fused" -> LocationProviderUsed.FUSED
            else -> LocationProviderUsed.UNKNOWN
        }
    }

    private fun BackgroundEventEnvelope.toJson(): JSONObject {
        return JSONObject()
            .put("id", id)
            .put("type", type.jsValue())
            .put("timestamp", timestamp)
            .put("deliveredToJS", deliveredToJS)
            .apply {
                location?.let { put("location", it.toJson()) }
                geofence?.let { put("geofence", it.toJson()) }
                activity?.let { put("activity", it.toJson()) }
                result?.let { put("result", it.toJson()) }
            }
    }

    private fun BackgroundHttpSyncResult.toJson(): JSONObject {
        return JSONObject()
            .put("success", success)
            .put("statusCode", statusCode)
            .put("syncedLocationIds", JSONArray(syncedLocationIds.toList()))
            .put("failedLocationIds", JSONArray(failedLocationIds.toList()))
            .put("error", error)
    }

    private fun DetectedActivity.toJson(): JSONObject {
        return JSONObject()
            .put("type", type.jsValue())
            .put("confidence", confidence)
            .put("timestamp", timestamp)
    }

    private fun StoredBackgroundLocation.toJson(): JSONObject {
        return JSONObject()
            .put("id", id)
            .put("deliveredToJS", deliveredToJS)
            .put("synced", synced)
            .put("createdAt", createdAt)
            .put("source", source.jsValue())
            .put("isFromBackground", isFromBackground)
            .put("provider", provider?.jsValue())
            .put("mocked", mocked)
            .put("recordedAt", recordedAt)
            .put("coords", coords.toJson())
            .put("timestamp", timestamp)
    }

    private fun BackgroundLocation.toJson(): JSONObject {
        return JSONObject()
            .put("id", id)
            .put("source", source.jsValue())
            .put("isFromBackground", isFromBackground)
            .put("provider", provider?.jsValue())
            .put("mocked", mocked)
            .put("recordedAt", recordedAt)
            .put("coords", coords.toJson())
            .put("timestamp", timestamp)
    }

    private fun GeolocationCoordinates.toJson(): JSONObject {
        return JSONObject()
            .put("latitude", latitude)
            .put("longitude", longitude)
            .put("altitude", altitude?.asSecondOrNull())
            .put("accuracy", accuracy)
            .put("altitudeAccuracy", altitudeAccuracy?.asSecondOrNull())
            .put("heading", heading?.asSecondOrNull())
            .put("speed", speed?.asSecondOrNull())
    }

    private fun GeofenceEvent.toJson(): JSONObject {
        return JSONObject()
            .put("region", region.toJson())
            .put("transition", transition.jsValue())
            .put("timestamp", timestamp)
    }

    private fun GeofenceRegion.toJson(): JSONObject {
        return JSONObject()
            .put("identifier", identifier)
            .put("latitude", latitude)
            .put("longitude", longitude)
            .put("radius", radius)
            .put("notifyOnEntry", notifyOnEntry)
            .put("notifyOnExit", notifyOnExit)
            .put("notifyOnDwell", notifyOnDwell)
            .put("loiteringDelay", loiteringDelay)
            .put("expirationDuration", expirationDuration)
            .put("metadata", metadataToJsonObject(metadata))
    }

    private fun metadataToJsonObject(
        metadata: Map<String, Variant_NullType_Boolean_String_Double>?
    ): JSONObject? {
        metadata ?: return null
        val json = JSONObject()
        metadata.forEach { (key, value) ->
            when (value) {
                is Variant_NullType_Boolean_String_Double.First -> json.put(key, JSONObject.NULL)
                is Variant_NullType_Boolean_String_Double.Second -> json.put(key, value.value)
                is Variant_NullType_Boolean_String_Double.Third -> json.put(key, value.value)
                is Variant_NullType_Boolean_String_Double.Fourth -> json.put(key, value.value)
            }
        }
        return json
    }

    private fun stringMapToJson(map: Map<String, String>): String {
        val json = JSONObject()
        map.forEach { (key, value) -> json.put(key, value) }
        return json.toString()
    }

    private fun jsonToStringMap(payload: String): Map<String, String> {
        val json = JSONObject(payload)
        val map = mutableMapOf<String, String>()
        val keys = json.keys()
        while (keys.hasNext()) {
            val key = keys.next()
            map[key] = json.getString(key)
        }
        return map
    }

    private fun variantMapToJson(map: Map<String, Variant_NullType_Boolean_String_Double>): String {
        return metadataToJsonObject(map)?.toString() ?: "{}"
    }

    private fun jsonToVariantMap(payload: String): Map<String, Variant_NullType_Boolean_String_Double> {
        val json = JSONObject(payload)
        val map = mutableMapOf<String, Variant_NullType_Boolean_String_Double>()
        val keys = json.keys()
        while (keys.hasNext()) {
            val key = keys.next()
            map[key] = when (val value = json.get(key)) {
                JSONObject.NULL -> Variant_NullType_Boolean_String_Double.create(NullType.NULL)
                is Boolean -> Variant_NullType_Boolean_String_Double.create(value)
                is String -> Variant_NullType_Boolean_String_Double.create(value)
                is Number -> Variant_NullType_Boolean_String_Double.create(value.toDouble())
                else -> Variant_NullType_Boolean_String_Double.create(value.toString())
            }
        }
        return map
    }

    private fun BackgroundHttpSyncOptions.batchBody(locations: Array<StoredBackgroundLocation>): JSONObject {
        val body = metadataToJsonObject(bodyTemplate) ?: JSONObject()
        body.put("locations", JSONArray(locations.map { it.toJson() }))
        return body
    }

    private fun BackgroundHttpSyncOptions.singleBody(location: StoredBackgroundLocation): JSONObject {
        val body = metadataToJsonObject(bodyTemplate)
        if (body != null) {
            body.put("location", location.toJson())
            return body
        }
        return location.toJson()
    }

    private fun BackgroundEventType.jsValue(): String {
        return when (this) {
            BackgroundEventType.LOCATION -> "location"
            BackgroundEventType.GEOFENCE -> "geofence"
            BackgroundEventType.ACTIVITY -> "activity"
            BackgroundEventType.PROVIDERCHANGE -> "providerChange"
            BackgroundEventType.HTTPSYNC -> "httpSync"
            BackgroundEventType.ERROR -> "error"
        }
    }

    private fun BackgroundLocationSource.jsValue(): String {
        return when (this) {
            BackgroundLocationSource.FOREGROUNDSERVICE -> "foregroundService"
            BackgroundLocationSource.BACKGROUND -> "background"
            BackgroundLocationSource.SIGNIFICANTCHANGE -> "significantChange"
            BackgroundLocationSource.GEOFENCE -> "geofence"
            BackgroundLocationSource.DEFERRED -> "deferred"
            BackgroundLocationSource.MANUAL -> "manual"
            BackgroundLocationSource.UNKNOWN -> "unknown"
        }
    }

    private fun LocationProviderUsed.jsValue(): String {
        return when (this) {
            LocationProviderUsed.GPS -> "gps"
            LocationProviderUsed.NETWORK -> "network"
            LocationProviderUsed.PASSIVE -> "passive"
            LocationProviderUsed.FUSED -> "fused"
            LocationProviderUsed.UNKNOWN -> "unknown"
        }
    }

    private fun GeofenceTransition.jsValue(): String {
        return when (this) {
            GeofenceTransition.ENTER -> "enter"
            GeofenceTransition.EXIT -> "exit"
            GeofenceTransition.DWELL -> "dwell"
        }
    }

    private fun DetectedActivityType.jsValue(): String {
        return when (this) {
            DetectedActivityType.STILL -> "still"
            DetectedActivityType.WALKING -> "walking"
            DetectedActivityType.RUNNING -> "running"
            DetectedActivityType.ONFOOT -> "onFoot"
            DetectedActivityType.ONBICYCLE -> "onBicycle"
            DetectedActivityType.INVEHICLE -> "inVehicle"
            DetectedActivityType.TILTING -> "tilting"
            DetectedActivityType.UNKNOWN -> "unknown"
        }
    }

    private fun GmsDetectedActivity.toNitroActivityType(): DetectedActivityType {
        return when (type) {
            GmsDetectedActivity.STILL -> DetectedActivityType.STILL
            GmsDetectedActivity.WALKING -> DetectedActivityType.WALKING
            GmsDetectedActivity.RUNNING -> DetectedActivityType.RUNNING
            GmsDetectedActivity.ON_FOOT -> DetectedActivityType.ONFOOT
            GmsDetectedActivity.ON_BICYCLE -> DetectedActivityType.ONBICYCLE
            GmsDetectedActivity.IN_VEHICLE -> DetectedActivityType.INVEHICLE
            GmsDetectedActivity.TILTING -> DetectedActivityType.TILTING
            else -> DetectedActivityType.UNKNOWN
        }
    }

    private fun GeofenceRegion.toTransitionTypes(): Int {
        var transitions = 0
        if (notifyOnEntry != false) transitions = transitions or Geofence.GEOFENCE_TRANSITION_ENTER
        if (notifyOnExit != false) transitions = transitions or Geofence.GEOFENCE_TRANSITION_EXIT
        if (notifyOnDwell == true) transitions = transitions or Geofence.GEOFENCE_TRANSITION_DWELL
        return transitions
    }

    private fun GeofencingOptions?.toInitialTrigger(): Int {
        val triggers = this?.initialTrigger ?: return 0
        var value = 0
        for (trigger in triggers) {
            value = value or when (trigger) {
                GeofenceTransition.ENTER -> GeofencingRequest.INITIAL_TRIGGER_ENTER
                GeofenceTransition.EXIT -> GeofencingRequest.INITIAL_TRIGGER_EXIT
                GeofenceTransition.DWELL -> GeofencingRequest.INITIAL_TRIGGER_DWELL
            }
        }
        return value
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
