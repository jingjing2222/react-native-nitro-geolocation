import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const packageDir = path.join(root, "packages/react-native-nitro-geolocation");
const packageJsonPath = path.join(packageDir, "package.json");
const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));

const globChars = /[*?[\]{}]/;
const missingEntries = (packageJson.files ?? []).filter((entry) => {
  if (globChars.test(entry)) return false;
  return !existsSync(path.join(packageDir, entry));
});

const pack = spawnSync("npm", ["pack", "--dry-run", "--json"], {
  cwd: packageDir,
  encoding: "utf8"
});

if (pack.status !== 0) {
  process.stderr.write(pack.stderr);
  process.stderr.write(pack.stdout);
  process.exit(pack.status ?? 1);
}

const [metadata] = JSON.parse(pack.stdout);
const packedFiles = metadata.files.map((file) => file.path);
const packedTests = packedFiles.filter((file) =>
  /(^|\/)([^/]+\.)?(test|spec)\.[cm]?[jt]sx?$/.test(file)
);

const failures = [];
if (missingEntries.length > 0) {
  failures.push(
    `Missing package.json files entries: ${missingEntries.join(", ")}`
  );
}
if (packedTests.length > 0) {
  failures.push(`Test files included in npm pack: ${packedTests.join(", ")}`);
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(failure);
  }
  process.exit(1);
}

console.log(
  `Package dry-run OK: ${metadata.files.length} files, ${metadata.unpackedSize} bytes unpacked.`
);
