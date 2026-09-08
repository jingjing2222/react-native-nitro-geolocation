import { execFileSync } from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const fixture = await mkdtemp(path.join(os.tmpdir(), "nitro-stable-docs-"));
try {
  await mkdir(path.join(fixture, "scripts"), { recursive: true });
  await cp(path.join(root, "docs"), path.join(fixture, "docs"), {
    recursive: true,
    filter: (source) =>
      !["node_modules", "doc_build", ".rspress"].includes(path.basename(source))
  });
  for (const file of ["sync-release-version.mjs", "release-version-sync.mjs"]) {
    await cp(
      path.join(root, "scripts", file),
      path.join(fixture, "scripts", file)
    );
  }
  const packagePath = "packages/react-native-nitro-geolocation";
  await mkdir(path.join(fixture, packagePath), { recursive: true });
  const manifest = JSON.parse(
    await readFile(path.join(root, packagePath, "package.json"), "utf8")
  );
  manifest.version = "2.0.0";
  await writeFile(
    path.join(fixture, packagePath, "package.json"),
    JSON.stringify(manifest)
  );
  await cp(
    path.join(root, packagePath, "README.md"),
    path.join(fixture, packagePath, "README.md")
  );
  await mkdir(path.join(fixture, "examples/v0.81.1/ios"), { recursive: true });
  await cp(
    path.join(root, "examples/v0.81.1/ios/Podfile.lock"),
    path.join(fixture, "examples/v0.81.1/ios/Podfile.lock")
  );
  await symlink(
    path.join(root, "node_modules"),
    path.join(fixture, "node_modules"),
    "dir"
  );
  await symlink(
    path.join(root, "docs/node_modules"),
    path.join(fixture, "docs/node_modules"),
    "dir"
  );
  const run = (script, cwd = fixture) =>
    execFileSync(process.execPath, [script], { cwd, stdio: "inherit" });
  run(path.join(fixture, "scripts/sync-release-version.mjs"));
  execFileSync(
    process.execPath,
    [
      path.join(root, "docs/node_modules/@rspress/core/bin/rspress.js"),
      "build"
    ],
    {
      cwd: path.join(fixture, "docs"),
      stdio: "inherit"
    }
  );
  for (const script of [
    "finalize-version-routes.mjs",
    "check-version-sources.mjs",
    "check-version-routes.mjs"
  ]) {
    run(path.join(fixture, "docs/scripts", script));
  }
  const redirects = await readFile(
    path.join(fixture, "docs/doc_build/_redirects"),
    "utf8"
  );
  if (!redirects.includes("/v2/* /:splat 301"))
    throw new Error("RC documentation redirects are missing");
  console.log(
    "Stable 2.0 documentation transition passed in an isolated copy."
  );
} finally {
  await rm(fixture, { recursive: true, force: true });
}
