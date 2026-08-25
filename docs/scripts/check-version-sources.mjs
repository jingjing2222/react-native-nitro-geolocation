import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const docsRoot = path.resolve(import.meta.dirname, "../docs");
const v2Root = path.join(docsRoot, "v2");

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
        tokens.includes("react-native-nitro-geolocation") &&
        !tokens.includes("react-native-nitro-geolocation@rc")
      ) {
        throw new Error(`The v2 install command is not pinned to @rc: ${file}`);
      }
    }
  }
}

console.log(
  `Versioned documentation sources OK: ${canonicalFiles.length} mirrored.`
);
