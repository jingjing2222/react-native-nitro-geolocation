import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");

test("the iOS release consumer builds its JS workspace dependency", async () => {
  const workflow = await readFile(
    path.join(root, ".github/workflows/prebuilt-binaries.yml"),
    "utf8"
  );
  const installDependencies = workflow.indexOf(
    "- name: Install JS dependencies"
  );
  const buildRozenite = workflow.indexOf(
    "- name: Build the Rozenite plugin used by the example"
  );
  const verifyConsumer = workflow.indexOf(
    "- name: Verify the example consumes the packaged XCFramework"
  );

  assert.notEqual(installDependencies, -1);
  assert.notEqual(buildRozenite, -1);
  assert.notEqual(verifyConsumer, -1);
  assert.ok(installDependencies < buildRozenite);
  assert.ok(buildRozenite < verifyConsumer);
  assert.match(
    workflow.slice(buildRozenite, verifyConsumer),
    /yarn workspace @react-native-nitro-geolocation\/rozenite-plugin build/
  );
});

test("release asset publication targets the repository explicitly", async () => {
  const workflow = await readFile(
    path.join(root, ".github/workflows/prebuilt-binaries.yml"),
    "utf8"
  );
  const publishJob = workflow.slice(workflow.indexOf("  publish:"));

  assert.match(
    publishJob,
    /gh release view "\$TAG" --repo "\$GITHUB_REPOSITORY"/
  );
  assert.match(
    publishJob,
    /gh release create "\$TAG" --repo "\$GITHUB_REPOSITORY"/
  );
  assert.match(
    publishJob,
    /gh release upload "\$TAG" build\/prebuilt\/\* --repo "\$GITHUB_REPOSITORY" --clobber/
  );
});
