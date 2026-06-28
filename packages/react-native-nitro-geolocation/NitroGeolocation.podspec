require "json"
require_relative "scripts/prebuilt_ios"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))
use_prebuilt = NitroGeolocationPrebuiltIOS.use_prebuilt?(__dir__)
prebuilt_available = use_prebuilt && NitroGeolocationPrebuiltIOS.ensure_framework(__dir__, package)

Pod::Spec.new do |s|
  s.name         = "NitroGeolocation"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => min_ios_version_supported }
  s.source       = { :git => ".git", :tag => "#{s.version}" }

  s.dependency 'React-jsi'
  s.dependency 'React-callinvoker'

  if prebuilt_available
    s.vendored_frameworks = "prebuilds/ios/NitroGeolocation.xcframework"
    s.preserve_paths = "prebuilds/ios/NitroGeolocation.xcframework"
    s.dependency "NitroModules"
  else
    s.source_files = [
      "ios/**/*.{swift}",
      "ios/**/*.{m,mm}",
      "cpp/**/*.{hpp,cpp}",
    ]

    load 'nitrogen/generated/ios/NitroGeolocation+autolinking.rb'
    add_nitrogen_files(s)

    install_modules_dependencies(s)
  end

end
