package com.margelo.nitro.nitrogeolocation

import android.location.Location
import android.os.Build
import com.margelo.nitro.core.NullType.Companion.NULL

internal fun nullableDouble(value: Double?): NullableDouble {
    return value?.let { NullableDouble.create(it) } ?: NullableDouble.create(NULL)
}

internal fun Location.altitudeValue(): NullableDouble {
    return nullableDouble(if (hasAltitude()) altitude else null)
}

internal fun Location.altitudeAccuracyValue(): NullableDouble {
    return nullableDouble(
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && hasVerticalAccuracy()) {
            verticalAccuracyMeters.toDouble()
        } else {
            null
        }
    )
}

internal fun Location.headingValue(): NullableDouble {
    return nullableDouble(if (hasBearing()) bearing.toDouble() else null)
}

internal fun Location.speedValue(): NullableDouble {
    return nullableDouble(if (hasSpeed()) speed.toDouble() else null)
}
