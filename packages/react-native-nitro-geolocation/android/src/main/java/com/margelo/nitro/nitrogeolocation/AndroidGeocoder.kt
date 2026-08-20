package com.margelo.nitro.nitrogeolocation

import android.content.Context
import android.location.Geocoder
import android.os.Handler
import android.os.Looper
import java.io.IOException
import java.util.Locale

internal class AndroidGeocoder(private val context: Context) {
    fun geocode(
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

        runOperation(success, error, "Unable to geocode address") {
            val geocoder = Geocoder(context, Locale.getDefault())
            @Suppress("DEPRECATION")
            geocoder.getFromLocationName(query, MAX_RESULTS)
                .orEmpty()
                .mapNotNull { it.toGeocodedLocation() }
                .toTypedArray()
        }
    }

    fun reverseGeocode(
        coords: GeocodingCoordinates,
        success: (Array<ReverseGeocodedAddress>) -> Unit,
        error: ((LocationError) -> Unit)?
    ) {
        val validationError = validateCoordinates(coords)
        if (validationError != null) {
            error?.invoke(validationError)
            return
        }

        runOperation(success, error, "Unable to reverse geocode coordinates") {
            val geocoder = Geocoder(context, Locale.getDefault())
            @Suppress("DEPRECATION")
            geocoder.getFromLocation(coords.latitude, coords.longitude, MAX_RESULTS)
                .orEmpty()
                .map { it.toReverseGeocodedAddress() }
                .toTypedArray()
        }
    }

    private fun validateCoordinates(coords: GeocodingCoordinates): LocationError? {
        if (!coords.latitude.isFinite() || coords.latitude !in -90.0..90.0) {
            return createLocationError(
                INTERNAL_ERROR,
                "latitude must be a finite number between -90 and 90."
            )
        }
        if (!coords.longitude.isFinite() || coords.longitude !in -180.0..180.0) {
            return createLocationError(
                INTERNAL_ERROR,
                "longitude must be a finite number between -180 and 180."
            )
        }
        return null
    }

    private fun <T> runOperation(
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
            } catch (exception: IOException) {
                handler.post {
                    error?.invoke(createLocationError(
                        POSITION_UNAVAILABLE,
                        "$failurePrefix: ${exception.message ?: "geocoder service unavailable"}"
                    ))
                }
            } catch (exception: Exception) {
                handler.post {
                    error?.invoke(createLocationError(
                        INTERNAL_ERROR,
                        "$failurePrefix: ${exception.message ?: "unknown error"}"
                    ))
                }
            }
        }.start()
    }

    private companion object {
        const val MAX_RESULTS = 5
    }
}
