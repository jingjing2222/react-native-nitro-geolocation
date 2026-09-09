import CoreLocation
import Foundation

// Stand-in for the generated Nitro enum; the state and accuracy helpers are production code.
enum AccuracyAuthorization {
    case full
    case reduced
    case unknown
}

private final class TestLocationManager: CLLocationManager {
    var reportedAccuracy: CLAccuracyAuthorization = .fullAccuracy

    override var accuracyAuthorization: CLAccuracyAuthorization {
        dispatchPrecondition(condition: .onQueue(.main))
        return reportedAccuracy
    }
}

private final class LocationState {
    var manager: CLLocationManager?
    var reads = 0
    var values: [Int: Int] = [:]
    var resolved = 0
    var completed = false

    var locationManager: CLLocationManager? {
        // This fails if the caller evaluates the property before dispatching to main.
        dispatchPrecondition(condition: .onQueue(.main))
        reads += 1
        return manager
    }
}

@main
struct IOSLocationStateContract {
    static func main() {
        let state = LocationState()
        let fullManager = TestLocationManager()
        let reducedManager = TestLocationManager()
        reducedManager.reportedAccuracy = .reducedAccuracy
        state.manager = fullManager

        let initial = withLocationStateOnMain {
            currentAccuracyAuthorizationOnMain(from: state.locationManager)
        }
        precondition(initial == .full, "Main-thread reentry must execute inline")
        state.manager = reducedManager
        precondition(currentAccuracyAuthorizationOnMain(from: state.locationManager) == .reduced)
        precondition(state.reads == 2, "Each lookup must evaluate the property exactly once")

        let permissions = IOSPermissionRequestQueue()
        let iterations = 2_000
        DispatchQueue.global().async {
            DispatchQueue.concurrentPerform(iterations: iterations) { index in
                withLocationStateOnMain {
                    state.manager = index.isMultiple(of: 2) ? fullManager : reducedManager
                    state.values[index] = index
                    permissions.append { status in
                        precondition(status == .authorizedAlways)
                        precondition(state.values[index] == index)
                        // Permission callbacks can synchronously reenter the public accuracy path.
                        let accuracy = currentAccuracyAuthorizationOnMain(from: state.locationManager)
                        precondition(accuracy == .full || accuracy == .reduced)
                        state.resolved += 1
                    }
                    permissions.resolve(.notDetermined)
                    precondition(state.resolved == 0, "Initial authorization must keep requests pending")
                }
                // Exercise the actual helper from a worker, including evaluation of the property.
                let accuracy = currentAccuracyAuthorizationOnMain(from: state.locationManager)
                precondition(accuracy == .full || accuracy == .reduced)
            }
            withLocationStateOnMain {
                precondition(state.reads == iterations + 2)
                precondition(state.values.count == iterations)
                permissions.resolve(.authorizedAlways)
                permissions.resolve(.authorizedAlways)
                precondition(state.resolved == iterations, "Each permission request resolves once")
                precondition(state.reads == 2 * iterations + 2)
                state.completed = true
            }
        }
        let deadline = Date().addingTimeInterval(30)
        while !state.completed && Date() < deadline {
            RunLoop.main.run(until: Date().addingTimeInterval(0.01))
        }
        precondition(state.completed, "Worker accuracy calls must complete without deadlocking main")
        print("iOS accuracy property read and concurrent state/permission contract passed")
    }
}
