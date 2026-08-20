package com.margelo.nitro.nitrogeolocation.background

import java.util.Collections
import java.util.concurrent.CompletableFuture
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class NitroBackgroundSyncQueueTest {
    @Test
    fun manualSyncsShareTheAutomaticSyncSerialBoundary() {
        val queue = NitroBackgroundSyncQueue()
        val firstStarted = CountDownLatch(1)
        val releaseFirst = CountDownLatch(1)
        val automaticFinished = CountDownLatch(1)
        val secondStarted = CountDownLatch(1)
        val order = Collections.synchronizedList(mutableListOf<String>())

        val first = CompletableFuture.supplyAsync {
            queue.runManual {
                order += "first-start"
                firstStarted.countDown()
                assertTrue(releaseFirst.await(5, TimeUnit.SECONDS))
                order += "first-end"
                "first"
            }
        }
        assertTrue(firstStarted.await(5, TimeUnit.SECONDS))

        queue.scheduleAutomatic(
            reserve = { "automatic" },
            perform = {
                order += it
                automaticFinished.countDown()
                false
            }
        )
        val second = CompletableFuture.supplyAsync {
            queue.runManual {
                secondStarted.countDown()
                order += "second"
                "second"
            }
        }

        assertFalse(secondStarted.await(100, TimeUnit.MILLISECONDS))
        releaseFirst.countDown()

        assertEquals("first", first.get(5, TimeUnit.SECONDS))
        assertTrue(automaticFinished.await(5, TimeUnit.SECONDS))
        assertEquals("second", second.get(5, TimeUnit.SECONDS))
        assertEquals(
            listOf("first-start", "first-end", "automatic", "second"),
            order
        )
        queue.close()
    }

    @Test
    fun automaticSyncRechecksAdmissionWhenItsTurnBegins() {
        val queue = NitroBackgroundSyncQueue()
        val blockerStarted = CountDownLatch(1)
        val releaseBlocker = CountDownLatch(1)
        val automaticFinished = CountDownLatch(1)
        val thresholdMet = AtomicBoolean(true)
        val uploaded = AtomicBoolean(false)

        val blocker = CompletableFuture.runAsync {
            queue.runManual {
                blockerStarted.countDown()
                assertTrue(releaseBlocker.await(5, TimeUnit.SECONDS))
            }
        }
        assertTrue(blockerStarted.await(5, TimeUnit.SECONDS))

        queue.scheduleAutomatic(
            reserve = { if (thresholdMet.get()) "batch" else null },
            perform = {
                uploaded.set(true)
                automaticFinished.countDown()
                false
            },
            onSkipped = automaticFinished::countDown
        )
        thresholdMet.set(false)
        releaseBlocker.countDown()

        blocker.get(5, TimeUnit.SECONDS)
        assertTrue(automaticFinished.await(5, TimeUnit.SECONDS))
        assertFalse(uploaded.get())
        queue.close()
    }

    @Test
    fun automaticFailureIsReportedAndDoesNotPoisonLaterSyncs() {
        val queue = NitroBackgroundSyncQueue()
        val failed = CountDownLatch(1)

        queue.scheduleAutomatic(
            reserve = { throw IllegalStateException("storage unavailable") },
            perform = { _: String -> error("perform must not run") },
            onFailure = { error ->
                assertEquals("storage unavailable", error.message)
                failed.countDown()
            }
        )

        assertTrue(failed.await(5, TimeUnit.SECONDS))
        assertEquals("next", queue.runManual { "next" })
        queue.close()
    }

    @Test
    fun automaticBurstKeepsOnlyOneFollowUpWhileAnUploadIsRunning() {
        val queue = NitroBackgroundSyncQueue()
        val firstStarted = CountDownLatch(1)
        val releaseFirst = CountDownLatch(1)
        val followUpFinished = CountDownLatch(1)
        val uploads = AtomicInteger(0)

        fun schedule() {
            queue.scheduleAutomatic(
                reserve = { "batch" },
                perform = {
                    if (uploads.incrementAndGet() == 1) {
                        firstStarted.countDown()
                        assertTrue(releaseFirst.await(5, TimeUnit.SECONDS))
                    } else {
                        followUpFinished.countDown()
                    }
                    false
                }
            )
        }

        schedule()
        assertTrue(firstStarted.await(5, TimeUnit.SECONDS))
        repeat(20) { schedule() }
        releaseFirst.countDown()

        assertTrue(followUpFinished.await(5, TimeUnit.SECONDS))
        queue.runManual { }
        assertEquals(2, uploads.get())
        queue.close()
    }

    @Test
    fun staleAutomaticWorkCannotReplaceANewerRun() {
        val queue = NitroBackgroundSyncQueue()
        val firstStarted = CountDownLatch(1)
        val releaseFirst = CountDownLatch(1)
        val newerFinished = CountDownLatch(1)
        val staleRan = AtomicBoolean(false)

        queue.scheduleAutomatic(
            key = NitroBackgroundSyncKey(1, 1, 1),
            reserve = { "first" },
            perform = {
                firstStarted.countDown()
                assertTrue(releaseFirst.await(5, TimeUnit.SECONDS))
                false
            }
        )
        assertTrue(firstStarted.await(5, TimeUnit.SECONDS))

        queue.scheduleAutomatic(
            key = NitroBackgroundSyncKey(2, 1, 2),
            reserve = { "newer" },
            perform = {
                newerFinished.countDown()
                false
            }
        )
        queue.scheduleAutomatic(
            key = NitroBackgroundSyncKey(1, 2, 1),
            reserve = { "stale" },
            perform = {
                staleRan.set(true)
                false
            }
        )
        releaseFirst.countDown()

        assertTrue(newerFinished.await(5, TimeUnit.SECONDS))
        queue.runManual { }
        assertFalse(staleRan.get())
        queue.close()
    }

    @Test
    fun staleConfigWorkCannotReplaceANewerConfigInTheSameRun() {
        val queue = NitroBackgroundSyncQueue()
        val blockerStarted = CountDownLatch(1)
        val releaseBlocker = CountDownLatch(1)
        val newerFinished = CountDownLatch(1)
        val staleRan = AtomicBoolean(false)

        val blocker = CompletableFuture.runAsync {
            queue.runManual {
                blockerStarted.countDown()
                assertTrue(releaseBlocker.await(5, TimeUnit.SECONDS))
            }
        }
        assertTrue(blockerStarted.await(5, TimeUnit.SECONDS))

        queue.scheduleAutomatic(
            key = NitroBackgroundSyncKey(1, 1, 1, 2),
            reserve = { "newer-config" },
            perform = {
                newerFinished.countDown()
                false
            }
        )
        queue.scheduleAutomatic(
            key = NitroBackgroundSyncKey(1, 1, 1, 1),
            reserve = { "stale-config" },
            perform = {
                staleRan.set(true)
                false
            }
        )
        releaseBlocker.countDown()

        blocker.get(5, TimeUnit.SECONDS)
        assertTrue(newerFinished.await(5, TimeUnit.SECONDS))
        queue.runManual { }
        assertFalse(staleRan.get())
        queue.close()
    }

    @Test
    fun continuationUsesTheRevisionOfTheBatchThatActuallyRan() {
        val queue = NitroBackgroundSyncQueue()
        val firstStarted = CountDownLatch(1)
        val releaseFirst = CountDownLatch(1)
        val continuationFinished = CountDownLatch(1)
        val runs = AtomicInteger(0)
        val ordinaryRevisionTwoRan = AtomicBoolean(false)

        queue.scheduleAutomatic(
            key = NitroBackgroundSyncKey(1, 1, 1, 1),
            reserve = { "revision-two-batch" },
            perform = {
                if (runs.incrementAndGet() == 1) {
                    firstStarted.countDown()
                    assertTrue(releaseFirst.await(5, TimeUnit.SECONDS))
                    true
                } else {
                    continuationFinished.countDown()
                    false
                }
            },
            continuationKey = { NitroBackgroundSyncKey(1, 1, 1, 2) }
        )
        assertTrue(firstStarted.await(5, TimeUnit.SECONDS))

        queue.scheduleAutomatic(
            key = NitroBackgroundSyncKey(1, 1, 1, 2),
            reserve = { "ordinary-revision-two" },
            perform = {
                ordinaryRevisionTwoRan.set(true)
                false
            }
        )
        releaseFirst.countDown()

        assertTrue(continuationFinished.await(5, TimeUnit.SECONDS))
        queue.runManual { }
        assertEquals(2, runs.get())
        assertFalse(ordinaryRevisionTwoRan.get())
        queue.close()
    }

    @Test
    fun successfulAutomaticWorkContinuesUntilTheBacklogIsBelowThreshold() {
        val queue = NitroBackgroundSyncQueue()
        val remaining = AtomicInteger(4)
        val uploads = AtomicInteger(0)
        val drained = CountDownLatch(1)

        queue.scheduleAutomatic(
            key = NitroBackgroundSyncKey(1, 1, 1),
            reserve = { remaining.get().takeIf { it > 0 } },
            perform = {
                uploads.incrementAndGet()
                if (remaining.decrementAndGet() == 0) {
                    drained.countDown()
                }
                remaining.get() > 0
            }
        )

        assertTrue(drained.await(5, TimeUnit.SECONDS))
        queue.runManual { }
        assertEquals(4, uploads.get())
        queue.close()
    }
}
