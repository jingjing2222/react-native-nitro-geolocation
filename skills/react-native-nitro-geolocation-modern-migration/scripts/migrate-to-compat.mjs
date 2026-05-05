#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { lstat, readdir } from "node:fs/promises";
import path from "node:path";

const LEGACY_PACKAGE = "@react-native-community/geolocation";
const COMPAT_IMPORT = "react-native-nitro-geolocation/compat";
const REQUIRED_PACKAGES = [
  "react-native-nitro-modules",
  "react-native-nitro-geolocation"
];
const SOURCE_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx"
]);
const IGNORED_DIRS = new Set([
  ".git",
  ".hg",
  ".svn",
  ".next",
  ".expo",
  ".turbo",
  ".yarn",
  "android",
  "build",
  "coverage",
  "dist",
  "ios",
  "lib",
  "node_modules",
  "Pods"
]);

function parseArgs(argv) {
  const options = {
    root: process.cwd(),
    dryRun: false,
    skipInstall: false,
    skipRemove: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      options.root = argv[index + 1];
      index += 1;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--skip-install") {
      options.skipInstall = true;
    } else if (arg === "--skip-remove") {
      options.skipRemove = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  options.root = path.resolve(options.root);
  return options;
}

function printHelp() {
  console.log(`Usage: node migrate-to-compat.mjs [options]

Options:
  --root <path>      App root to migrate. Defaults to the current directory.
  --dry-run          Show package commands and file changes without writing.
  --skip-install     Do not install react-native-nitro packages.
  --skip-remove      Do not remove @react-native-community/geolocation.
  -h, --help         Show this help.
`);
}

function readPackageJson(root) {
  const packageJsonPath = path.join(root, "package.json");
  if (!existsSync(packageJsonPath)) {
    throw new Error(`No package.json found at ${packageJsonPath}`);
  }

  return {
    path: packageJsonPath,
    data: JSON.parse(readFileSync(packageJsonPath, "utf8"))
  };
}

function packageManagerFromPackageManagerField(packageJson) {
  const value = packageJson.packageManager;
  if (typeof value !== "string") return null;

  const name = value.split("@")[0];
  return ["bun", "npm", "pnpm", "yarn"].includes(name) ? name : null;
}

function parentDirectories(start) {
  const directories = [];
  let current = start;

  while (true) {
    directories.push(current);
    const parent = path.dirname(current);
    if (parent === current) return directories;
    current = parent;
  }
}

const LOCKFILES = [
  ["pnpm-lock.yaml", "pnpm"],
  ["yarn.lock", "yarn"],
  ["bun.lockb", "bun"],
  ["bun.lock", "bun"],
  ["package-lock.json", "npm"],
  ["npm-shrinkwrap.json", "npm"]
];

function packageManagerFromLockfile(directory) {
  for (const [lockfile, manager] of LOCKFILES) {
    if (existsSync(path.join(directory, lockfile))) return manager;
  }

  return null;
}

function packageManagerFromPackageJsonFile(directory) {
  const packageJsonPath = path.join(directory, "package.json");
  if (!existsSync(packageJsonPath)) return null;

  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  return packageManagerFromPackageManagerField(packageJson);
}

function detectPackageManager(root, packageJson) {
  const fromField = packageManagerFromPackageManagerField(packageJson);
  if (fromField) return fromField;

  const rootLockfile = packageManagerFromLockfile(root);
  if (rootLockfile) return rootLockfile;

  for (const directory of parentDirectories(path.dirname(root))) {
    const parentLockfile = packageManagerFromLockfile(directory);
    if (parentLockfile) return parentLockfile;

    const parentField = packageManagerFromPackageJsonFile(directory);
    if (parentField) return parentField;
  }

  return "npm";
}

function dependencyMap(packageJson) {
  return {
    ...(packageJson.dependencies ?? {}),
    ...(packageJson.devDependencies ?? {}),
    ...(packageJson.peerDependencies ?? {}),
    ...(packageJson.optionalDependencies ?? {})
  };
}

function commandForInstall(manager, packages) {
  if (packages.length === 0) return null;
  if (manager === "npm") return ["npm", ["install", ...packages]];
  if (manager === "pnpm") return ["pnpm", ["add", ...packages]];
  if (manager === "bun") return ["bun", ["add", ...packages]];
  return ["yarn", ["add", ...packages]];
}

function commandForRemove(manager, packageName) {
  if (manager === "npm") return ["npm", ["uninstall", packageName]];
  if (manager === "pnpm") return ["pnpm", ["remove", packageName]];
  if (manager === "bun") return ["bun", ["remove", packageName]];
  return ["yarn", ["remove", packageName]];
}

function commandForScript(manager, scriptName) {
  if (manager === "npm") return `npm run ${scriptName}`;
  if (manager === "bun") return `bun run ${scriptName}`;
  if (manager === "pnpm") return `pnpm ${scriptName}`;
  return `yarn ${scriptName}`;
}

function runCommand(command, args, { cwd, dryRun }) {
  const printable = [command, ...args].join(" ");
  if (dryRun) {
    console.log(`[dry-run] ${printable}`);
    return;
  }

  console.log(`$ ${printable}`);
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32"
  });

  if (result.status !== 0) {
    throw new Error(`Command failed: ${printable}`);
  }
}

async function collectSourceFiles(root) {
  const files = [];

  async function walk(directory) {
    const entries = await readdir(directory);
    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry)) continue;

      const fullPath = path.join(directory, entry);
      const info = await lstat(fullPath);
      if (info.isSymbolicLink()) continue;

      if (info.isDirectory()) {
        await walk(fullPath);
        continue;
      }

      if (SOURCE_EXTENSIONS.has(path.extname(entry))) {
        files.push(fullPath);
      }
    }
  }

  await walk(root);
  return files;
}

function migrateImports(files, { dryRun }) {
  const changedFiles = [];
  const navigatorHits = [];

  for (const file of files) {
    const original = readFileSync(file, "utf8");
    const migrated = original
      .replaceAll(`"${LEGACY_PACKAGE}"`, `"${COMPAT_IMPORT}"`)
      .replaceAll(`'${LEGACY_PACKAGE}'`, `'${COMPAT_IMPORT}'`)
      .replaceAll(`\`${LEGACY_PACKAGE}\``, `\`${COMPAT_IMPORT}\``);

    if (migrated !== original) {
      changedFiles.push(file);
      if (!dryRun) {
        writeFileSync(file, migrated);
      }
    }

    if (original.includes("navigator.geolocation")) {
      navigatorHits.push(file);
    }
  }

  return { changedFiles, navigatorHits };
}

function printNextChecks(manager, packageJson) {
  const scripts = packageJson.scripts ?? {};
  const checkNames = ["typecheck", "lint", "test"];
  const commands = checkNames
    .filter((scriptName) => scripts[scriptName])
    .map((scriptName) => commandForScript(manager, scriptName));

  if (commands.length === 0) {
    console.log("No typecheck/lint/test scripts were found in package.json.");
    console.log(
      "Run the target app's equivalent validation commands manually."
    );
    return;
  }

  console.log("Suggested validation commands:");
  for (const command of commands) {
    console.log(`  ${command}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const { data: packageJson } = readPackageJson(options.root);
  const manager = detectPackageManager(options.root, packageJson);
  const dependencies = dependencyMap(packageJson);
  const missingPackages = REQUIRED_PACKAGES.filter(
    (packageName) => !dependencies[packageName]
  );
  const hasLegacyPackage = Boolean(dependencies[LEGACY_PACKAGE]);

  console.log(`App root: ${options.root}`);
  console.log(`Detected package manager: ${manager}`);

  if (!options.skipInstall && missingPackages.length > 0) {
    const [command, args] = commandForInstall(manager, missingPackages);
    runCommand(command, args, { cwd: options.root, dryRun: options.dryRun });
  } else if (missingPackages.length === 0) {
    console.log("Required Nitro packages are already present.");
  }

  const files = await collectSourceFiles(options.root);
  const { changedFiles, navigatorHits } = migrateImports(files, {
    dryRun: options.dryRun
  });

  if (changedFiles.length > 0) {
    console.log(
      `${options.dryRun ? "Would update" : "Updated"} ${changedFiles.length} file(s):`
    );
    for (const file of changedFiles) {
      console.log(`  ${path.relative(options.root, file)}`);
    }
  } else {
    console.log("No @react-native-community/geolocation imports were found.");
  }

  if (!options.skipRemove && hasLegacyPackage) {
    const [command, args] = commandForRemove(manager, LEGACY_PACKAGE);
    runCommand(command, args, { cwd: options.root, dryRun: options.dryRun });
  } else if (!hasLegacyPackage) {
    console.log(`${LEGACY_PACKAGE} is not listed in package.json.`);
  }

  if (navigatorHits.length > 0) {
    console.log("Manual review required for navigator.geolocation usage:");
    for (const file of navigatorHits) {
      console.log(`  ${path.relative(options.root, file)}`);
    }
  }

  printNextChecks(manager, packageJson);
  console.log("Next: refactor compat call sites to the Modern API.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
