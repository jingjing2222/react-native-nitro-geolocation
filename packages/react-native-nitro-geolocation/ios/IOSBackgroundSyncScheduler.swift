import Foundation

struct IOSBackgroundSyncKey: Comparable {
    let runGeneration: UInt64
    let locationSessionGeneration: UInt64
    let configRevision: UInt64

    static func < (lhs: IOSBackgroundSyncKey, rhs: IOSBackgroundSyncKey) -> Bool {
        if lhs.runGeneration != rhs.runGeneration {
            return lhs.runGeneration < rhs.runGeneration
        }
        if lhs.locationSessionGeneration != rhs.locationSessionGeneration {
            return lhs.locationSessionGeneration < rhs.locationSessionGeneration
        }
        return lhs.configRevision < rhs.configRevision
    }
}

/// Coalesces automatic sync bursts to one running and one latest pending operation.
final class IOSBackgroundSyncScheduler {
    private final class AutomaticWork {
        let key: IOSBackgroundSyncKey
        let runOnce: () -> IOSBackgroundSyncKey?

        init(key: IOSBackgroundSyncKey, runOnce: @escaping () -> IOSBackgroundSyncKey?) {
            self.key = key
            self.runOnce = runOnce
        }
    }

    private let queue = DispatchQueue(label: "nitro.background.sync")
    private let lock = NSLock()
    private var pendingAutomatic: AutomaticWork?
    private var automaticDrainScheduled = false

    func scheduleAutomatic(
        key: IOSBackgroundSyncKey,
        _ runOnce: @escaping () -> IOSBackgroundSyncKey?
    ) {
        lock.lock()
        let work = AutomaticWork(key: key, runOnce: runOnce)
        if pendingAutomatic == nil || pendingAutomatic!.key < key {
            pendingAutomatic = work
        }
        let shouldSchedule = !automaticDrainScheduled
        if shouldSchedule {
            automaticDrainScheduled = true
        }
        lock.unlock()

        if shouldSchedule {
            queue.async { self.drainOneAutomatic() }
        }
    }

    func sync<T>(_ work: () -> T) -> T {
        queue.sync(execute: work)
    }

    private func drainOneAutomatic() {
        lock.lock()
        let work = pendingAutomatic
        pendingAutomatic = nil
        lock.unlock()

        let continuationKey = work?.runOnce()

        lock.lock()
        if let continuationKey, let work,
            pendingAutomatic == nil || pendingAutomatic!.key <= continuationKey
        {
            // A continuation wins over work from the same run, while a newer run wins over both.
            pendingAutomatic = AutomaticWork(
                key: continuationKey,
                runOnce: work.runOnce
            )
        }
        automaticDrainScheduled = false
        let shouldSchedule = pendingAutomatic != nil
        if shouldSchedule {
            automaticDrainScheduled = true
        }
        lock.unlock()

        if shouldSchedule {
            queue.async { self.drainOneAutomatic() }
        }
    }
}
