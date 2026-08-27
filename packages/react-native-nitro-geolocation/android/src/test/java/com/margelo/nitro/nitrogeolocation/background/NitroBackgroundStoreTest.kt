package com.margelo.nitro.nitrogeolocation.background

import androidx.test.core.app.ApplicationProvider
import com.margelo.nitro.nitrogeolocation.BackgroundEventEnvelope
import com.margelo.nitro.nitrogeolocation.BackgroundEventType
import com.margelo.nitro.nitrogeolocation.BackgroundLocation
import com.margelo.nitro.nitrogeolocation.BackgroundLocationSource
import com.margelo.nitro.nitrogeolocation.GeolocationCoordinates
import com.margelo.nitro.nitrogeolocation.GetStoredBackgroundEventsOptions
import com.margelo.nitro.nitrogeolocation.GetStoredBackgroundLocationsOptions
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class NitroBackgroundStoreTest {
    private lateinit var store: NitroBackgroundStore

    @Before
    fun setUp() {
        store = NitroBackgroundStore(ApplicationProvider.getApplicationContext())
        store.clearEvents(null)
        store.clearLocations(null)
    }

    @After
    fun tearDown() {
        store.clearEvents(null)
        store.clearLocations(null)
        store.close()
    }

    @Test
    fun `background queue queries have covering order indexes`() {
        val indexes = mutableSetOf<String>()
        store.readableDatabase.rawQuery(
            "SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_background_%'",
            null
        ).use { cursor ->
            while (cursor.moveToNext()) indexes += cursor.getString(0)
        }

        assertTrue("idx_background_locations_created_at" in indexes)
        assertTrue("idx_background_locations_sync_queue" in indexes)
        assertTrue("idx_background_locations_pending" in indexes)
        assertTrue("idx_background_events_created_at" in indexes)
        assertTrue("idx_background_events_pending" in indexes)
    }

    @Test
    fun `unsynced threshold check stops at the requested count`() {
        store.insertLocation(location("first", 1.0))
        store.insertLocation(location("second", 2.0))

        assertTrue(store.hasUnsyncedLocations(1))
        assertTrue(store.hasUnsyncedLocations(2))
        assertFalse(store.hasUnsyncedLocations(3))

        store.markSynced(arrayOf("first"))
        assertTrue(store.hasUnsyncedLocations(1))
        assertFalse(store.hasUnsyncedLocations(2))
    }

    @Test
    fun `location and event write shares one prune boundary`() {
        repeat(3) { index ->
            val location = location("location-$index", index.toDouble())
            store.insertLocationEventAndPrune(
                location,
                event("event-$index", location),
                maxLocations = 2,
                maxEvents = 2
            )
        }

        val locations = store.getLocations(
            GetStoredBackgroundLocationsOptions(10.0, null, true, true)
        )
        val events = store.getEvents(
            GetStoredBackgroundEventsOptions(null, 10.0, null, true)
        )

        assertEquals(2, locations.size)
        assertEquals(2, events.size)
    }

    private fun location(id: String, timestamp: Double) = BackgroundLocation(
        id,
        BackgroundLocationSource.BACKGROUND,
        true,
        null,
        false,
        timestamp,
        null,
        null,
        GeolocationCoordinates(
            37.5665,
            126.9780,
            null,
            5.0,
            null,
            null,
            null
        ),
        timestamp
    )

    private fun event(id: String, location: BackgroundLocation) = BackgroundEventEnvelope(
        location,
        null,
        null,
        null,
        null,
        null,
        null,
        id,
        BackgroundEventType.LOCATION,
        location.timestamp,
        false
    )
}
