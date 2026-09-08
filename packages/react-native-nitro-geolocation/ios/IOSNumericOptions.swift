import Foundation

func validateIOSLocationNumbers(timeout: Double, maximumAge: Double, distanceFilter: Double) -> String? {
    if !timeout.isFinite || timeout < 0 {
        return "timeout must be a finite number greater than or equal to 0."
    }
    if maximumAge.isNaN || maximumAge < 0 {
        return "maximumAge must be greater than or equal to 0."
    }
    if !distanceFilter.isFinite || distanceFilter < 0 {
        return "distanceFilter must be a finite number greater than or equal to 0."
    }
    return nil
}

func iosHttpSyncAttemptCount(retry: Bool?, maxRetries: Double?) -> Int? {
    guard retry == true else { return 1 }
    let retries = maxRetries ?? 3
    guard retries.isFinite, retries >= 0, retries.rounded(.down) == retries,
          retries < Double(Int32.max) else { return nil }
    return Int(retries) + 1
}

func iosStorageLimit(_ configured: Double?, defaultValue: Int) -> Int? {
    guard let configured else { return defaultValue }
    guard configured.isFinite else { return defaultValue }
    if configured <= 0 { return nil }
    // Positive fractions must never truncate to zero and unexpectedly erase all rows.
    return max(1, Int(min(configured, Double(Int32.max))))
}
