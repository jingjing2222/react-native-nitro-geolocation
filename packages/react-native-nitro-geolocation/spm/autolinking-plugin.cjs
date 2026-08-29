const { readFileSync } = require("node:fs");
const path = require("node:path");
const {
  ensurePreparedPackage,
  materializeFrameworks,
  packageJson,
  packageRoot
} = require("./artifacts.cjs");

function readPackageVersion(packageJsonPath) {
  return JSON.parse(readFileSync(packageJsonPath, "utf8")).version;
}

function assertCompatibleRuntime(context) {
  const reactNativeVersion = readPackageVersion(
    path.join(context.reactNativeRoot, "package.json")
  );
  if (!/^0\.87\./.test(reactNativeVersion)) {
    throw new Error(
      `RN 0.87.x is required by the experimental SwiftPM binary; found ${reactNativeVersion}.`
    );
  }

  const nitroPackageJson = require.resolve(
    "react-native-nitro-modules/package.json",
    {
      paths: [context.projectRoot, packageRoot]
    }
  );
  const nitroVersion = readPackageVersion(nitroPackageJson);
  const expectedNitroVersion = packageJson.nitroGeolocation.spmNitroVersion;
  if (nitroVersion !== expectedNitroVersion) {
    throw new Error(
      `The SwiftPM binary contains Nitro Modules ${expectedNitroVersion}, but the app installed ${nitroVersion}. Install react-native-nitro-modules@${expectedNitroVersion}.`
    );
  }
}

module.exports = function nitroGeolocationAutolinkingPlugin(context) {
  assertCompatibleRuntime(context);
  const preparedPackage = ensurePreparedPackage(process.env);
  materializeFrameworks(preparedPackage, packageRoot);

  return {
    watchPaths: [
      path.join(packageRoot, "Package.swift"),
      path.join(packageRoot, "spm"),
      path.join(packageRoot, "prebuilds", "spm")
    ]
  };
};

module.exports.assertCompatibleRuntime = assertCompatibleRuntime;
