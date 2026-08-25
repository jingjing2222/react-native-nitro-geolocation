package com.margelo.nitro.nitrogeolocation

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread

class AndroidWatchRuntimeTest {
    @Test
    fun `concurrent last removal and new watch leave acquisition running`() {
        val executor = Executors.newSingleThreadExecutor()
        val dispatchThread = AtomicReference<Thread>()
        val dispatcher = AndroidWatchSerialDispatcher(
            isDispatchThread = { Thread.currentThread() === dispatchThread.get() },
            post = { action ->
                executor.execute {
                    dispatchThread.compareAndSet(null, Thread.currentThread())
                    action()
                }
            }
        )

        try {
            repeat(100) { iteration ->
                val watches = AndroidWatchCollection<String>()
                var acquisitionRunning = false
                fun apply(transition: AndroidWatchTransition) {
                    acquisitionRunning = when (transition) {
                        AndroidWatchTransition.NONE -> acquisitionRunning
                        AndroidWatchTransition.START,
                        AndroidWatchTransition.RESTART -> true
                        AndroidWatchTransition.STOP -> false
                    }
                }

                dispatcher.sync { apply(watches.add("old-$iteration", "old")) }
                val start = CountDownLatch(1)
                val remove = thread {
                    start.await()
                    dispatcher.sync { apply(watches.remove("old-$iteration")) }
                }
                val add = thread {
                    start.await()
                    dispatcher.sync { apply(watches.add("new-$iteration", "new")) }
                }
                start.countDown()
                remove.join()
                add.join()

                dispatcher.sync {
                    assertEquals(listOf("new-$iteration"), watches.tokens())
                    assertTrue(acquisitionRunning)
                }
            }
        } finally {
            executor.shutdownNow()
            assertTrue(executor.awaitTermination(1, TimeUnit.SECONDS))
        }
    }
}
