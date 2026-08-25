package com.margelo.nitro.nitrogeolocation

import android.os.Handler
import android.os.Looper
import java.util.concurrent.FutureTask

internal enum class AndroidWatchTransition {
    NONE,
    START,
    RESTART,
    STOP
}

internal class AndroidWatchCollection<T> {
    private val entries = linkedMapOf<String, T>()

    fun add(token: String, value: T): AndroidWatchTransition {
        val wasEmpty = entries.isEmpty()
        entries[token] = value
        return if (wasEmpty) AndroidWatchTransition.START else AndroidWatchTransition.RESTART
    }

    fun remove(token: String): AndroidWatchTransition {
        if (entries.remove(token) == null) return AndroidWatchTransition.NONE
        return transitionAfterRemoval()
    }

    fun removeCurrent(token: String, value: T): Boolean {
        if (entries[token] !== value) return false
        entries.remove(token)
        return true
    }

    fun clear(): AndroidWatchTransition {
        if (entries.isEmpty()) return AndroidWatchTransition.NONE
        entries.clear()
        return AndroidWatchTransition.STOP
    }

    fun transitionAfterRemoval(): AndroidWatchTransition =
        if (entries.isEmpty()) AndroidWatchTransition.STOP else AndroidWatchTransition.RESTART

    fun isEmpty(): Boolean = entries.isEmpty()

    fun values(): List<T> = entries.values.toList()

    fun tokens(): List<String> = entries.keys.toList()

    fun forEachCurrent(deliver: (String, T) -> Unit) {
        val snapshot = entries.toList()
        for ((token, value) in snapshot) {
            if (entries[token] === value) deliver(token, value)
        }
    }
}

internal class AndroidWatchSerialDispatcher(
    private val isDispatchThread: () -> Boolean,
    private val post: ((() -> Unit) -> Unit)
) {
    fun <T> sync(action: () -> T): T {
        if (isDispatchThread()) return action()
        val task = FutureTask(action)
        post { task.run() }
        return task.get()
    }
}

internal fun createAndroidMainWatchDispatcher(): AndroidWatchSerialDispatcher {
    val handler = Handler(Looper.getMainLooper())
    return AndroidWatchSerialDispatcher(
        isDispatchThread = { Looper.myLooper() == Looper.getMainLooper() },
        post = { action -> handler.post(action) }
    )
}
