import Foundation

extension NitroBackgroundLocation {
    func safePrefixCount(
        _ value: Double?,
        defaultValue: Int,
        upperBound: Int
    ) -> Int {
        let requested = value ?? Double(defaultValue)
        guard requested.isFinite, requested > 0 else { return 0 }
        return Int(min(requested.rounded(.down), Double(upperBound)))
    }

    func positiveFiniteInt(_ value: Double?, defaultValue: Int) -> Int {
        guard let value, value.isFinite, value > 0 else {
            return defaultValue
        }
        if value >= Double(Int.max) {
            return Int.max
        }
        return max(Int(value.rounded(.down)), 1)
    }
}
