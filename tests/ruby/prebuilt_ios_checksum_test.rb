require "digest"
require "fileutils"
require "minitest/autorun"
require "tmpdir"

module Pod
  module UI
    module_function

    def puts(_message); end
    def warn(_message); end
  end
end

require_relative "../../packages/react-native-nitro-geolocation/scripts/prebuilt_ios"

class PrebuiltIOSChecksumTest < Minitest::Test
  def setup
    @temporary_directory = Dir.mktmpdir("nitro-prebuilt-ios-test")
    @original_home = ENV.fetch("HOME")
    @original_url_base = ENV["NITRO_GEOLOCATION_PREBUILT_URL_BASE"]
    ENV["HOME"] = File.join(@temporary_directory, "home")
    ENV["NITRO_GEOLOCATION_PREBUILT_URL_BASE"] = "file://#{release_directory}"
    FileUtils.mkdir_p(package_directory)
    create_release_asset
  end

  def teardown
    ENV["HOME"] = @original_home
    ENV["NITRO_GEOLOCATION_PREBUILT_URL_BASE"] = @original_url_base
    FileUtils.rm_rf(@temporary_directory)
  end

  def test_extracts_an_asset_with_a_matching_checksum
    assert NitroGeolocationPrebuiltIOS.ensure_framework(package_directory, package)
    assert_path_exists privacy_manifest_path
  end

  def test_replaces_a_tampered_cached_archive_before_extraction
    assert NitroGeolocationPrebuiltIOS.ensure_framework(package_directory, package)
    File.binwrite(cache_path, "tampered")

    assert NitroGeolocationPrebuiltIOS.ensure_framework(package_directory, package)
    assert_equal Digest::SHA256.file(asset_path).hexdigest,
      Digest::SHA256.file(cache_path).hexdigest
  end

  def test_reuses_verified_cache_without_release_network
    assert NitroGeolocationPrebuiltIOS.ensure_framework(package_directory, package)
    FileUtils.rm_rf(release_directory)
    FileUtils.rm_rf(File.join(package_directory, "prebuilds"))

    assert NitroGeolocationPrebuiltIOS.ensure_framework(package_directory, package)
    assert_path_exists privacy_manifest_path
  end

  def test_rejects_a_mismatched_release_checksum
    File.write(checksum_path, "#{'0' * 64}  #{asset_name}\n")

    refute NitroGeolocationPrebuiltIOS.ensure_framework(package_directory, package)
    refute_path_exists cache_path
  end

  private

  def package = { "version" => version }
  def version = "9.9.9"
  def package_directory = File.join(@temporary_directory, "package")
  def release_directory = File.join(@temporary_directory, "release")
  def asset_name = "react-native-nitro-geolocation-#{version}-ios.xcframework.zip"
  def asset_path = File.join(release_directory, asset_name)
  def checksum_path = "#{asset_path}.sha256"
  def cache_path = File.join(ENV.fetch("HOME"), "Library", "Caches",
    "react-native-nitro-geolocation", version, asset_name)
  def privacy_manifest_path = File.join(package_directory, "prebuilds", "ios",
    "NitroGeolocation.xcframework", "ios-arm64", "NitroGeolocation.framework",
    "PrivacyInfo.xcprivacy")

  def create_release_asset
    framework = File.join(@temporary_directory, "archive",
      "NitroGeolocation.xcframework", "ios-arm64", "NitroGeolocation.framework")
    FileUtils.mkdir_p(framework)
    File.write(File.join(framework, "NitroGeolocation"), "binary")
    File.write(File.join(framework, "PrivacyInfo.xcprivacy"), "privacy")
    FileUtils.mkdir_p(release_directory)
    system("/usr/bin/ditto", "-c", "-k", "--keepParent",
      File.join(@temporary_directory, "archive", "NitroGeolocation.xcframework"),
      asset_path, exception: true)
    digest = Digest::SHA256.file(asset_path).hexdigest
    File.write(checksum_path, "#{digest}  #{asset_name}\n")
  end
end
