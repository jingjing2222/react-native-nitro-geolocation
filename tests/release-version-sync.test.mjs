import assert from "node:assert/strict";
import test from "node:test";
import {
  assertSupportedReleaseVersion,
  readPodfileLockVersion,
  syncPodfileLockVersion,
  syncVersionedDocumentation
} from "../scripts/release-version-sync.mjs";

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
