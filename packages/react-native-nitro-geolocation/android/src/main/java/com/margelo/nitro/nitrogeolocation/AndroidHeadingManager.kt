package com.margelo.nitro.nitrogeolocation

import android.content.Context
import android.hardware.GeomagneticField
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.location.Location
import android.os.Handler
import android.os.Looper
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import kotlin.math.abs

private const val DEFAULT_HEADING_TIMEOUT_MS = 10_000L

internal class AndroidHeadingManager(
    context: Context,
    private val createLocationError: (Double, String) -> LocationError,
    private val getReferenceLocation: () -> Location?
) {
    private data class PendingHeadingRequest(
        val id: UUID,
        val success: (Heading) -> Unit,
        val error: ((LocationError) -> Unit)?,
        val timeoutRunnable: Runnable
    )

    private data class HeadingSubscription(
        val token: String,
        val success: (Heading) -> Unit,
        val error: ((LocationError) -> Unit)?,
        val headingFilter: Double,
        var lastDeliveredHeading: Double?
    )

    private val sensorManager =
        context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
    private val mainHandler = Handler(Looper.getMainLooper())
    private val pendingRequests = ConcurrentHashMap<UUID, PendingHeadingRequest>()
    private val subscriptions = ConcurrentHashMap<String, HeadingSubscription>()
    private val rotationVectorSensor: Sensor? =
        sensorManager?.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)
            ?: sensorManager?.getDefaultSensor(Sensor.TYPE_GEOMAGNETIC_ROTATION_VECTOR)
    private val accelerometerSensor: Sensor? =
        sensorManager?.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
    private val magneticFieldSensor: Sensor? =
        sensorManager?.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD)

    private var isListening = false
    private var sensorAccuracy: Int? = null
    private var gravityValues: FloatArray? = null
    private var magneticValues: FloatArray? = null

    private val sensorListener = object : SensorEventListener {
        override fun onSensorChanged(event: SensorEvent) {
            val magneticHeading = when (event.sensor.type) {
                Sensor.TYPE_ROTATION_VECTOR,
                Sensor.TYPE_GEOMAGNETIC_ROTATION_VECTOR -> {
                    headingFromRotationVector(event.values)
                }
                Sensor.TYPE_ACCELEROMETER -> {
                    gravityValues = event.values.clone()
                    headingFromAccelerationAndMagnetometer()
                }
                Sensor.TYPE_MAGNETIC_FIELD -> {
                    magneticValues = event.values.clone()
                    headingFromAccelerationAndMagnetometer()
                }
                else -> null
            } ?: return

            emitHeading(createHeading(magneticHeading))
        }

        override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {
            sensorAccuracy = accuracy
        }
    }

    fun getHeading(
        success: (Heading) -> Unit,
        error: ((LocationError) -> Unit)?
    ) {
        if (!hasHeadingSensor()) {
            error?.invoke(createUnavailableError())
            return
        }

        val id = UUID.randomUUID()
        val timeoutRunnable = Runnable {
            pendingRequests.remove(id)?.error?.invoke(
                createLocationError(
                    TIMEOUT,
                    "Unable to fetch heading within ${DEFAULT_HEADING_TIMEOUT_MS / 1000.0}s."
                )
            )
            stopIfIdle()
        }

        pendingRequests[id] = PendingHeadingRequest(
            id = id,
            success = success,
            error = error,
            timeoutRunnable = timeoutRunnable
        )
        mainHandler.postDelayed(timeoutRunnable, DEFAULT_HEADING_TIMEOUT_MS)
        startIfNeeded()
    }

    fun watchHeading(
        success: (Heading) -> Unit,
        error: ((LocationError) -> Unit)?,
        options: HeadingOptions?
    ): String {
        val token = UUID.randomUUID().toString()
        val headingFilter = options?.headingFilter ?: 0.0

        if (!headingFilter.isFinite() || headingFilter < 0.0) {
            error?.invoke(createLocationError(
                INTERNAL_ERROR,
                "headingFilter must be a finite number greater than or equal to 0."
            ))
            return token
        }

        if (!hasHeadingSensor()) {
            error?.invoke(createUnavailableError())
            return token
        }

        subscriptions[token] = HeadingSubscription(
            token = token,
            success = success,
            error = error,
            headingFilter = headingFilter,
            lastDeliveredHeading = null
        )
        startIfNeeded()

        return token
    }

    fun unwatch(token: String) {
        subscriptions.remove(token)
        stopIfIdle()
    }

    fun stopObserving() {
        pendingRequests.values.forEach { request ->
            mainHandler.removeCallbacks(request.timeoutRunnable)
        }
        pendingRequests.clear()
        subscriptions.clear()
        stopListening()
    }

    fun hasActiveWork(): Boolean {
        return pendingRequests.isNotEmpty() || subscriptions.isNotEmpty()
    }

    private fun hasHeadingSensor(): Boolean {
        return sensorManager != null &&
            (rotationVectorSensor != null || (accelerometerSensor != null && magneticFieldSensor != null))
    }

    private fun startIfNeeded() {
        if (isListening) return

        val manager = sensorManager ?: return
        val didRegister = if (rotationVectorSensor != null) {
            manager.registerListener(
                sensorListener,
                rotationVectorSensor,
                SensorManager.SENSOR_DELAY_UI,
                mainHandler
            )
        } else {
            val accelerometerRegistered = manager.registerListener(
                sensorListener,
                accelerometerSensor!!,
                SensorManager.SENSOR_DELAY_UI,
                mainHandler
            )
            val magneticRegistered = manager.registerListener(
                sensorListener,
                magneticFieldSensor!!,
                SensorManager.SENSOR_DELAY_UI,
                mainHandler
            )
            accelerometerRegistered && magneticRegistered
        }

        isListening = didRegister
        if (!didRegister) {
            val error = createUnavailableError()
            pendingRequests.values.forEach { it.error?.invoke(error) }
            subscriptions.values.forEach { it.error?.invoke(error) }
            stopObserving()
        }
    }

    private fun stopIfIdle() {
        if (!hasActiveWork()) {
            stopListening()
        }
    }

    private fun stopListening() {
        if (!isListening) return

        try {
            sensorManager?.unregisterListener(sensorListener)
        } catch (_: Exception) {
            // Ignore unregister races.
        }
        isListening = false
        gravityValues = null
        magneticValues = null
    }

    private fun headingFromRotationVector(values: FloatArray): Double? {
        val rotationMatrix = FloatArray(9)
        val orientation = FloatArray(3)
        SensorManager.getRotationMatrixFromVector(rotationMatrix, values)
        SensorManager.getOrientation(rotationMatrix, orientation)
        return normalizeHeading(Math.toDegrees(orientation[0].toDouble()))
    }

    private fun headingFromAccelerationAndMagnetometer(): Double? {
        val gravity = gravityValues ?: return null
        val magnetic = magneticValues ?: return null
        val rotationMatrix = FloatArray(9)
        val inclinationMatrix = FloatArray(9)

        if (!SensorManager.getRotationMatrix(rotationMatrix, inclinationMatrix, gravity, magnetic)) {
            return null
        }

        val orientation = FloatArray(3)
        SensorManager.getOrientation(rotationMatrix, orientation)
        return normalizeHeading(Math.toDegrees(orientation[0].toDouble()))
    }

    private fun createHeading(magneticHeading: Double): Heading {
        val referenceLocation = getReferenceLocation()
        val trueHeading = referenceLocation?.let { location ->
            val field = GeomagneticField(
                location.latitude.toFloat(),
                location.longitude.toFloat(),
                if (location.hasAltitude()) location.altitude.toFloat() else 0f,
                location.time
            )
            normalizeHeading(magneticHeading + field.declination)
        }

        return Heading(
            magneticHeading = magneticHeading,
            trueHeading = trueHeading,
            accuracy = sensorAccuracy?.takeIf {
                it != SensorManager.SENSOR_STATUS_UNRELIABLE
            }?.toDouble(),
            timestamp = System.currentTimeMillis().toDouble()
        )
    }

    private fun emitHeading(heading: Heading) {
        val pendingSnapshot = pendingRequests.values.toList()
        pendingSnapshot.forEach { request ->
            mainHandler.removeCallbacks(request.timeoutRunnable)
            if (pendingRequests.remove(request.id) != null) {
                request.success(heading)
            }
        }

        subscriptions.values.forEach { subscription ->
            val lastHeading = subscription.lastDeliveredHeading
            if (
                lastHeading == null ||
                angularDistance(lastHeading, heading.magneticHeading) >= subscription.headingFilter
            ) {
                subscription.lastDeliveredHeading = heading.magneticHeading
                subscription.success(heading)
            }
        }

        stopIfIdle()
    }

    private fun angularDistance(first: Double, second: Double): Double {
        val distance = abs(first - second) % 360.0
        return if (distance > 180.0) 360.0 - distance else distance
    }

    private fun normalizeHeading(value: Double): Double {
        val normalized = value % 360.0
        return if (normalized < 0.0) normalized + 360.0 else normalized
    }

    private fun createUnavailableError(): LocationError {
        return createLocationError(
            POSITION_UNAVAILABLE,
            "Heading sensor is not available."
        )
    }

    private companion object {
        private const val INTERNAL_ERROR = -1.0
        private const val POSITION_UNAVAILABLE = 2.0
        private const val TIMEOUT = 3.0
    }
}
