package com.margelo.nitro.nitrogeolocation.background

import com.margelo.nitro.nitrogeolocation.BackgroundHttpSyncOptions
import com.margelo.nitro.nitrogeolocation.BackgroundHttpSyncResult
import com.margelo.nitro.nitrogeolocation.StoredBackgroundLocation
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import kotlin.random.Random

internal class AndroidBackgroundHttpSync {
    fun uploadLocationsWithRetry(
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
                Thread.sleep(backoffDelayMs(attempt))
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

    private fun uploadLocations(
        sync: BackgroundHttpSyncOptions,
        locations: Array<StoredBackgroundLocation>
    ): Int {
        val connection = createConnection(sync)
        return try {
            OutputStreamWriter(connection.outputStream).use { writer ->
                writer.write(sync.batchBody(locations).toString())
            }
            val code = connection.responseCode
            drainResponse(connection, code)
            code
        } finally {
            connection.disconnect()
        }
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
                    Thread.sleep(backoffDelayMs(attempt))
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
        val connection = createConnection(sync)
        return try {
            OutputStreamWriter(connection.outputStream).use { writer ->
                writer.write(sync.singleBody(location).toString())
            }
            val code = connection.responseCode
            drainResponse(connection, code)
            code
        } finally {
            connection.disconnect()
        }
    }

    private fun createConnection(sync: BackgroundHttpSyncOptions): HttpURLConnection {
        return (URL(sync.url).openConnection() as HttpURLConnection).apply {
            requestMethod = sync.method?.name ?: "POST"
            connectTimeout = 15_000
            readTimeout = 15_000
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
            sync.headers?.forEach { (key, value) -> setRequestProperty(key, value) }
        }
    }

    // Drain (up to a cap) then disconnect so the socket is returned to the pool; an undrained
    // HttpURLConnection blocks connection reuse and leaks sockets over a long trip.
    private fun drainResponse(connection: HttpURLConnection, code: Int) {
        runCatching {
            val stream = if (code in 200..299) connection.inputStream else connection.errorStream
            stream?.use { input ->
                val buffer = ByteArray(4_096)
                var total = 0
                while (total < MAX_DRAIN_BYTES) {
                    val read = input.read(buffer)
                    if (read < 0) break
                    total += read
                }
            }
        }
    }

    // Exponential backoff with full jitter so many devices retrying a failed sync don't hammer the
    // server in lockstep (thundering herd).
    private fun backoffDelayMs(attempt: Int): Long {
        val capped = (BASE_BACKOFF_MS shl attempt).coerceIn(BASE_BACKOFF_MS, MAX_BACKOFF_MS)
        return capped + Random.nextLong(BASE_BACKOFF_MS)
    }

    private companion object {
        const val BASE_BACKOFF_MS = 1_000L
        const val MAX_BACKOFF_MS = 30_000L
        const val MAX_DRAIN_BYTES = 64 * 1024
    }
}
