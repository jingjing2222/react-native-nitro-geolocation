import Foundation

class NitroGeolocation: HybridNitroGeolocationSpec {
    public func helloWorld() throws -> Promise<String> {
        return Promise.async {
            return "Hello World from iOS!"
        }
    }
}
