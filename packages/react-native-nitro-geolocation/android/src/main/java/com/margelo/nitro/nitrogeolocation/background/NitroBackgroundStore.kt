package com.margelo.nitro.nitrogeolocation.background

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import com.margelo.nitro.nitrogeolocation.BackgroundEventEnvelope
import com.margelo.nitro.nitrogeolocation.BackgroundEventType
import com.margelo.nitro.nitrogeolocation.BackgroundHttpSyncResult
import com.margelo.nitro.nitrogeolocation.BackgroundLocation
import com.margelo.nitro.nitrogeolocation.BackgroundLocationSource
import com.margelo.nitro.nitrogeolocation.DetectedActivity
import com.margelo.nitro.nitrogeolocation.DetectedActivityType
import com.margelo.nitro.nitrogeolocation.GeofenceEvent
import com.margelo.nitro.nitrogeolocation.GeofenceRegion
import com.margelo.nitro.nitrogeolocation.GeofenceTransition
import com.margelo.nitro.nitrogeolocation.GeolocationCoordinates
import com.margelo.nitro.nitrogeolocation.GetStoredBackgroundEventsOptions
import com.margelo.nitro.nitrogeolocation.GetStoredBackgroundLocationsOptions
import com.margelo.nitro.nitrogeolocation.LocationProviderUsed
import com.margelo.nitro.nitrogeolocation.NullableDouble
import com.margelo.nitro.nitrogeolocation.StoredBackgroundEventEnvelope
import com.margelo.nitro.nitrogeolocation.StoredBackgroundLocation
import com.margelo.nitro.nitrogeolocation.Variant_NullType_Boolean_String_Double
import com.margelo.nitro.core.NullType
import org.json.JSONArray
import org.json.JSONObject

class NitroBackgroundStore(context: Context) :
    SQLiteOpenHelper(context, "nitro_background_location.db", null, 3) {

    init {
        // WAL lets the broadcast-receiver writer and concurrent readers (JS Promise threads and the
        // sync worker) proceed without blocking each other under a steady stream of location inserts.
        setWriteAheadLoggingEnabled(true)
    }

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS background_locations (
              id TEXT PRIMARY KEY,
              latitude REAL NOT NULL,
              longitude REAL NOT NULL,
              altitude REAL,
              accuracy REAL NOT NULL,
              altitude_accuracy REAL,
              heading REAL,
              speed REAL,
              timestamp REAL NOT NULL,
              provider TEXT,
              mocked INTEGER,
              source TEXT NOT NULL,
              recorded_at REAL NOT NULL,
              delivered_to_js INTEGER NOT NULL DEFAULT 0,
              synced INTEGER NOT NULL DEFAULT 0,
              created_at REAL NOT NULL
            )
            """.trimIndent()
        )
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS background_events (
              id TEXT PRIMARY KEY,
              type TEXT NOT NULL,
              location_id TEXT,
              payload TEXT,
              timestamp REAL NOT NULL,
              delivered_to_js INTEGER NOT NULL DEFAULT 0,
              created_at REAL NOT NULL
            )
            """.trimIndent()
        )
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS geofences (
              identifier TEXT PRIMARY KEY,
              latitude REAL NOT NULL,
              longitude REAL NOT NULL,
              radius REAL NOT NULL,
              notify_on_entry INTEGER NOT NULL,
              notify_on_exit INTEGER NOT NULL,
              notify_on_dwell INTEGER NOT NULL,
              loitering_delay REAL,
              expiration_duration REAL,
              metadata TEXT,
              created_at REAL NOT NULL
            )
            """.trimIndent()
        )
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        if (oldVersion < 2) {
            runCatching { db.execSQL("ALTER TABLE background_events ADD COLUMN payload TEXT") }
        }
        if (oldVersion < 3) {
            runCatching { db.execSQL("ALTER TABLE geofences ADD COLUMN metadata TEXT") }
        }
    }

    fun insertLocation(location: BackgroundLocation): StoredBackgroundLocation {
        val id = location.id ?: java.util.UUID.randomUUID().toString()
        val createdAt = System.currentTimeMillis().toDouble()
        writableDatabase.insertWithOnConflict(
            "background_locations",
            null,
            ContentValues().apply {
                put("id", id)
                put("latitude", location.coords.latitude)
                put("longitude", location.coords.longitude)
                put("altitude", location.coords.altitude?.asSecondOrNull())
                put("accuracy", location.coords.accuracy)
                put("altitude_accuracy", location.coords.altitudeAccuracy?.asSecondOrNull())
                put("heading", location.coords.heading?.asSecondOrNull())
                put("speed", location.coords.speed?.asSecondOrNull())
                put("timestamp", location.timestamp)
                put("provider", location.provider?.name)
                put("mocked", if (location.mocked == true) 1 else 0)
                put("source", location.source.name)
                put("recorded_at", location.recordedAt)
                put("created_at", createdAt)
            },
            SQLiteDatabase.CONFLICT_REPLACE
        )

        return StoredBackgroundLocation(
            id,
            false,
            false,
            createdAt,
            location.source,
            location.isFromBackground,
            location.provider,
            location.mocked,
            location.recordedAt,
            location.activity,
            location.battery,
            location.coords,
            location.timestamp
        )
    }

    fun insertEvent(event: BackgroundEventEnvelope) {
        writableDatabase.insertWithOnConflict(
            "background_events",
            null,
            ContentValues().apply {
                put("id", event.id)
                put("type", event.type.name)
                put("location_id", event.location?.id)
                put(
                    "payload",
                    event.location?.let(::locationPayload)
                        ?: event.geofence?.let(::geofencePayload)
                        ?: event.activity?.let(::activityPayload)
                        ?: event.result?.let(::httpSyncPayload)
                )
                put("timestamp", event.timestamp)
                put("delivered_to_js", if (event.deliveredToJS) 1 else 0)
                put("created_at", System.currentTimeMillis().toDouble())
            },
            SQLiteDatabase.CONFLICT_REPLACE
        )
    }

    fun getLocations(options: GetStoredBackgroundLocationsOptions?): Array<StoredBackgroundLocation> {
        val where = mutableListOf<String>()
        val args = mutableListOf<String>()
        if (options?.includeDelivered != true) {
            where += "delivered_to_js = 0"
        }
        if (options?.includeSynced != true) {
            where += "synced = 0"
        }
        options?.since?.let {
            where += "created_at >= ?"
            args += it.toString()
        }
        val limit = options?.limit?.toInt()?.takeIf { it > 0 } ?: 100
        val cursor = readableDatabase.query(
            "background_locations",
            null,
            where.takeIf { it.isNotEmpty() }?.joinToString(" AND "),
            args.toTypedArray(),
            null,
            null,
            "created_at DESC",
            limit.toString()
        )
        return cursor.use {
            val rows = mutableListOf<StoredBackgroundLocation>()
            while (it.moveToNext()) {
                rows += cursorToStoredLocation(it)
            }
            rows.toTypedArray()
        }
    }

    fun getEvents(options: GetStoredBackgroundEventsOptions?): Array<StoredBackgroundEventEnvelope> {
        val where = mutableListOf<String>()
        val args = mutableListOf<String>()
        if (options?.includeDelivered != true) {
            where += "delivered_to_js = 0"
        }
        options?.since?.let {
            where += "created_at >= ?"
            args += it.toString()
        }
        options?.types?.takeIf { it.isNotEmpty() }?.let { types ->
            where += "type IN (${types.joinToString(",") { "?" }})"
            args += types.map { it.name }
        }
        val limit = options?.limit?.toInt()?.takeIf { it > 0 } ?: 100
        val cursor = readableDatabase.query(
            "background_events",
            null,
            where.takeIf { it.isNotEmpty() }?.joinToString(" AND "),
            args.toTypedArray(),
            null,
            null,
            "created_at DESC",
            limit.toString()
        )
        return cursor.use {
            val rows = mutableListOf<StoredBackgroundEventEnvelope>()
            while (it.moveToNext()) {
                val id = it.getString(it.getColumnIndexOrThrow("id"))
                val type = enumValueOf<BackgroundEventType>(
                    it.getString(it.getColumnIndexOrThrow("type"))
                )
                val locationId = it.getString(it.getColumnIndexOrThrow("location_id"))
                val payload = nullableStringColumn(it, "payload")
                val geofence = if (type == BackgroundEventType.GEOFENCE) {
                    payload?.let(::payloadToGeofence)
                } else {
                    null
                }
                val activity = if (type == BackgroundEventType.ACTIVITY) {
                    payload?.let(::payloadToActivity)
                } else {
                    null
                }
                val result = if (type == BackgroundEventType.HTTPSYNC) {
                    payload?.let(::payloadToHttpSync)
                } else {
                    null
                }
                val location = if (type == BackgroundEventType.LOCATION) {
                    payload?.let(::payloadToLocation)
                        ?: locationId?.let(::getLocationById)?.toBackgroundLocation()
                } else {
                    locationId?.let(::getLocationById)?.toBackgroundLocation()
                }
                val event = BackgroundEventEnvelope(
                    location,
                    geofence,
                    activity,
                    null,
                    result,
                    null,
                    id,
                    type,
                    it.getDouble(it.getColumnIndexOrThrow("timestamp")),
                    it.getInt(it.getColumnIndexOrThrow("delivered_to_js")) == 1
                )
                rows += StoredBackgroundEventEnvelope(
                    event,
                    it.getDouble(it.getColumnIndexOrThrow("created_at")),
                    id,
                    type,
                    event.timestamp,
                    event.deliveredToJS
                )
            }
            rows.toTypedArray()
        }
    }

    fun markLocationsDelivered(ids: Array<String>) = markRows("background_locations", ids)
    fun markEventsDelivered(ids: Array<String>) = markRows("background_events", ids)
    fun clearLocations(ids: Array<String>?) = deleteRows("background_locations", ids)
    fun clearEvents(ids: Array<String>?) = deleteRows("background_events", ids)

    fun saveGeofences(regions: Array<GeofenceRegion>) {
        writableDatabase.beginTransaction()
        try {
            for (region in regions) {
                writableDatabase.insertWithOnConflict(
                    "geofences",
                    null,
                    ContentValues().apply {
                        put("identifier", region.identifier)
                        put("latitude", region.latitude)
                        put("longitude", region.longitude)
                        put("radius", region.radius)
                        put("notify_on_entry", if (region.notifyOnEntry != false) 1 else 0)
                        put("notify_on_exit", if (region.notifyOnExit != false) 1 else 0)
                        put("notify_on_dwell", if (region.notifyOnDwell == true) 1 else 0)
                        put("loitering_delay", region.loiteringDelay)
                        put("expiration_duration", region.expirationDuration)
                        put("metadata", metadataToJson(region.metadata))
                        put("created_at", System.currentTimeMillis().toDouble())
                    },
                    SQLiteDatabase.CONFLICT_REPLACE
                )
            }
            writableDatabase.setTransactionSuccessful()
        } finally {
            writableDatabase.endTransaction()
        }
    }

    fun removeGeofences(ids: Array<String>?) = deleteRows("geofences", ids, "identifier")

    fun getGeofences(): Array<GeofenceRegion> {
        val cursor = readableDatabase.query("geofences", null, null, null, null, null, "created_at DESC")
        return cursor.use {
            val rows = mutableListOf<GeofenceRegion>()
            while (it.moveToNext()) {
                rows += GeofenceRegion(
                    it.getString(it.getColumnIndexOrThrow("identifier")),
                    it.getDouble(it.getColumnIndexOrThrow("latitude")),
                    it.getDouble(it.getColumnIndexOrThrow("longitude")),
                    it.getDouble(it.getColumnIndexOrThrow("radius")),
                    it.getInt(it.getColumnIndexOrThrow("notify_on_entry")) == 1,
                    it.getInt(it.getColumnIndexOrThrow("notify_on_exit")) == 1,
                    it.getInt(it.getColumnIndexOrThrow("notify_on_dwell")) == 1,
                    nullableDoubleColumn(it, "loitering_delay"),
                    nullableDoubleColumn(it, "expiration_duration"),
                    nullableStringColumn(it, "metadata")?.let(::jsonToMetadata)
                )
            }
            rows.toTypedArray()
        }
    }

    fun count(table: String): Double {
        val cursor = readableDatabase.rawQuery("SELECT COUNT(*) FROM $table", null)
        return cursor.use {
            if (it.moveToFirst()) it.getLong(0).toDouble() else 0.0
        }
    }

    fun markSynced(ids: List<String>) {
        if (ids.isEmpty()) return
        val placeholders = ids.joinToString(",") { "?" }
        writableDatabase.execSQL(
            "UPDATE background_locations SET synced = 1 WHERE id IN ($placeholders)",
            ids.toTypedArray()
        )
    }

    fun pruneLocations(maxRows: Int?) = pruneRows("background_locations", maxRows)
    fun pruneEvents(maxRows: Int?) = pruneRows("background_events", maxRows)

    private fun pruneRows(table: String, maxRows: Int?) {
        val limit = maxRows?.takeIf { it > 0 } ?: return
        writableDatabase.execSQL(
            """
            DELETE FROM $table
            WHERE id NOT IN (
              SELECT id FROM $table ORDER BY created_at DESC LIMIT ?
            )
            """.trimIndent(),
            arrayOf(limit.toString())
        )
    }

    private fun getLocationById(id: String): StoredBackgroundLocation? {
        val cursor = readableDatabase.query(
            "background_locations",
            null,
            "id = ?",
            arrayOf(id),
            null,
            null,
            null,
            "1"
        )
        return cursor.use {
            if (it.moveToFirst()) cursorToStoredLocation(it) else null
        }
    }

    private fun markRows(table: String, ids: Array<String>) {
        if (ids.isEmpty()) return
        val placeholders = ids.joinToString(",") { "?" }
        writableDatabase.execSQL(
            "UPDATE $table SET delivered_to_js = 1 WHERE id IN ($placeholders)",
            ids
        )
    }

    private fun deleteRows(table: String, ids: Array<String>?, idColumn: String = "id") {
        if (ids == null) {
            writableDatabase.delete(table, null, null)
            return
        }
        if (ids.isEmpty()) return
        writableDatabase.delete(table, "$idColumn IN (${ids.joinToString(",") { "?" }})", ids)
    }

    private fun StoredBackgroundLocation.toBackgroundLocation(): BackgroundLocation {
        return BackgroundLocation(
            id,
            source,
            isFromBackground,
            provider,
            mocked,
            recordedAt,
            activity,
            battery,
            coords,
            timestamp
        )
    }

    private fun cursorToStoredLocation(cursor: android.database.Cursor): StoredBackgroundLocation {
        val id = cursor.getString(cursor.getColumnIndexOrThrow("id"))
        val coords = GeolocationCoordinates(
            cursor.getDouble(cursor.getColumnIndexOrThrow("latitude")),
            cursor.getDouble(cursor.getColumnIndexOrThrow("longitude")),
            nullableDoubleVariant(cursor, "altitude"),
            cursor.getDouble(cursor.getColumnIndexOrThrow("accuracy")),
            nullableDoubleVariant(cursor, "altitude_accuracy"),
            nullableDoubleVariant(cursor, "heading"),
            nullableDoubleVariant(cursor, "speed")
        )
        return StoredBackgroundLocation(
            id,
            cursor.getInt(cursor.getColumnIndexOrThrow("delivered_to_js")) == 1,
            cursor.getInt(cursor.getColumnIndexOrThrow("synced")) == 1,
            cursor.getDouble(cursor.getColumnIndexOrThrow("created_at")),
            runCatching {
                enumValueOf<BackgroundLocationSource>(
                    cursor.getString(cursor.getColumnIndexOrThrow("source"))
                )
            }.getOrDefault(BackgroundLocationSource.UNKNOWN),
            true,
            cursor.getString(cursor.getColumnIndexOrThrow("provider"))?.let {
                runCatching { enumValueOf<LocationProviderUsed>(it) }.getOrNull()
            },
            cursor.getInt(cursor.getColumnIndexOrThrow("mocked")) == 1,
            cursor.getDouble(cursor.getColumnIndexOrThrow("recorded_at")),
            null,
            null,
            coords,
            cursor.getDouble(cursor.getColumnIndexOrThrow("timestamp"))
        )
    }

    private fun nullableDoubleColumn(cursor: android.database.Cursor, column: String): Double? {
        val index = cursor.getColumnIndexOrThrow(column)
        return if (cursor.isNull(index)) null else cursor.getDouble(index)
    }

    private fun nullableStringColumn(cursor: android.database.Cursor, column: String): String? {
        val index = cursor.getColumnIndex(column)
        return if (index < 0 || cursor.isNull(index)) null else cursor.getString(index)
    }

    private fun nullableDoubleVariant(cursor: android.database.Cursor, column: String): NullableDouble? {
        return nullableDoubleColumn(cursor, column)?.let { NullableDouble.create(it) }
    }

    private fun locationPayload(location: BackgroundLocation): String {
        return JSONObject()
            .put("id", location.id)
            .put("source", location.source.name)
            .put("isFromBackground", location.isFromBackground)
            .put("provider", location.provider?.name)
            .put("mocked", location.mocked)
            .put("recordedAt", location.recordedAt)
            .put(
                "coords",
                JSONObject()
                    .put("latitude", location.coords.latitude)
                    .put("longitude", location.coords.longitude)
                    .put("altitude", location.coords.altitude?.asSecondOrNull())
                    .put("accuracy", location.coords.accuracy)
                    .put("altitudeAccuracy", location.coords.altitudeAccuracy?.asSecondOrNull())
                    .put("heading", location.coords.heading?.asSecondOrNull())
                    .put("speed", location.coords.speed?.asSecondOrNull())
            )
            .put("timestamp", location.timestamp)
            .toString()
    }

    private fun payloadToLocation(payload: String): BackgroundLocation? {
        return runCatching {
            val json = JSONObject(payload)
            val coordsJson = json.getJSONObject("coords")
            BackgroundLocation(
                if (json.has("id") && !json.isNull("id")) json.getString("id") else null,
                runCatching {
                    enumValueOf<BackgroundLocationSource>(json.getString("source"))
                }.getOrDefault(BackgroundLocationSource.UNKNOWN),
                json.optBoolean("isFromBackground", true),
                if (json.has("provider") && !json.isNull("provider")) {
                    runCatching { enumValueOf<LocationProviderUsed>(json.getString("provider")) }.getOrNull()
                } else {
                    null
                },
                if (json.has("mocked") && !json.isNull("mocked")) json.getBoolean("mocked") else null,
                json.getDouble("recordedAt"),
                null,
                null,
                GeolocationCoordinates(
                    coordsJson.getDouble("latitude"),
                    coordsJson.getDouble("longitude"),
                    coordsJson.optDoubleOrNull("altitude")?.let { NullableDouble.create(it) },
                    coordsJson.getDouble("accuracy"),
                    coordsJson.optDoubleOrNull("altitudeAccuracy")?.let { NullableDouble.create(it) },
                    coordsJson.optDoubleOrNull("heading")?.let { NullableDouble.create(it) },
                    coordsJson.optDoubleOrNull("speed")?.let { NullableDouble.create(it) }
                ),
                json.getDouble("timestamp")
            )
        }.getOrNull()
    }

    private fun geofencePayload(event: GeofenceEvent): String {
        val region = event.region
        return JSONObject()
            .put("transition", event.transition.name)
            .put("timestamp", event.timestamp)
            .put(
                "region",
                JSONObject()
                    .put("identifier", region.identifier)
                    .put("latitude", region.latitude)
                    .put("longitude", region.longitude)
                    .put("radius", region.radius)
                    .put("notifyOnEntry", region.notifyOnEntry)
                    .put("notifyOnExit", region.notifyOnExit)
                    .put("notifyOnDwell", region.notifyOnDwell)
                    .put("loiteringDelay", region.loiteringDelay)
                    .put("expirationDuration", region.expirationDuration)
                    .put("metadata", metadataToJsonObject(region.metadata))
            )
            .toString()
    }

    private fun payloadToGeofence(payload: String): GeofenceEvent? {
        return runCatching {
            val json = JSONObject(payload)
            val regionJson = json.getJSONObject("region")
            GeofenceEvent(
                GeofenceRegion(
                    regionJson.getString("identifier"),
                    regionJson.getDouble("latitude"),
                    regionJson.getDouble("longitude"),
                    regionJson.getDouble("radius"),
                    regionJson.optBoolean("notifyOnEntry", true),
                    regionJson.optBoolean("notifyOnExit", true),
                    regionJson.optBoolean("notifyOnDwell", false),
                    regionJson.optDoubleOrNull("loiteringDelay"),
                    regionJson.optDoubleOrNull("expirationDuration"),
                    regionJson.optJSONObject("metadata")?.let(::jsonToMetadata)
                ),
                enumValueOf<GeofenceTransition>(json.getString("transition")),
                null,
                json.getDouble("timestamp")
            )
        }.getOrNull()
    }

    private fun activityPayload(activity: DetectedActivity): String {
        return JSONObject()
            .put("type", activity.type.name)
            .put("confidence", activity.confidence)
            .put("timestamp", activity.timestamp)
            .toString()
    }

    private fun payloadToActivity(payload: String): DetectedActivity? {
        return runCatching {
            val json = JSONObject(payload)
            DetectedActivity(
                enumValueOf<DetectedActivityType>(json.getString("type")),
                json.getDouble("confidence"),
                json.getDouble("timestamp")
            )
        }.getOrNull()
    }

    private fun httpSyncPayload(result: BackgroundHttpSyncResult): String {
        return JSONObject()
            .put("success", result.success)
            .put("statusCode", result.statusCode)
            .put("syncedLocationIds", JSONArray(result.syncedLocationIds.toList()))
            .put("failedLocationIds", JSONArray(result.failedLocationIds.toList()))
            .put("error", result.error)
            .toString()
    }

    private fun payloadToHttpSync(payload: String): BackgroundHttpSyncResult? {
        return runCatching {
            val json = JSONObject(payload)
            BackgroundHttpSyncResult(
                json.getBoolean("success"),
                json.optDoubleOrNull("statusCode"),
                json.optJSONArray("syncedLocationIds").toStringArray(),
                json.optJSONArray("failedLocationIds").toStringArray(),
                if (json.has("error") && !json.isNull("error")) json.getString("error") else null
            )
        }.getOrNull()
    }

    private fun JSONArray?.toStringArray(): Array<String> {
        if (this == null) return emptyArray()
        return Array(length()) { index -> getString(index) }
    }

    private fun JSONObject.optDoubleOrNull(key: String): Double? {
        return if (has(key) && !isNull(key)) optDouble(key) else null
    }

    private fun metadataToJson(metadata: Map<String, Variant_NullType_Boolean_String_Double>?): String? {
        return metadata?.let(::metadataToJsonObject)?.toString()
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

    private fun jsonToMetadata(json: JSONObject): Map<String, Variant_NullType_Boolean_String_Double> {
        val metadata = mutableMapOf<String, Variant_NullType_Boolean_String_Double>()
        val keys = json.keys()
        while (keys.hasNext()) {
            val key = keys.next()
            metadata[key] = when (val value = json.get(key)) {
                JSONObject.NULL -> Variant_NullType_Boolean_String_Double.create(NullType.NULL)
                is Boolean -> Variant_NullType_Boolean_String_Double.create(value)
                is String -> Variant_NullType_Boolean_String_Double.create(value)
                is Number -> Variant_NullType_Boolean_String_Double.create(value.toDouble())
                is JSONArray -> Variant_NullType_Boolean_String_Double.create(value.toString())
                is JSONObject -> Variant_NullType_Boolean_String_Double.create(value.toString())
                else -> Variant_NullType_Boolean_String_Double.create(value.toString())
            }
        }
        return metadata
    }

    private fun jsonToMetadata(payload: String): Map<String, Variant_NullType_Boolean_String_Double> {
        return jsonToMetadata(JSONObject(payload))
    }
}
