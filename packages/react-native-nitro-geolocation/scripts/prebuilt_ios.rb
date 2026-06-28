require "fileutils"
require "json"
require "open-uri"
require "uri"

module NitroGeolocationPrebuiltIOS
  module_function

  FRAMEWORK_NAME = "NitroGeolocation.xcframework"

  def env_name(name)
    "NITRO_GEOLOCATION_#{name.gsub(/([A-Z])/, '_\1').upcase}"
  end

  def false_like?(value)
    ["0", "false", "no", "off"].include?(value.to_s.downcase)
  end

  def source_checkout?(package_dir)
    real_package_dir = File.realpath(package_dir)
    workspace_package_json = File.expand_path("../../package.json", real_package_dir)
    return false unless File.exist?(workspace_package_json)

    workspace_package = JSON.parse(File.read(workspace_package_json))
    workspace_package["name"] == "react-native-nitro-geolocation-monorepo"
  rescue StandardError
    false
  end

  def use_prebuilt?(package_dir)
    value = ENV[env_name("usePrebuilt")]
    return !false_like?(value) unless value.nil?

    !source_checkout?(package_dir)
  end

  def string_config(name, default_value)
    value = ENV[env_name(name)]
    value.nil? || value.empty? ? default_value : value
  end

  def ensure_framework(package_dir, package)
    version = package.fetch("version")
    tag = "react-native-nitro-geolocation@#{version}"
    encoded_tag = URI.encode_www_form_component(tag)
    asset_name = "react-native-nitro-geolocation-#{version}-ios.xcframework.zip"
    default_url_base = "https://github.com/jingjing2222/react-native-nitro-geolocation/releases/download/#{encoded_tag}"
    url = "#{string_config('prebuiltUrlBase', default_url_base)}/#{asset_name}"

    destination_dir = File.join(package_dir, "prebuilds", "ios")
    framework_path = File.join(destination_dir, FRAMEWORK_NAME)
    marker_path = File.join(destination_dir, ".version")
    if File.directory?(framework_path) && File.exist?(marker_path) && File.read(marker_path).strip == version
      return true
    end

    cache_dir = File.expand_path("~/Library/Caches/react-native-nitro-geolocation/#{version}")
    zip_path = File.join(cache_dir, asset_name)

    FileUtils.mkdir_p(cache_dir)
    unless File.exist?(zip_path)
      Pod::UI.puts "[NitroGeolocation] Downloading iOS prebuilt XCFramework: #{url}"
      uri = URI.parse(url)
      if uri.scheme == "file"
        FileUtils.cp(uri.path, zip_path)
      else
        URI.open(url) do |input|
          File.open(zip_path, "wb") { |output| IO.copy_stream(input, output) }
        end
      end
    end

    FileUtils.rm_rf(destination_dir)
    FileUtils.mkdir_p(destination_dir)
    unless system("/usr/bin/ditto", "-x", "-k", zip_path, destination_dir)
      raise "failed to extract #{asset_name}"
    end

    unless File.directory?(framework_path)
      raise "zip did not contain #{FRAMEWORK_NAME}"
    end

    File.write(marker_path, version)
    Pod::UI.puts "[NitroGeolocation] Using iOS prebuilt XCFramework from #{framework_path}"
    true
  rescue StandardError => error
    FileUtils.rm_f(zip_path) if defined?(zip_path) && zip_path
    Pod::UI.warn "[NitroGeolocation] iOS prebuilt unavailable (#{error.message}). Falling back to source build."
    false
  end
end
