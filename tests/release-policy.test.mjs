import assert from "node:assert/strict";
import test from "node:test";
import {
  assertCandidateTag,
  assertPromotableVersion,
  compareStableVersions,
  isStableVersion,
  resolvePublishTag
} from "../scripts/release-policy.mjs";

test("stable 2.x releases publish directly to latest", () => {
  for (const version of ["2.0.0", "2.0.2", "2.1.0", "2.10.3"]) {
    assert.equal(
      resolvePublishTag({
        name: "react-native-nitro-geolocation",
        version,
        tag: "latest"
      }),
      "latest"
    );
  }
});

test("prerelease tags are preserved", () => {
  assert.equal(
    resolvePublishTag({
      name: "react-native-nitro-geolocation",
      version: "2.0.0-rc.3",
      tag: "rc"
    }),
    "rc"
  );
});

test("unrelated workspace release tags are preserved", () => {
  assert.equal(
    resolvePublishTag({
      name: "devtools-plugin",
      version: "1.0.0",
      tag: "latest"
    }),
    "latest"
  );
});

test("prereleases cannot publish to latest", () => {
  assert.throws(
    () =>
      resolvePublishTag({
        name: "react-native-nitro-geolocation",
        version: "2.1.0-rc.0",
        tag: "latest"
      }),
    /Only stable/
  );
});

test("manual promotion candidate tags remain valid", () => {
  assert.throws(() => assertCandidateTag("latest"), /must never be latest/);
  assert.throws(() => assertCandidateTag(""), /non-empty npm tag/);
  assert.throws(() => assertCandidateTag("ga candidate"), /non-empty npm tag/);
});

test("only exact stable versions are promotable", () => {
  assert.equal(isStableVersion("2.0.0"), true);
  assert.equal(isStableVersion("02.0.0"), false);
  assert.equal(isStableVersion("2.0.0-rc.3"), false);
  assert.doesNotThrow(() => assertPromotableVersion("2.0.0"));
  assert.throws(() => assertPromotableVersion("2.0.0-rc.3"), /Only an exact/);
});

test("stable version comparison prevents latest rollbacks", () => {
  assert.equal(compareStableVersions("2.0.0", "1.99.99"), 1);
  assert.equal(compareStableVersions("2.0.0", "2.0.0"), 0);
  assert.equal(compareStableVersions("1.99.99", "2.0.0"), -1);
});
