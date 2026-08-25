require "fileutils"
require "digest"
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

  def read_url(url)
    uri = URI.parse(url)
    return File.binread(uri.path) if uri.scheme == "file"

    URI.open(url, &:read)
  end

  def download(url, path)
    uri = URI.parse(url)
    if uri.scheme == "file"
      FileUtils.cp(uri.path, path)
    else
      URI.open(url) do |input|
        File.open(path, "wb") { |output| IO.copy_stream(input, output) }
      end
    end
  end

  def expected_checksum(contents, asset_name)
    checksum, referenced_path = contents.strip.split(/\s+/, 2)
    unless checksum&.match?(/\A[0-9a-fA-F]{64}\z/)
      raise "invalid SHA-256 file for #{asset_name}"
    end
    if referenced_path && File.basename(referenced_path.delete_prefix("*")) != asset_name
      raise "SHA-256 file referenced a different asset"
    end

    checksum.downcase
  end

  def ensure_framework(package_dir, package)
    version = package.fetch("version")
    tag = "react-native-nitro-geolocation@#{version}"
    encoded_tag = URI.encode_www_form_component(tag)
    asset_name = "react-native-nitro-geolocation-#{version}-ios.xcframework.zip"
    checksum_name = "#{asset_name}.sha256"
    default_url_base = "https://github.com/jingjing2222/react-native-nitro-geolocation/releases/download/#{encoded_tag}"
    url = "#{string_config('prebuiltUrlBase', default_url_base)}/#{asset_name}"
    checksum_url = "#{string_config('prebuiltUrlBase', default_url_base)}/#{checksum_name}"

    destination_dir = File.join(package_dir, "prebuilds", "ios")
    framework_path = File.join(destination_dir, FRAMEWORK_NAME)
    marker_path = File.join(destination_dir, ".version")
    cache_dir = File.expand_path("~/Library/Caches/react-native-nitro-geolocation/#{version}")
    zip_path = File.join(cache_dir, asset_name)
    cached_checksum_path = File.join(cache_dir, checksum_name)

    FileUtils.mkdir_p(cache_dir)
    checksum = nil
    if File.exist?(cached_checksum_path)
      begin
        checksum = expected_checksum(File.read(cached_checksum_path), asset_name)
      rescue StandardError
        FileUtils.rm_f(cached_checksum_path)
      end
    end

    if checksum && File.exist?(zip_path) && Digest::SHA256.file(zip_path).hexdigest == checksum
      Pod::UI.puts "[NitroGeolocation] Using verified iOS prebuilt cache: #{zip_path}"
    else
      FileUtils.rm_f(zip_path)
    end

    unless checksum
      Pod::UI.puts "[NitroGeolocation] Fetching iOS prebuilt checksum: #{checksum_url}"
      checksum_contents = read_url(checksum_url)
      checksum = expected_checksum(checksum_contents, asset_name)
      File.write(cached_checksum_path, checksum_contents)
    end
    unless File.exist?(zip_path)
      Pod::UI.puts "[NitroGeolocation] Downloading iOS prebuilt XCFramework: #{url}"
      download(url, zip_path)
    end
    unless Digest::SHA256.file(zip_path).hexdigest == checksum
      FileUtils.rm_f(zip_path)
      FileUtils.rm_f(cached_checksum_path)
      raise "SHA-256 mismatch for #{asset_name}"
    end

    FileUtils.rm_rf(destination_dir)
    FileUtils.mkdir_p(destination_dir)
    unless system("/usr/bin/ditto", "-x", "-k", zip_path, destination_dir)
      raise "failed to extract #{asset_name}"
    end

    unless File.directory?(framework_path)
      raise "zip did not contain #{FRAMEWORK_NAME}"
    end

    frameworks = Dir.glob(File.join(framework_path, "**", "*.framework"))
    unless frameworks.any? && frameworks.all? { |path| File.file?(File.join(path, "PrivacyInfo.xcprivacy")) }
      raise "prebuilt framework did not contain PrivacyInfo.xcprivacy in every slice"
    end

    File.write(marker_path, version)
    Pod::UI.puts "[NitroGeolocation] Using iOS prebuilt XCFramework from #{framework_path}"
    true
  rescue StandardError => error
    Pod::UI.warn "[NitroGeolocation] iOS prebuilt unavailable (#{error.message}). Falling back to source build."
    false
  end
end
