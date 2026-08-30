const { createHash } = require("node:crypto");
const {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const {
  cacheRevision,
  frameworkNames,
  isPrepared,
  packageJson,
  packageRoot,
  preparedPackagePath
} = require("./artifacts.cjs");

function expectedChecksum(contents, assetName) {
  const [checksum, referencedPath] = contents.trim().split(/\s+/, 2);
  if (!/^[0-9a-f]{64}$/i.test(checksum ?? "")) {
    throw new Error(`Invalid SHA-256 file for ${assetName}.`);
  }
  if (
    referencedPath &&
    path.basename(referencedPath.replace(/^\*/, "")) !== assetName
  ) {
    throw new Error("The SHA-256 file referenced a different asset.");
  }
  return checksum.toLowerCase();
}

function sha256(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

async function download(url, destination) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Download failed (${response.status}) for ${url}.`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  writeFileSync(destination, bytes);
}

function findFramework(directory, name) {
  const direct = path.join(directory, name);
  if (existsSync(direct)) return direct;

  const result = spawnSync(
    "/usr/bin/find",
    [directory, "-type", "d", "-name", name],
    {
      encoding: "utf8"
    }
  );
  if (result.status !== 0) {
    throw new Error(
      `Failed to inspect the extracted SwiftPM artifact: ${result.stderr}`
    );
  }
  const matches = result.stdout.trim().split("\n").filter(Boolean);
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one ${name}; found ${matches.length}.`);
  }
  return matches[0];
}

function copyPackageSkeleton(destination) {
  cpSync(
    path.join(packageRoot, "Package.swift"),
    path.join(destination, "Package.swift")
  );
  cpSync(
    path.join(packageRoot, "spm", "Sources"),
    path.join(destination, "spm", "Sources"),
    {
      recursive: true
    }
  );
}

async function prepare() {
  const destination = preparedPackagePath();
  if (isPrepared(destination)) return;

  const parent = path.dirname(destination);
  const temporary = path.join(
    parent,
    `.spm-package-${cacheRevision}-${process.pid}-${Date.now()}`
  );
  mkdirSync(path.join(temporary, "prebuilds", "spm"), { recursive: true });

  try {
    copyPackageSkeleton(temporary);
    const localArtifacts = process.env.NITRO_GEOLOCATION_SPM_ARTIFACTS_DIR;
    let artifactRoot;

    if (localArtifacts) {
      artifactRoot = path.resolve(localArtifacts);
    } else {
      const version = packageJson.version;
      const tag = encodeURIComponent(
        `react-native-nitro-geolocation@${version}`
      );
      const assetName = `react-native-nitro-geolocation-${version}-ios-spm.xcframeworks.zip`;
      const defaultBase = `https://github.com/jingjing2222/react-native-nitro-geolocation/releases/download/${tag}`;
      const base =
        process.env.NITRO_GEOLOCATION_SPM_PREBUILT_URL_BASE ?? defaultBase;
      const downloadDirectory = path.join(parent, "downloads");
      const archivePath = path.join(downloadDirectory, assetName);
      const checksumPath = `${archivePath}.sha256`;
      const extracted = path.join(temporary, "extracted");

      mkdirSync(downloadDirectory, { recursive: true });
      await download(`${base}/${assetName}.sha256`, checksumPath);
      const checksum = expectedChecksum(
        readFileSync(checksumPath, "utf8"),
        assetName
      );
      if (!existsSync(archivePath) || sha256(archivePath) !== checksum) {
        rmSync(archivePath, { force: true });
        await download(`${base}/${assetName}`, archivePath);
      }
      if (sha256(archivePath) !== checksum) {
        rmSync(archivePath, { force: true });
        throw new Error(`SHA-256 mismatch for ${assetName}.`);
      }

      mkdirSync(extracted, { recursive: true });
      const extraction = spawnSync(
        "/usr/bin/ditto",
        ["-x", "-k", archivePath, extracted],
        { stdio: "inherit" }
      );
      if (extraction.error) throw extraction.error;
      if (extraction.status !== 0) {
        throw new Error(`Failed to extract ${assetName}.`);
      }
      artifactRoot = extracted;
    }

    for (const frameworkName of frameworkNames) {
      const source = findFramework(artifactRoot, frameworkName);
      cpSync(source, path.join(temporary, "prebuilds", "spm", frameworkName), {
        recursive: true
      });
    }
    writeFileSync(
      path.join(temporary, ".nitro-geolocation-spm.json"),
      `${JSON.stringify({ version: packageJson.version, cacheRevision }, null, 2)}\n`
    );

    if (!isPrepared(temporary)) {
      throw new Error("The prepared SwiftPM package is incomplete.");
    }
    if (isPrepared(destination)) {
      rmSync(temporary, { recursive: true, force: true });
      return;
    }
    rmSync(destination, { recursive: true, force: true });
    renameSync(temporary, destination);
    console.log(
      `[NitroGeolocation] Prepared SwiftPM binaries at ${destination}`
    );
  } catch (error) {
    rmSync(temporary, { recursive: true, force: true });
    throw error;
  }
}

if (require.main === module) {
  prepare().catch((error) => {
    console.error(`[NitroGeolocation] ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { expectedChecksum, prepare };
