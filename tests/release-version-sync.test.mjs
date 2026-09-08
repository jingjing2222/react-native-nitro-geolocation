import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  assertSupportedReleaseVersion,
  readPodfileLockVersion,
  syncPodfileLockVersion,
  syncVersionedDocumentation,
  syncVersionedNavigation
} from "../scripts/release-version-sync.mjs";

const root = path.resolve(import.meta.dirname, "..");

test("example workspace dependencies survive Changesets versioning", async () => {
  const examplePackage = JSON.parse(
    await readFile(path.join(root, "examples/v0.81.1/package.json"), "utf8")
  );

  assert.equal(
    examplePackage.dependencies["react-native-nitro-geolocation"],
    "workspace:*"
  );
  assert.equal(
    examplePackage.dependencies[
      "@react-native-nitro-geolocation/rozenite-plugin"
    ],
    "workspace:*"
  );
});

test("RC bumps update exact documentation versions without changing the channel", () => {
  const source = [
    "Nitro Geolocation 2.0 RC",
    "yarn add react-native-nitro-geolocation@rc",
    "yarn add react-native-nitro-geolocation@2.0.0-rc.2",
    "Reference 2.0.0-rc.2"
  ].join("\n");

  assert.equal(
    syncVersionedDocumentation(source, "2.0.0-rc.3", "2.0.0-rc.2"),
    [
      "Nitro Geolocation 2.0 RC",
      "yarn add react-native-nitro-geolocation@rc",
      "yarn add react-native-nitro-geolocation@2.0.0-rc.3",
      "Reference 2.0.0-rc.3"
    ].join("\n")
  );
});

test("stable 2.0 synchronization removes RC install tags and labels", () => {
  const source = [
    "Nitro Geolocation 2.0 RC",
    "npm install react-native-nitro-geolocation@rc",
    "npm install react-native-nitro-geolocation@2.0.0-rc.3"
  ].join("\n");

  assert.equal(
    syncVersionedDocumentation(source, "2.0.0", "2.0.0-rc.3"),
    [
      "Nitro Geolocation 2.0",
      "npm install react-native-nitro-geolocation",
      "npm install react-native-nitro-geolocation@2.0.0"
    ].join("\n")
  );
});

test("Podfile.lock synchronization requires one exact pod entry", () => {
  assert.equal(
    readPodfileLockVersion(
      "PODS:\n  - NitroGeolocation (2.0.0-rc.2):\n    - boost\n"
    ),
    "2.0.0-rc.2"
  );
  assert.equal(
    syncPodfileLockVersion(
      "PODS:\n  - NitroGeolocation (2.0.0-rc.2):\n    - boost\n",
      "2.0.0-rc.3"
    ),
    "PODS:\n  - NitroGeolocation (2.0.0-rc.3):\n    - boost\n"
  );
  assert.throws(
    () => syncPodfileLockVersion("PODS:\n", "2.0.0-rc.3"),
    /exactly one/
  );
});

test("the scoped 2.x synchronizer rejects unrelated versions", () => {
  assert.doesNotThrow(() => assertSupportedReleaseVersion("2.0.0-rc.3"));
  assert.doesNotThrow(() => assertSupportedReleaseVersion("2.0.0"));
  assert.doesNotThrow(() => assertSupportedReleaseVersion("2.0.1"));
  assert.throws(
    () => assertSupportedReleaseVersion("3.0.0"),
    /does not support/
  );
});

test("stable navigation drops RC markers and links to the versioned 1.x archive", async () => {
  const source = await readFile(
    path.join(root, "docs/docs/v2/_nav.json"),
    "utf8"
  );
  assert.equal(syncVersionedNavigation(source, "2.0.0-rc.6"), source);
  const stable = syncVersionedNavigation(source, "2.0.0");
  assert.ok(!stable.includes('"RC"'));
  assert.ok(!stable.includes("2.0 RC"));
  assert.ok(
    stable.includes("https://react-native-nitro-geolocation.pages.dev/v1/")
  );
  assert.equal(syncVersionedNavigation(stable, "2.0.0"), stable);
});

test("stable synchronization updates actual readiness policy and package README", async () => {
  const version = JSON.parse(
    await readFile(
      path.join(root, "packages/react-native-nitro-geolocation/package.json"),
      "utf8"
    )
  ).version;
  for (const file of [
    "docs/docs/v2/guide/release-readiness.md",
    "packages/react-native-nitro-geolocation/README.md"
  ]) {
    const source = await readFile(path.join(root, file), "utf8");
    const stable = syncVersionedDocumentation(source, "2.0.0", version);
    assert.ok(!stable.includes("**release candidate**"));
    assert.ok(!stable.includes("README documents RC contracts"));
    assert.ok(!stable.includes("@rc"));
    assert.ok(!stable.includes("/v2/"));
    assert.ok(stable.includes("/v1/"));
    assert.equal(syncVersionedDocumentation(stable, "2.0.0", "2.0.0"), stable);
  }
});
