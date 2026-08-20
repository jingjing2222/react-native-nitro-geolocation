package com.margelo.nitro.nitrogeolocation.background

import android.app.job.JobScheduler
import androidx.test.core.app.ApplicationProvider
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class NitroBootRestoreJobServiceTest {
    @Test
    fun bootRestoreIsDelegatedToTheJobScheduler() {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        val scheduler = context.getSystemService(JobScheduler::class.java)

        assertTrue(NitroBootRestoreJobService.schedule(context))

        val job = scheduler.allPendingJobs.single()
        assertEquals(
            NitroBootRestoreJobService::class.java.name,
            job.service.className
        )
    }

    @Test
    fun stoppingBootWorkInterruptsTheRestoreItOwns() {
        val started = CountDownLatch(1)
        val interrupted = CountDownLatch(1)
        val completed = AtomicBoolean(false)
        val work = NitroBootRestoreWork()
        work.start(
            restore = {
                started.countDown()
                try {
                    CountDownLatch(1).await()
                } catch (error: InterruptedException) {
                    interrupted.countDown()
                    throw error
                }
            },
            complete = { completed.set(true) }
        )

        assertTrue(started.await(1, TimeUnit.SECONDS))
        work.cancel()

        assertTrue(interrupted.await(1, TimeUnit.SECONDS))
        assertFalse(completed.get())
        work.shutdown()
    }
}
