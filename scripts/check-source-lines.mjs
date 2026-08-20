import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

const sourceExtensions = new Set([
  ".c",
  ".cc",
  ".cpp",
  ".h",
  ".hpp",
  ".java",
  ".js",
  ".jsx",
  ".kt",
  ".m",
  ".mm",
  ".mjs",
  ".swift",
  ".ts",
  ".tsx"
]);

const mediaExtensions = new Set([
  ".gif",
  ".ico",
  ".jar",
  ".jpeg",
  ".jpg",
  ".mov",
  ".mp4",
  ".pdf",
  ".png",
  ".webp",
  ".zip"
]);

const excludedPathParts = new Set([
  ".git",
  ".nx",
  ".vitest",
  "build",
  "dist",
  "DerivedData",
  "node_modules",
  "Pods",
  "vendor"
]);

const generatedPathPatterns = [
  /(^|\/)\.yarn\//,
  /(^|\/)coverage\//,
  /(^|\/)generated\//,
  /(^|\/)__generated__\//,
  /(^|\/)android\/app\/build\//,
  /(^|\/)ios\/build\//
];

const lockFilePatterns = [
  /(^|\/)(Gemfile\.lock|Podfile\.lock|package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/
];

const budgets = [
  {
    name: "native adapter",
    limit: 900,
    matches: (file) =>
      file.startsWith("packages/react-native-nitro-geolocation/ios/") ||
      file.startsWith(
        "packages/react-native-nitro-geolocation/android/src/main/"
      )
  },
  {
    name: "example screen",
    limit: 500,
    matches: (file) =>
      file.startsWith("examples/v0.81.1/src/screens/") &&
      !file.startsWith("examples/v0.81.1/src/screens/scenario/native-e2e/")
  },
  {
    name: "example scenario module",
    limit: 700,
    matches: (file) =>
      file.startsWith("examples/v0.81.1/src/screens/scenario/native-e2e/")
  },
  {
    name: "web e2e module",
    limit: 600,
    matches: (file) => file.startsWith("examples/web-e2e/src/")
  }
];

const exceptions = new Map([
  [
    "packages/react-native-nitro-geolocation/android/src/main/java/com/margelo/nitro/nitrogeolocation/NitroGeolocation.kt",
    {
      limit: 1453,
      reason: "existing native adapter exception"
    }
  ],
  [
    "packages/react-native-nitro-geolocation/ios/NitroGeolocation.swift",
    {
      limit: 1096,
      reason: "existing native adapter exception"
    }
  ]
]);

const gitFiles = spawnSync("git", ["ls-files"], {
  cwd: root,
  encoding: "utf8"
});

if (gitFiles.status !== 0) {
  process.stderr.write(gitFiles.stderr);
  process.exit(gitFiles.status ?? 1);
}

const trackedFiles = gitFiles.stdout.split("\n").filter(Boolean);
const failures = [];
const checked = [];

for (const file of trackedFiles) {
  if (!isSourceFile(file) || isExcluded(file)) continue;

  const budget = budgetFor(file);
  if (!budget) continue;

  const contents = await readFile(path.join(root, file), "utf8");
  const lines = countLines(contents);
  checked.push(file);

  if (lines > budget.limit) {
    failures.push({ file, lines, budget });
  }
}

if (failures.length > 0) {
  console.error("Source line-count guard failed:");
  for (const { file, lines, budget } of failures) {
    const suffix = budget.reason ? ` (${budget.reason})` : "";
    console.error(
      `- ${file}: ${lines} lines > ${budget.limit} ${budget.name} budget${suffix}`
    );
  }
  process.exit(1);
}

console.log(`Source line-count guard OK: ${checked.length} files checked.`);

function isSourceFile(file) {
  return sourceExtensions.has(path.extname(file));
}

function isExcluded(file) {
  if (mediaExtensions.has(path.extname(file))) return true;
  if (lockFilePatterns.some((pattern) => pattern.test(file))) return true;
  if (generatedPathPatterns.some((pattern) => pattern.test(file))) return true;
  return file.split("/").some((part) => excludedPathParts.has(part));
}

function budgetFor(file) {
  const exception = exceptions.get(file);
  if (exception) {
    return {
      name: "exception",
      limit: exception.limit,
      reason: exception.reason
    };
  }

  return budgets.find((budget) => budget.matches(file));
}

function countLines(contents) {
  if (contents.length === 0) return 0;
  const newlineCount = contents.match(/\n/g)?.length ?? 0;
  return contents.endsWith("\n") ? newlineCount : newlineCount + 1;
}
