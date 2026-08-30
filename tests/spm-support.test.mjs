import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..");
const packageDir = path.join(root, "packages/react-native-nitro-geolocation");
const { withNitroGeolocationSwiftPM } = require(
  path.join(packageDir, "spm/config.cjs")
);
const { expectedChecksum } = require(
  path.join(packageDir, "spm/ensure-artifacts.cjs")
);

test("SwiftPM app config disables only Nitro's separate iOS autolink target", () => {
  const input = {
    dependencies: {
      existing: { platforms: { android: null } },
      "react-native-nitro-modules": { platforms: { android: {} } }
    },
    project: { ios: { sourceDir: "ios" } }
  };

  const output = withNitroGeolocationSwiftPM(input);

  assert.deepEqual(output.project, input.project);
  assert.deepEqual(output.dependencies.existing, input.dependencies.existing);
  assert.deepEqual(
    output.dependencies["react-native-nitro-modules"].platforms,
    { android: {}, ios: null }
  );
});

test("SwiftPM checksum parser rejects malformed and mismatched sidecars", () => {
  const checksum = "a".repeat(64);
  assert.equal(
    expectedChecksum(`${checksum}  artifact.zip\n`, "artifact.zip"),
    checksum
  );
  assert.throws(
    () => expectedChecksum("not-a-checksum artifact.zip", "artifact.zip"),
    /Invalid SHA-256/
  );
  assert.throws(
    () => expectedChecksum(`${checksum} other.zip`, "artifact.zip"),
    /different asset/
  );
});

test("SwiftPM artifact preparation creates a complete isolated package", async () => {
  const temporary = await mkdtemp(
    path.join(os.tmpdir(), "nitro-geo-spm-test-")
  );
  const artifacts = path.join(temporary, "artifacts");
  const cache = path.join(temporary, "cache");
  await mkdir(path.join(artifacts, "NitroModules.xcframework"), {
    recursive: true
  });
  await mkdir(path.join(artifacts, "NitroGeolocation.xcframework"), {
    recursive: true
  });

  try {
    execFileSync(
      process.execPath,
      [path.join(packageDir, "spm/ensure-artifacts.cjs")],
      {
        env: {
          ...process.env,
          NITRO_GEOLOCATION_SPM_ARTIFACTS_DIR: artifacts,
          NITRO_GEOLOCATION_SPM_CACHE_DIR: cache
        },
        stdio: "pipe"
      }
    );

    const packageJson = JSON.parse(
      await readFile(path.join(packageDir, "package.json"), "utf8")
    );
    const prepared = path.join(cache, packageJson.version, "spm-package-v1");
    assert.equal(existsSync(path.join(prepared, "Package.swift")), true);
    assert.equal(
      existsSync(path.join(prepared, "prebuilds/spm/NitroModules.xcframework")),
      true
    );
    assert.equal(
      existsSync(
        path.join(prepared, "prebuilds/spm/NitroGeolocation.xcframework")
      ),
      true
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("the shipped manifest links both binaries and forces ObjC registration", async () => {
  const manifest = await readFile(
    path.join(packageDir, "Package.swift"),
    "utf8"
  );
  assert.match(manifest, /NitroModules\.xcframework/);
  assert.match(manifest, /NitroGeolocation\.xcframework/);
  assert.match(manifest, /name: "NitroGeolocationSPM"/);
  assert.match(manifest, /\.unsafeFlags\(\["-ObjC"\]\)/);
});

test("the checked-in SwiftPM consumer pins the validated RN and Nitro versions", async () => {
  const exampleDir = path.join(root, "examples/v0.87.1");
  const manifest = JSON.parse(
    await readFile(path.join(exampleDir, "package.json"), "utf8")
  );
  const config = await readFile(
    path.join(exampleDir, "react-native.config.js"),
    "utf8"
  );

  assert.equal(manifest.dependencies["react-native"], "0.87.1");
  assert.equal(manifest.dependencies["react-native-nitro-modules"], "0.37.1");
  assert.equal(
    manifest.dependencies["react-native-nitro-geolocation"],
    "workspace:*"
  );
  assert.equal(
    manifest.scripts["spm:setup"],
    "react-native spm scaffold --deintegrate --yes"
  );
  assert.match(config, /withNitroGeolocationSwiftPM/);
  assert.match(config, /NITRO_GEOLOCATION_EXAMPLE_USE_COCOAPODS/);
});
