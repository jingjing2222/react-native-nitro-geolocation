package com.margelo.nitro.nitrogeolocation.background

import android.util.Log
import com.margelo.nitro.nitrogeolocation.BuildConfig

/**
 * Lightweight tagged logger for the background location pipeline.
 *
 * The background delivery path runs across a foreground service, a broadcast receiver and a
 * headless task, where a misconfiguration can silently stop location delivery with no error.
 * This logger makes that path observable from logcat.
 *
 * Verbose [d] logs are gated behind [verbose] (defaults to debug builds) so release builds stay
 * quiet, while [w] and [e] always emit because they mark real delivery or registration failures.
 */
internal object NitroGeoLog {
    private const val TAG = "NitroGeolocation"

    @Volatile
    var verbose: Boolean = BuildConfig.DEBUG

    fun d(message: String) {
        if (verbose) Log.d(TAG, message)
    }

    fun w(message: String, error: Throwable? = null) {
        Log.w(TAG, message, error)
    }

    fun e(message: String, error: Throwable? = null) {
        Log.e(TAG, message, error)
    }
}
