package com.margelo.nitro.nitrogeolocation.background

import android.app.job.JobInfo
import android.app.job.JobParameters
import android.app.job.JobScheduler
import android.app.job.JobService
import android.content.ComponentName
import android.content.Context
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.Future

internal class NitroBootRestoreWork(
    private val executor: ExecutorService = Executors.newSingleThreadExecutor()
) {
    @Volatile
    private var future: Future<*>? = null

    fun start(restore: () -> Unit, complete: (failed: Boolean) -> Unit) {
        future?.cancel(true)
        future = executor.submit {
            val failure = runCatching(restore).exceptionOrNull()
            if (failure is InterruptedException || Thread.currentThread().isInterrupted) return@submit
            complete(failure != null)
        }
    }

    fun cancel() {
        future?.cancel(true)
        future = null
    }

    fun shutdown() {
        cancel()
        executor.shutdownNow()
    }
}

/** Runs boot restoration under an OS-owned lifetime instead of a broadcast deadline. */
class NitroBootRestoreJobService : JobService() {
    private val work = NitroBootRestoreWork()

    @Volatile
    private var activeParameters: JobParameters? = null

    override fun onStartJob(params: JobParameters): Boolean {
        activeParameters = params
        work.start(
            restore = {
                NitroBackgroundLocationController.getInstance(applicationContext)
                    .registerPersistedGeofencesBlockingIfNeeded()
            },
            complete = { restoreFailed ->
                if (activeParameters === params) {
                    activeParameters = null
                    jobFinished(params, restoreFailed)
                }
            }
        )
        return true
    }

    override fun onStopJob(params: JobParameters): Boolean {
        if (activeParameters === params) {
            activeParameters = null
            work.cancel()
        }
        return true
    }

    override fun onDestroy() {
        work.shutdown()
        super.onDestroy()
    }

    companion object {
        private const val JOB_ID = 0x4E47424F

        fun schedule(context: Context): Boolean {
            val scheduler = context.getSystemService(JobScheduler::class.java)
            val job = JobInfo.Builder(
                JOB_ID,
                ComponentName(context, NitroBootRestoreJobService::class.java)
            )
                .setBackoffCriteria(30_000L, JobInfo.BACKOFF_POLICY_EXPONENTIAL)
                .build()
            return scheduler.schedule(job) == JobScheduler.RESULT_SUCCESS
        }
    }
}
