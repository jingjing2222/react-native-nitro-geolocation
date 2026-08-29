const { spawnSync } = require("node:child_process");
const { existsSync, readFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const packageRoot = path.resolve(__dirname, "..");
const packageJson = JSON.parse(
  readFileSync(path.join(packageRoot, "package.json"), "utf8")
);
const cacheRevision = "v1";
const frameworkNames = [
  "NitroModules.xcframework",
  "NitroGeolocation.xcframework"
];

function cacheBaseDirectory(environment = process.env) {
  if (environment.NITRO_GEOLOCATION_SPM_CACHE_DIR) {
    return path.resolve(environment.NITRO_GEOLOCATION_SPM_CACHE_DIR);
  }
  return path.join(
    os.homedir(),
    "Library",
    "Caches",
    "react-native-nitro-geolocation"
  );
}

function preparedPackagePath(environment = process.env) {
  return path.join(
    cacheBaseDirectory(environment),
    packageJson.version,
    `spm-package-${cacheRevision}`
  );
}

function isPrepared(packagePath) {
  return (
    existsSync(path.join(packagePath, "Package.swift")) &&
    existsSync(
      path.join(
        packagePath,
        "spm",
        "Sources",
        "NitroGeolocationSPMLinker",
        "Linker.swift"
      )
    ) &&
    frameworkNames.every((name) =>
      existsSync(path.join(packagePath, "prebuilds", "spm", name))
    )
  );
}

function ensurePreparedPackage(environment = process.env) {
  const destination = preparedPackagePath(environment);
  if (isPrepared(destination)) return destination;

  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, "ensure-artifacts.cjs")],
    {
      env: { ...environment },
      stdio: "inherit"
    }
  );
  if (result.error) throw result.error;
  if (result.status !== 0 || !isPrepared(destination)) {
    throw new Error(
      `Failed to prepare the Nitro Geolocation SwiftPM package (exit ${result.status ?? "unknown"}).`
    );
  }
  return destination;
}

module.exports = {
  cacheRevision,
  ensurePreparedPackage,
  frameworkNames,
  isPrepared,
  packageJson,
  packageRoot,
  preparedPackagePath
};
