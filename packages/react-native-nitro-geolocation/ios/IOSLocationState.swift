import Foundation

/// Evaluate both the state read and its consumers on Core Location's queue.
/// Passing an already-read property into a dispatch helper still races writers.
internal func withLocationStateOnMain<T>(_ operation: () -> T) -> T {
    if Thread.isMainThread { return operation() }
    return DispatchQueue.main.sync(execute: operation)
}
