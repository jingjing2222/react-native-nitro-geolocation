const { spawnSync } = require("node:child_process");
const {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync
} = require("node:fs");
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

function hasMaterializedFrameworks(packagePath) {
  return frameworkNames.every((name) =>
    existsSync(path.join(packagePath, "prebuilds", "spm", name))
  );
}

function materializeFrameworks(preparedPackage, destinationPackage) {
  if (hasMaterializedFrameworks(destinationPackage)) return;

  const prebuildsDirectory = path.join(destinationPackage, "prebuilds");
  const destination = path.join(prebuildsDirectory, "spm");
  const temporary = path.join(
    prebuildsDirectory,
    `.spm-${process.pid}-${Date.now()}`
  );
  mkdirSync(temporary, { recursive: true });

  try {
    for (const frameworkName of frameworkNames) {
      cpSync(
        path.join(preparedPackage, "prebuilds", "spm", frameworkName),
        path.join(temporary, frameworkName),
        { recursive: true }
      );
    }
    if (hasMaterializedFrameworks(destinationPackage)) {
      rmSync(temporary, { recursive: true, force: true });
      return;
    }
    rmSync(destination, { recursive: true, force: true });
    renameSync(temporary, destination);
  } catch (error) {
    rmSync(temporary, { recursive: true, force: true });
    throw error;
  }
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
  hasMaterializedFrameworks,
  isPrepared,
  materializeFrameworks,
  packageJson,
  packageRoot,
  preparedPackagePath
};
