import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  readPodfileLockVersion,
  syncPodfileLockVersion,
  syncVersionedDocumentation
} from "./release-version-sync.mjs";

const rootDir = path.resolve(import.meta.dirname, "..");
const docsDir = path.join(rootDir, "docs/docs");
const packageDir = path.join(
  rootDir,
  "packages/react-native-nitro-geolocation"
);
const packageJson = JSON.parse(
  await readFile(path.join(packageDir, "package.json"), "utf8")
);
const version = packageJson.version;
const podfileLock = path.join(rootDir, "examples/v0.81.1/ios/Podfile.lock");
const currentPodfileLock = await readFile(podfileLock, "utf8");
const previousVersion = readPodfileLockVersion(currentPodfileLock);

const listMarkdownFiles = async (directory, relativeDirectory = "") => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (
      entry.isDirectory() &&
      relativeDirectory === "" &&
      (entry.name === "public" || entry.name === "v1")
    ) {
      continue;
    }
    if (entry.isDirectory()) {
      files.push(
        ...(await listMarkdownFiles(
          path.join(directory, entry.name),
          relativePath
        ))
      );
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(path.join(directory, entry.name));
    }
  }

  return files;
};

const documentationFiles = [
  ...(await listMarkdownFiles(docsDir)),
  path.join(packageDir, "README.md")
];
let updatedFiles = 0;

for (const file of documentationFiles) {
  const current = await readFile(file, "utf8");
  const synchronized = syncVersionedDocumentation(
    current,
    version,
    previousVersion
  );
  if (synchronized !== current) {
    await writeFile(file, synchronized);
    updatedFiles += 1;
  }
}

const synchronizedPodfileLock = syncPodfileLockVersion(
  currentPodfileLock,
  version
);
if (synchronizedPodfileLock !== currentPodfileLock) {
  await writeFile(podfileLock, synchronizedPodfileLock);
  updatedFiles += 1;
}

console.log(
  `Release version sources synchronized to ${version}: ${updatedFiles} file(s) updated.`
);
