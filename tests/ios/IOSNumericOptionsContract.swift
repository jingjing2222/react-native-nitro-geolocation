import Foundation

@main
struct IOSNumericOptionsContract {
    static func main() {
        for invalid in [Double.nan, Double.infinity, -Double.infinity, -1] {
            precondition(validateIOSLocationNumbers(timeout: invalid, maximumAge: 0, distanceFilter: 0) != nil)
            precondition(validateIOSLocationNumbers(timeout: 0, maximumAge: 0, distanceFilter: invalid) != nil)
        }
        precondition(validateIOSLocationNumbers(timeout: 0, maximumAge: .infinity, distanceFilter: 0) == nil)
        precondition(validateIOSLocationNumbers(timeout: 0, maximumAge: .nan, distanceFilter: 0) != nil)
        precondition(iosHttpSyncAttemptCount(retry: true, maxRetries: nil) == 4)
        precondition(iosHttpSyncAttemptCount(retry: true, maxRetries: 0) == 1)
        for invalid in [Double.nan, Double.infinity, -1, 0.5, Double(Int32.max), Double.greatestFiniteMagnitude] {
            precondition(iosHttpSyncAttemptCount(retry: true, maxRetries: invalid) == nil)
        }
        precondition(iosStorageLimit(0, defaultValue: 10_000) == nil)
        precondition(iosStorageLimit(.nan, defaultValue: 10_000) == 10_000)
        precondition(iosStorageLimit(.infinity, defaultValue: 10_000) == 10_000)
        precondition(iosStorageLimit(Double.greatestFiniteMagnitude, defaultValue: 10_000) == Int(Int32.max))
        precondition(iosStorageLimit(0.5, defaultValue: 10_000) == 1)
        print("iOS numeric options contract passed")
    }
}
