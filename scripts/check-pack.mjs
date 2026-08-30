import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const packageDir = path.join(root, "packages/react-native-nitro-geolocation");
const packageJsonPath = path.join(packageDir, "package.json");
const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
const privacyManifest = await readFile(
  path.join(packageDir, "ios/PrivacyInfo.xcprivacy"),
  "utf8"
);
const podspec = await readFile(
  path.join(packageDir, "NitroGeolocation.podspec"),
  "utf8"
);
const prebuiltIOSScript = await readFile(
  path.join(root, "scripts/build-prebuilt-ios.sh"),
  "utf8"
);
const prebuiltIOSInstaller = await readFile(
  path.join(packageDir, "scripts/prebuilt_ios.rb"),
  "utf8"
);
const androidBuild = await readFile(
  path.join(packageDir, "android/build.gradle"),
  "utf8"
);
const androidChecksumInstaller = await readFile(
  path.join(packageDir, "android/prebuilt_checksum.gradle"),
  "utf8"
);
const swiftPackage = await readFile(
  path.join(packageDir, "Package.swift"),
  "utf8"
);
const spmInstaller = await readFile(
  path.join(packageDir, "spm/ensure-artifacts.cjs"),
  "utf8"
);

const globChars = /[*?[\]{}]/;
const missingEntries = (packageJson.files ?? []).filter((entry) => {
  if (globChars.test(entry)) return false;
  return !existsSync(path.join(packageDir, entry));
});

const pack = spawnSync("npm", ["pack", "--dry-run", "--json"], {
  cwd: packageDir,
  encoding: "utf8"
});

if (pack.status !== 0) {
  process.stderr.write(pack.stderr);
  process.stderr.write(pack.stdout);
  process.exit(pack.status ?? 1);
}

const [metadata] = JSON.parse(pack.stdout);
const packedFiles = metadata.files.map((file) => file.path);
const packedTests = packedFiles.filter((file) =>
  /(^|\/)([^/]+\.)?(test|spec)\.[cm]?[jt]sx?$/.test(file)
);
const requiredPrivacyFiles = ["ios/PrivacyInfo.xcprivacy"];
const requiredPrebuiltFiles = [
  "android/prebuilt_checksum.gradle",
  "scripts/prebuilt_ios.rb",
  "Package.swift",
  "react-native.config.js",
  "spm/autolinking-plugin.cjs",
  "spm/config.cjs",
  "spm/ensure-artifacts.cjs",
  "spm/Sources/NitroGeolocationSPMLinker/Linker.swift"
];
const missingPrivacyFiles = requiredPrivacyFiles.filter(
  (file) => !packedFiles.includes(file)
);
const missingPrebuiltFiles = requiredPrebuiltFiles.filter(
  (file) => !packedFiles.includes(file)
);

const failures = [];
if (missingEntries.length > 0) {
  failures.push(
    `Missing package.json files entries: ${missingEntries.join(", ")}`
  );
}
if (packedTests.length > 0) {
  failures.push(`Test files included in npm pack: ${packedTests.join(", ")}`);
}
if (missingPrivacyFiles.length > 0) {
  failures.push(
    `Privacy manifest missing from npm pack: ${missingPrivacyFiles.join(", ")}`
  );
}
if (missingPrebuiltFiles.length > 0) {
  failures.push(
    `Prebuilt installers missing from npm pack: ${missingPrebuiltFiles.join(", ")}`
  );
}
if (
  !privacyManifest.includes("NSPrivacyAccessedAPICategoryUserDefaults") ||
  !privacyManifest.includes("CA92.1")
) {
  failures.push("iOS privacy manifest must declare UserDefaults reason CA92.1");
}
if (
  !swiftPackage.includes("NitroModules.xcframework") ||
  !swiftPackage.includes("NitroGeolocation.xcframework") ||
  !swiftPackage.includes('.unsafeFlags(["-ObjC"])')
) {
  failures.push("SwiftPM must link both Nitro binaries with ObjC registration");
}
if (
  !spmInstaller.includes("expectedChecksum") ||
  !spmInstaller.includes("sha256(archivePath)") ||
  !spmInstaller.includes("NITRO_GEOLOCATION_SPM_PREBUILT_URL_BASE")
) {
  failures.push(
    "SwiftPM binary installation must verify the published SHA-256"
  );
}
if (
  !privacyManifest.includes("NSPrivacyCollectedDataTypePreciseLocation") ||
  !privacyManifest.includes("NSPrivacyCollectedDataTypePurposeAppFunctionality")
) {
  failures.push(
    "iOS privacy manifest must disclose opt-in precise-location sync"
  );
}
if (
  !podspec.includes('"NitroGeolocationPrivacy"') ||
  !podspec.includes('"ios/PrivacyInfo.xcprivacy"')
) {
  failures.push("CocoaPods must package the SDK privacy manifest");
}
if (!prebuiltIOSScript.includes('"$framework/PrivacyInfo.xcprivacy"')) {
  failures.push(
    "Prebuilt iOS frameworks must package the SDK privacy manifest"
  );
}
if (
  !prebuiltIOSInstaller.includes("Digest::SHA256.file") ||
  !prebuiltIOSInstaller.includes('"#{asset_name}.sha256"')
) {
  failures.push("iOS prebuilt installation must verify the published SHA-256");
}
if (
  !androidChecksumInstaller.includes('MessageDigest.getInstance("SHA-256")') ||
  !androidBuild.includes("prebuiltChecksumUrl") ||
  !androidBuild.includes("inputs.file(prebuiltAarFile)")
) {
  failures.push(
    "Android prebuilt installation must verify the published SHA-256"
  );
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(failure);
  }
  process.exit(1);
}

console.log(
  `Package dry-run OK: ${metadata.files.length} files, ${metadata.unpackedSize} bytes unpacked.`
);
