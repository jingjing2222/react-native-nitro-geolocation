import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const docsRoot = path.resolve(import.meta.dirname, "../docs");
const v2Root = path.join(docsRoot, "v2");
const packageJsonPath = path.resolve(
  import.meta.dirname,
  "../../packages/react-native-nitro-geolocation/package.json"
);
const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
const packageVersion = packageJson.version;
const isReleaseCandidate = /-rc\.\d+$/.test(packageVersion);

async function listFiles(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) {
      files.push(
        ...(await listFiles(path.join(directory, entry.name), relativePath))
      );
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }

  return files.sort();
}

const canonicalFiles = (await listFiles(docsRoot)).filter(
  (file) =>
    !file.startsWith("public/") &&
    !file.startsWith("v1/") &&
    !file.startsWith("v2/")
);
const v2Files = await listFiles(v2Root);

if (canonicalFiles.join("\n") !== v2Files.join("\n")) {
  throw new Error(
    "The canonical and v2 documentation file lists differ. Mirror every excluded canonical source into docs/v2."
  );
}

for (const file of canonicalFiles) {
  const [canonical, versioned] = await Promise.all([
    readFile(path.join(docsRoot, file)),
    readFile(path.join(v2Root, file))
  ]);

  if (!canonical.equals(versioned)) {
    throw new Error(
      `The excluded canonical source has drifted from docs/v2: ${file}`
    );
  }

  if (file.endsWith(".md")) {
    for (const line of versioned.toString("utf8").split("\n")) {
      const tokens = line.trim().split(/\s+/);
      if (
        isReleaseCandidate &&
        tokens.includes("react-native-nitro-geolocation") &&
        !tokens.includes("react-native-nitro-geolocation@rc")
      ) {
        throw new Error(`The v2 install command is not pinned to @rc: ${file}`);
      }

      if (
        !isReleaseCandidate &&
        tokens.some((token) =>
          token.includes("react-native-nitro-geolocation@rc")
        )
      ) {
        throw new Error(`The stable install command still uses @rc: ${file}`);
      }

      for (const match of line.matchAll(
        /react-native-nitro-geolocation@(2\.0\.0(?:-rc\.\d+)?)/g
      )) {
        if (match[1] !== packageVersion) {
          throw new Error(
            `The documented package version ${match[1]} does not match ${packageVersion}: ${file}`
          );
        }
      }
    }
  }
}

console.log(
  `Versioned documentation sources OK: ${canonicalFiles.length} mirrored.`
);
