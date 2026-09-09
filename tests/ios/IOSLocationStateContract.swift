import CoreLocation
import Foundation

@main
struct IOSLocationStateContract {
    static func main() {
        // Main-thread callers, including callbacks that synchronously re-enter,
        // must execute inline rather than deadlock on main.sync.
        let nested = withLocationStateOnMain { withLocationStateOnMain { 42 } }
        precondition(nested == 42)

        let permissions = IOSPermissionRequestQueue()
        var state: [Int: Int] = [:]
        var resolved = 0
        var completed = false
        DispatchQueue.global().async {
            DispatchQueue.concurrentPerform(iterations: 2_000) { index in
                withLocationStateOnMain {
                    dispatchPrecondition(condition: .onQueue(.main))
                    state[index] = index
                    permissions.append { _ in resolved += 1 }
                    permissions.resolve(.notDetermined)
                    precondition(state[index] == index)
                }
            }
            withLocationStateOnMain {
                permissions.resolve(.authorizedAlways)
                precondition(resolved == 2_000)
                precondition(state.count == 2_000)
                permissions.resolve(.authorizedAlways)
                precondition(resolved == 2_000)
                completed = true
            }
        }
        let deadline = Date().addingTimeInterval(30)
        while !completed && Date() < deadline {
            RunLoop.main.run(until: Date().addingTimeInterval(0.01))
        }
        precondition(completed, "Background callers must complete without blocking the run loop")
        print("iOS main-thread state and first-authorization stress contract passed")
    }
}
