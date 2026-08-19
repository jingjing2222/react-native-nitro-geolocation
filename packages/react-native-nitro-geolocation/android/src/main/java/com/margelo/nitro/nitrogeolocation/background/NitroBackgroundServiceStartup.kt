package com.margelo.nitro.nitrogeolocation.background

import java.util.concurrent.CompletableFuture
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit

internal class NitroBackgroundServiceStartup {
    private data class Attempt(
        val completion: CompletableFuture<Throwable?> = CompletableFuture(),
        val activityRequired: Boolean,
        @Volatile var foregroundPromoted: Boolean = false,
        @Volatile var locationProviderRegistered: Boolean = false,
        @Volatile var activityProviderRegistered: Boolean = false
    )

    private val attempts = ConcurrentHashMap<Long, Attempt>()

    fun begin(serviceGeneration: Long, activityRequired: Boolean = false) {
        check(beginIfAbsent(serviceGeneration, activityRequired)) {
            "Service generation $serviceGeneration is already starting"
        }
    }

    fun beginIfAbsent(serviceGeneration: Long, activityRequired: Boolean = false): Boolean =
        attempts.putIfAbsent(
            serviceGeneration,
            Attempt(activityRequired = activityRequired)
        ) == null

    fun foregroundPromoted(serviceGeneration: Long) {
        attempts[serviceGeneration]?.let { attempt ->
            attempt.foregroundPromoted = true
            completeIfReady(attempt)
        }
    }

    fun providerRegistered(serviceGeneration: Long): Boolean {
        val attempt = attempts[serviceGeneration] ?: return false
        check(attempt.foregroundPromoted) {
            "Service generation $serviceGeneration registered before foreground promotion"
        }
        attempt.locationProviderRegistered = true
        return completeIfReady(attempt)
    }

    fun activityProviderRegistered(serviceGeneration: Long): Boolean {
        val attempt = attempts[serviceGeneration] ?: return false
        check(attempt.foregroundPromoted) {
            "Service generation $serviceGeneration registered activity before foreground promotion"
        }
        attempt.activityProviderRegistered = true
        return completeIfReady(attempt)
    }

    fun fail(serviceGeneration: Long, failure: Throwable) {
        attempts[serviceGeneration]?.completion?.complete(failure)
    }

    fun stopped(serviceGeneration: Long) {
        fail(
            serviceGeneration,
            IllegalStateException("Foreground service stopped before provider registration")
        )
    }

    fun isComplete(serviceGeneration: Long): Boolean {
        return attempts[serviceGeneration]?.completion?.isDone == true
    }

    fun await(serviceGeneration: Long, timeoutMs: Long): Throwable? {
        val attempt = checkNotNull(attempts[serviceGeneration]) {
            "Service generation $serviceGeneration was not prepared"
        }
        return try {
            attempt.completion.get(timeoutMs, TimeUnit.MILLISECONDS)
        } finally {
            attempts.remove(serviceGeneration, attempt)
        }
    }

    fun discard(serviceGeneration: Long) {
        attempts.remove(serviceGeneration)
    }

    private fun completeIfReady(attempt: Attempt): Boolean {
        if (attempt.foregroundPromoted &&
            attempt.locationProviderRegistered &&
            (!attempt.activityRequired || attempt.activityProviderRegistered)) {
            return attempt.completion.complete(null)
        }
        return false
    }
}
