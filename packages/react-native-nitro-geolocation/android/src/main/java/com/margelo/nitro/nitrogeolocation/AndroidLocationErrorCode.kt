package com.margelo.nitro.nitrogeolocation

internal fun locationErrorCodeToWireValue(code: LocationErrorCode): String {
    return when (code) {
        LocationErrorCode.INTERNALERROR -> "internalError"
        LocationErrorCode.PERMISSIONDENIED -> "permissionDenied"
        LocationErrorCode.POSITIONUNAVAILABLE -> "positionUnavailable"
        LocationErrorCode.TIMEOUT -> "timeout"
        LocationErrorCode.PLAYSERVICESUNAVAILABLE -> "playServicesUnavailable"
        LocationErrorCode.SETTINGSNOTSATISFIED -> "settingsNotSatisfied"
    }
}

internal fun locationErrorCodeFromWireValue(value: String): LocationErrorCode? {
    return when (value) {
        "internalError" -> LocationErrorCode.INTERNALERROR
        "permissionDenied" -> LocationErrorCode.PERMISSIONDENIED
        "positionUnavailable" -> LocationErrorCode.POSITIONUNAVAILABLE
        "timeout" -> LocationErrorCode.TIMEOUT
        "playServicesUnavailable" -> LocationErrorCode.PLAYSERVICESUNAVAILABLE
        "settingsNotSatisfied" -> LocationErrorCode.SETTINGSNOTSATISFIED
        else -> null
    }
}

internal fun locationErrorCodeFromLegacyValue(value: Int): LocationErrorCode? {
    return when (value) {
        -1 -> LocationErrorCode.INTERNALERROR
        1 -> LocationErrorCode.PERMISSIONDENIED
        2 -> LocationErrorCode.POSITIONUNAVAILABLE
        3 -> LocationErrorCode.TIMEOUT
        4 -> LocationErrorCode.PLAYSERVICESUNAVAILABLE
        5 -> LocationErrorCode.SETTINGSNOTSATISFIED
        else -> null
    }
}
