package com.margelo.nitro.nitrogeolocation

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class LocationErrorCodePersistenceTest {
    @Test
    fun `round trips every modern location error code`() {
        LocationErrorCode.entries.forEach { code ->
            assertEquals(code, locationErrorCodeFromWireValue(locationErrorCodeToWireValue(code)))
        }
    }

    @Test
    fun `migrates known legacy numeric codes without guessing unknown values`() {
        assertEquals(LocationErrorCode.INTERNALERROR, locationErrorCodeFromLegacyValue(-1))
        assertEquals(LocationErrorCode.PERMISSIONDENIED, locationErrorCodeFromLegacyValue(1))
        assertEquals(LocationErrorCode.POSITIONUNAVAILABLE, locationErrorCodeFromLegacyValue(2))
        assertEquals(LocationErrorCode.TIMEOUT, locationErrorCodeFromLegacyValue(3))
        assertEquals(LocationErrorCode.PLAYSERVICESUNAVAILABLE, locationErrorCodeFromLegacyValue(4))
        assertEquals(LocationErrorCode.SETTINGSNOTSATISFIED, locationErrorCodeFromLegacyValue(5))
        assertNull(locationErrorCodeFromLegacyValue(999))
    }

    @Test
    fun `rejects unknown persisted string values`() {
        assertNull(locationErrorCodeFromWireValue("madeUpFailure"))
    }
}
