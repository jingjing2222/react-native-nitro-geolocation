import Foundation

@propertyWrapper
final class ActiveWatchRegistry<Value> {
    private let lock = NSLock()
    private let kind: ActiveWatchKind
    private var subscriptions: [String: Value]

    init(wrappedValue: [String: Value], kind: ActiveWatchKind) {
        subscriptions = wrappedValue
        self.kind = kind
    }

    var wrappedValue: [String: Value] {
        get { withLock { subscriptions } }
        set { withLock { subscriptions = newValue } }
        _modify {
            lock.lock()
            defer { lock.unlock() }
            yield &subscriptions
        }
    }

    var projectedValue: ActiveWatchRegistry<Value> {
        return self
    }

    func snapshot() -> [ActiveWatch] {
        return withLock {
            subscriptions.keys.map { ActiveWatch(token: $0, kind: kind) }
        }
    }

    func updateIfPresent(token: String, value: Value) -> Bool {
        return withLock {
            guard subscriptions[token] != nil else { return false }
            subscriptions[token] = value
            return true
        }
    }

    func drain() -> [String: Value] {
        return withLock {
            let drained = subscriptions
            subscriptions.removeAll()
            return drained
        }
    }

    private func withLock<Result>(_ work: () -> Result) -> Result {
        lock.lock()
        defer { lock.unlock() }
        return work()
    }
}
