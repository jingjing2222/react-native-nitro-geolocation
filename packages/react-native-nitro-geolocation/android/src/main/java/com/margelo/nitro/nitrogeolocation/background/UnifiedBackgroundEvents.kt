package com.margelo.nitro.nitrogeolocation.background

import com.margelo.nitro.nitrogeolocation.BackgroundEventEnvelope
import com.margelo.nitro.nitrogeolocation.BackgroundEventType
import com.margelo.nitro.nitrogeolocation.LocationProviderStatus
import java.util.UUID

internal fun createProviderChangeBackgroundEvent(
    status: LocationProviderStatus,
    id: String = UUID.randomUUID().toString(),
    timestamp: Double = System.currentTimeMillis().toDouble()
): BackgroundEventEnvelope = BackgroundEventEnvelope(
    location = null,
    geofence = null,
    activity = null,
    providerStatus = status,
    lifecycle = null,
    result = null,
    error = null,
    id = id,
    type = BackgroundEventType.PROVIDERCHANGE,
    timestamp = timestamp,
    deliveredToJS = false
)
