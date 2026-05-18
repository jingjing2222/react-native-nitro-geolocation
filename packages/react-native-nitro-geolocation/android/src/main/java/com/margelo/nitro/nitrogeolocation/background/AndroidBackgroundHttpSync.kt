package com.margelo.nitro.nitrogeolocation.background

import com.margelo.nitro.nitrogeolocation.BackgroundHttpSyncOptions
import com.margelo.nitro.nitrogeolocation.BackgroundHttpSyncResult
import com.margelo.nitro.nitrogeolocation.StoredBackgroundLocation
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

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

    private fun uploadLocations(
        sync: BackgroundHttpSyncOptions,
        locations: Array<StoredBackgroundLocation>
    ): Int {
        val connection = createConnection(sync)
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
        val connection = createConnection(sync)
        OutputStreamWriter(connection.outputStream).use { writer ->
            writer.write(sync.singleBody(location).toString())
        }
        return connection.responseCode
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
}
