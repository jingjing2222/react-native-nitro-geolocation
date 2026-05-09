#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { lstat, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

const LEGACY_PACKAGE = "react-native-geolocation-service";
const NITRO_PACKAGE = "react-native-nitro-geolocation";
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
  ".agents",
  ".cache",
  ".claude",
  ".codex",
  ".cursor",
  ".git",
  ".hg",
  ".nx",
  ".svn",
  ".next",
  ".expo",
  ".turbo",
  ".vite",
  ".vitest",
  ".yarn",
  "android",
  "build",
  "coverage",
  "dist",
  "doc_build",
  "generated",
  "ios",
  "lib",
  "node_modules",
  "Pods",
  "skills"
]);
const ERROR_CODE_NAMES = new Map([
  [-1, "INTERNAL_ERROR"],
  [1, "PERMISSION_DENIED"],
  [2, "POSITION_UNAVAILABLE"],
  [3, "TIMEOUT"],
  [4, "PLAY_SERVICE_NOT_AVAILABLE"],
  [5, "SETTINGS_NOT_SATISFIED"]
]);
const ERROR_CONSTANT_NAMES = new Set(ERROR_CODE_NAMES.values());

function parseArgs(argv) {
  const options = {
    root: process.cwd(),
    dryRun: false,
    inventoryOnly: false,
    skipInstall: false,
    skipRemove: false,
    allowToolInstall: false,
    startupFile: null,
    locationProvider: "playServices",
    report: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      options.root = argv[index + 1];
      index += 1;
    } else if (arg === "--startup-file") {
      options.startupFile = argv[index + 1];
      index += 1;
    } else if (arg === "--location-provider") {
      options.locationProvider = argv[index + 1];
      index += 1;
    } else if (arg === "--report") {
      options.report = argv[index + 1];
      index += 1;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--inventory-only") {
      options.inventoryOnly = true;
    } else if (arg === "--skip-install") {
      options.skipInstall = true;
    } else if (arg === "--skip-remove") {
      options.skipRemove = true;
    } else if (arg === "--allow-tool-install") {
      options.allowToolInstall = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!["playServices", "android", "auto"].includes(options.locationProvider)) {
    throw new Error(
      '--location-provider must be "playServices", "android", or "auto"'
    );
  }

  options.root = path.resolve(options.root);
  if (options.startupFile) {
    options.startupFile = path.resolve(options.root, options.startupFile);
  }
  if (options.report) {
    options.report = path.resolve(options.root, options.report);
  }

  return options;
}

function printHelp() {
  console.log(`Usage: node migrate-geolocation-service.mjs [options]

Options:
  --root <path>              App root to migrate. Defaults to cwd.
  --startup-file <path>      App startup file to receive setConfiguration().
  --location-provider <name> Provider for startup config: playServices, android, auto.
                             Defaults to playServices.
  --report <path>            Write the migration report to a Markdown file.
  --dry-run                  Show package commands and file changes without writing.
  --inventory-only           Only inspect package/source usage and print a report.
  --skip-install             Do not install Nitro packages.
  --skip-remove              Do not remove react-native-geolocation-service.
  --allow-tool-install       Install temporary Babel codemod dependencies if missing.
  -h, --help                 Show this help.
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

function relative(root, file) {
  return path.relative(root, file) || ".";
}

function createReport(root) {
  return {
    root,
    _manualSeen: new Set(),
    changedFiles: [],
    parseFailures: [],
    importSites: [],
    callsites: new Map(),
    riskyHits: [],
    manualReview: [],
    validationCommands: []
  };
}

function addManualReview(report, file, line, message) {
  const key = `${file}:${line ?? ""}:${message}`;
  if (report._manualSeen?.has(key)) return;
  if (!report._manualSeen) report._manualSeen = new Set();
  report._manualSeen.add(key);
  report.manualReview.push({ file, line, message });
}

function addCallsite(report, name) {
  report.callsites.set(name, (report.callsites.get(name) ?? 0) + 1);
}

function scanInventory(files, root, report) {
  const riskyPattern =
    /react-native-geolocation-service|Geolocation\.|requestAuthorization|showLocationDialog|forceRequestLocation|forceLocationManager|\bposition\.(mocked|provider)\b|\berror\.code\b|PLAY_SERVICE_NOT_AVAILABLE|SETTINGS_NOT_SATISFIED|INTERNAL_ERROR|PermissionsAndroid/;
  let forceLocationManagerTrue = 0;
  let forceLocationManagerFalse = 0;

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    const rel = relative(root, file);

    if (source.includes(LEGACY_PACKAGE)) {
      report.importSites.push(rel);
    }

    const likelyGeolocationServiceFile =
      source.includes(LEGACY_PACKAGE) ||
      /\bGeolocation\./.test(source) ||
      /\brequestAuthorization\b/.test(source) ||
      /\bshowLocationDialog\b/.test(source) ||
      /\bforceRequestLocation\b/.test(source) ||
      /\bforceLocationManager\b/.test(source) ||
      /\bPermissionsAndroid\b/.test(source);

    for (const name of [
      "getCurrentPosition",
      "watchPosition",
      "clearWatch",
      "stopObserving",
      "requestAuthorization",
      "setRNConfiguration"
    ]) {
      if (!likelyGeolocationServiceFile) continue;
      const matches = source.match(
        new RegExp(`(?:\\bGeolocation\\.${name}\\b|\\b${name}\\b)`, "g")
      );
      if (matches) {
        for (let index = 0; index < matches.length; index += 1) {
          addCallsite(report, name);
        }
      }
    }

    if (/forceLocationManager\s*:\s*true/.test(source)) {
      forceLocationManagerTrue += 1;
    }
    if (/forceLocationManager\s*:\s*false/.test(source)) {
      forceLocationManagerFalse += 1;
    }

    const lines = source.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (riskyPattern.test(line)) {
        report.riskyHits.push({
          file: rel,
          line: index + 1,
          text: line.trim()
        });
      }
    });
  }

  if (forceLocationManagerTrue > 0 && forceLocationManagerFalse > 0) {
    addManualReview(
      report,
      "(inventory)",
      null,
      "Mixed forceLocationManager usage detected. Nitro locationProvider is global; decide whether the app should use playServices, android, or a deliberate runtime split before transforming."
    );
  }
}

function tryLoadBabelTools(requireFn) {
  try {
    const parser = requireFn("@babel/parser");
    const traverseModule = requireFn("@babel/traverse");
    const generatorModule = requireFn("@babel/generator");
    const t = requireFn("@babel/types");

    return {
      parser,
      traverse: traverseModule.default ?? traverseModule,
      generate: generatorModule.default ?? generatorModule,
      t
    };
  } catch {
    return null;
  }
}

function loadBabelTools(root, { allowToolInstall }) {
  const rootRequire = createRequire(path.join(root, "package.json"));
  const fromRoot = tryLoadBabelTools(rootRequire);
  if (fromRoot) return fromRoot;

  const scriptRequire = createRequire(import.meta.url);
  const fromScript = tryLoadBabelTools(scriptRequire);
  if (fromScript) return fromScript;

  if (!allowToolInstall) {
    throw new Error(
      "AST transform requires @babel/parser, @babel/traverse, @babel/generator, and @babel/types. Install them in the app or rerun with --allow-tool-install for a temporary codemod tool install."
    );
  }

  const cacheDir = path.join(os.tmpdir(), "service-migration-tools");
  rmSync(cacheDir, { recursive: true, force: true });
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(
    path.join(cacheDir, "package.json"),
    JSON.stringify({ private: true, type: "commonjs" }, null, 2)
  );

  runCommand(
    "npm",
    [
      "install",
      "--silent",
      "@babel/parser",
      "@babel/traverse",
      "@babel/generator",
      "@babel/types"
    ],
    { cwd: cacheDir, dryRun: false }
  );

  const tempRequire = createRequire(path.join(cacheDir, "package.json"));
  const fromTemp = tryLoadBabelTools(tempRequire);
  if (!fromTemp) {
    throw new Error("Failed to load temporary Babel codemod dependencies.");
  }

  return fromTemp;
}

function parserPlugins(file) {
  const extension = path.extname(file);
  const plugins = [
    "jsx",
    "classProperties",
    "classPrivateProperties",
    "classPrivateMethods",
    "objectRestSpread",
    "optionalChaining",
    "nullishCoalescingOperator",
    "decorators-legacy",
    "dynamicImport",
    "importMeta"
  ];

  if (extension === ".ts" || extension === ".tsx") {
    plugins.push("typescript");
  }

  return plugins;
}

function memberInfo(t, node) {
  if (!t.isMemberExpression(node) && !t.isOptionalMemberExpression?.(node)) {
    return null;
  }
  if (!t.isIdentifier(node.object) || node.computed) return null;
  if (!t.isIdentifier(node.property)) return null;

  return {
    objectName: node.object.name,
    propertyName: node.property.name
  };
}

function propertyName(t, property) {
  if (!t.isObjectProperty(property) && !t.isObjectMethod(property)) return null;
  if (property.computed) return null;
  if (t.isIdentifier(property.key)) return property.key.name;
  if (t.isStringLiteral(property.key)) return property.key.value;
  return null;
}

function isBooleanLiteral(t, node, value) {
  return t.isBooleanLiteral(node) && node.value === value;
}

function accuracyProperty(t) {
  return t.objectProperty(
    t.identifier("accuracy"),
    t.objectExpression([
      t.objectProperty(t.identifier("android"), t.stringLiteral("high")),
      t.objectProperty(t.identifier("ios"), t.stringLiteral("best"))
    ])
  );
}

function configObject(t, provider, authorizationLevel = "whenInUse") {
  return t.objectExpression([
    t.objectProperty(
      t.identifier("authorizationLevel"),
      t.stringLiteral(authorizationLevel)
    ),
    t.objectProperty(
      t.identifier("enableBackgroundLocationUpdates"),
      t.booleanLiteral(false)
    ),
    t.objectProperty(
      t.identifier("locationProvider"),
      t.stringLiteral(provider)
    )
  ]);
}

function location(t, node) {
  return node?.loc?.start?.line ?? null;
}

function transformOptions(t, optionsNode, { report, file, callName }) {
  if (!optionsNode) {
    if (callName === "getCurrentPosition") {
      addManualReview(
        report,
        file,
        null,
        "getCurrentPosition omitted timeout and maximumAge. Legacy service defaults were effectively infinite; Nitro Modern defaults are timeout 600000 and maximumAge 0."
      );
    }
    if (callName === "getCurrentPosition" || callName === "watchPosition") {
      addManualReview(
        report,
        file,
        null,
        `${callName} omitted showLocationDialog. Legacy service default was true; add an explicit requestLocationSettings() flow if the app still wants the Android settings dialog.`
      );
    }
    return {
      options: null,
      showLocationDialog: "omitted",
      settingsOptions: null
    };
  }

  if (!t.isObjectExpression(optionsNode)) {
    addManualReview(
      report,
      file,
      location(t, optionsNode),
      `${callName} uses dynamic options. Review timeout, maximumAge, showLocationDialog, forceRequestLocation, forceLocationManager, and enableHighAccuracy manually.`
    );
    return {
      options: t.cloneNode(optionsNode, true),
      showLocationDialog: "dynamic",
      settingsOptions: null
    };
  }

  const nextProperties = [];
  let hasAccuracy = false;
  let enableHighAccuracyTrue = false;
  let showLocationDialog = "omitted";
  let omittedTimeout = callName === "getCurrentPosition";
  let omittedMaximumAge = callName === "getCurrentPosition";

  for (const property of optionsNode.properties) {
    const key = propertyName(t, property);
    if (!key || !t.isObjectProperty(property)) {
      nextProperties.push(t.cloneNode(property, true));
      continue;
    }

    if (key === "accuracy") {
      hasAccuracy = true;
      nextProperties.push(t.cloneNode(property, true));
      continue;
    }

    if (key === "enableHighAccuracy") {
      if (isBooleanLiteral(t, property.value, true)) {
        enableHighAccuracyTrue = true;
      } else if (!isBooleanLiteral(t, property.value, false)) {
        addManualReview(
          report,
          file,
          location(t, property),
          `${callName} uses dynamic enableHighAccuracy. Prefer an explicit accuracy preset after review.`
        );
        nextProperties.push(t.cloneNode(property, true));
      }
      continue;
    }

    if (key === "showLocationDialog") {
      if (isBooleanLiteral(t, property.value, true)) {
        showLocationDialog = true;
      } else if (isBooleanLiteral(t, property.value, false)) {
        showLocationDialog = false;
      } else {
        showLocationDialog = "dynamic";
        addManualReview(
          report,
          file,
          location(t, property),
          `${callName} uses dynamic showLocationDialog. Convert the settings flow manually.`
        );
      }
      continue;
    }

    if (key === "forceRequestLocation") {
      addManualReview(
        report,
        file,
        location(t, property),
        "forceRequestLocation has no direct Modern option. Preserve the fallback behavior explicitly only after UX/product review."
      );
      continue;
    }

    if (key === "forceLocationManager") {
      if (isBooleanLiteral(t, property.value, true)) {
        addManualReview(
          report,
          file,
          location(t, property),
          'forceLocationManager: true was a callsite option, but Nitro locationProvider is global. Use setConfiguration({ locationProvider: "android" }) only if the app should globally use Android LocationManager.'
        );
      }
      continue;
    }

    if (key === "timeout") omittedTimeout = false;
    if (key === "maximumAge") omittedMaximumAge = false;
    nextProperties.push(t.cloneNode(property, true));
  }

  if (enableHighAccuracyTrue && !hasAccuracy) {
    nextProperties.unshift(accuracyProperty(t));
  }

  const options = t.objectExpression(nextProperties);

  if (showLocationDialog === "omitted") {
    addManualReview(
      report,
      file,
      location(t, optionsNode),
      `${callName} omitted showLocationDialog. Legacy service default was true; add an explicit requestLocationSettings() flow if the app still wants the Android settings dialog.`
    );
  }

  if (omittedTimeout || omittedMaximumAge) {
    const missing = [
      omittedTimeout ? "timeout" : null,
      omittedMaximumAge ? "maximumAge" : null
    ]
      .filter(Boolean)
      .join(" and ");
    addManualReview(
      report,
      file,
      location(t, optionsNode),
      `getCurrentPosition omitted ${missing}. Legacy service defaults were effectively infinite; Nitro Modern defaults are timeout 600000 and maximumAge 0.`
    );
  }

  return {
    options,
    showLocationDialog,
    settingsOptions:
      showLocationDialog === true
        ? settingsOptionsFromRequestOptions(t, options)
        : null
  };
}

function settingsOptionsFromRequestOptions(t, options) {
  if (!t.isObjectExpression(options)) return null;

  const keys = new Set([
    "accuracy",
    "interval",
    "fastestInterval",
    "distanceFilter"
  ]);
  const properties = options.properties
    .filter((property) => keys.has(propertyName(t, property)))
    .map((property) => t.cloneNode(property, true));

  return properties.length > 0 ? t.objectExpression(properties) : null;
}

function callWithOptionalArg(t, name, arg) {
  return t.callExpression(t.identifier(name), arg ? [arg] : []);
}

function promiseThen(t, expression, callback) {
  return t.callExpression(
    t.memberExpression(expression, t.identifier("then")),
    callback ? [t.cloneNode(callback, true)] : []
  );
}

function promiseCatch(t, expression, callback) {
  return t.callExpression(
    t.memberExpression(expression, t.identifier("catch")),
    callback ? [t.cloneNode(callback, true)] : []
  );
}

function buildGetCurrentPositionExpression(t, args, transformedOptions) {
  const [success, error] = args;
  const getCall = callWithOptionalArg(
    t,
    "getCurrentPosition",
    transformedOptions.options
  );

  let expression = getCall;
  if (transformedOptions.showLocationDialog === true) {
    const settingsCall = callWithOptionalArg(
      t,
      "requestLocationSettings",
      transformedOptions.settingsOptions
    );
    expression = promiseThen(
      t,
      settingsCall,
      t.arrowFunctionExpression([], getCall)
    );
  }

  if (success && !t.isNullLiteral(success)) {
    expression = promiseThen(t, expression, success);
  }
  if (error && !t.isNullLiteral(error)) {
    expression = promiseCatch(t, expression, error);
  }

  return expression;
}

function buildWatchPositionCall(t, args, transformedOptions) {
  const nextArgs = [];
  if (args[0]) nextArgs.push(t.cloneNode(args[0], true));
  if (args[1]) nextArgs.push(t.cloneNode(args[1], true));
  if (transformedOptions.options) nextArgs.push(transformedOptions.options);
  return t.callExpression(t.identifier("watchPosition"), nextArgs);
}

function enumMember(t, name) {
  return t.memberExpression(
    t.identifier("LocationErrorCode"),
    t.identifier(name)
  );
}

function numericErrorCodeName(t, node) {
  if (t.isNumericLiteral(node)) {
    return ERROR_CODE_NAMES.get(node.value) ?? null;
  }
  if (
    t.isUnaryExpression(node) &&
    node.operator === "-" &&
    t.isNumericLiteral(node.argument)
  ) {
    return ERROR_CODE_NAMES.get(-node.argument.value) ?? null;
  }
  return null;
}

function isCodeMember(t, node) {
  if (!t.isMemberExpression(node) && !t.isOptionalMemberExpression?.(node)) {
    return false;
  }
  if (node.computed) return false;
  return t.isIdentifier(node.property, { name: "code" });
}

function upsertNitroImport(t, program, names) {
  if (names.size === 0) return;

  const sortedNames = [...names].sort();
  let nitroImport = null;
  let lastNitroImportIndex = -1;

  for (const [index, statement] of program.body.entries()) {
    if (
      t.isImportDeclaration(statement) &&
      statement.source.value === NITRO_PACKAGE &&
      statement.importKind !== "type"
    ) {
      lastNitroImportIndex = index;
      const hasNamespaceSpecifier = statement.specifiers.some((specifier) =>
        t.isImportNamespaceSpecifier(specifier)
      );
      if (!hasNamespaceSpecifier && !nitroImport) {
        nitroImport = statement;
      }
    }
  }

  const importedLocals = new Set();
  for (const statement of program.body) {
    if (
      !t.isImportDeclaration(statement) ||
      statement.source.value !== NITRO_PACKAGE ||
      statement.importKind === "type"
    ) {
      continue;
    }
    for (const specifier of statement.specifiers) {
      if (t.isImportSpecifier(specifier)) {
        importedLocals.add(specifier.local.name);
      }
    }
  }

  const missingNames = sortedNames.filter((name) => !importedLocals.has(name));
  if (missingNames.length === 0) return;

  if (nitroImport) {
    for (const name of missingNames) {
      nitroImport.specifiers.push(
        t.importSpecifier(t.identifier(name), t.identifier(name))
      );
    }
    return;
  }

  const importDeclaration = t.importDeclaration(
    missingNames.map((name) =>
      t.importSpecifier(t.identifier(name), t.identifier(name))
    ),
    t.stringLiteral(NITRO_PACKAGE)
  );

  let insertionIndex = lastNitroImportIndex + 1;
  if (insertionIndex === 0) {
    while (
      insertionIndex < program.body.length &&
      t.isImportDeclaration(program.body[insertionIndex])
    ) {
      insertionIndex += 1;
    }
  }
  program.body.splice(insertionIndex, 0, importDeclaration);
}

function transformSourceFile(file, root, tools, report, { dryRun }) {
  const { parser, traverse, generate, t } = tools;
  const source = readFileSync(file, "utf8");
  if (!source.includes(LEGACY_PACKAGE)) return false;

  let ast;
  try {
    ast = parser.parse(source, {
      sourceType: "module",
      plugins: parserPlugins(file),
      errorRecovery: false
    });
  } catch (error) {
    report.parseFailures.push({
      file: relative(root, file),
      message: error.message
    });
    return false;
  }

  const rel = relative(root, file);
  const legacyLocals = new Set();
  const requiredImports = new Set();
  let removedLegacyImport = false;

  traverse(ast, {
    ImportDeclaration(path) {
      if (path.node.source.value !== LEGACY_PACKAGE) return;

      for (const specifier of path.node.specifiers) {
        if (t.isImportDefaultSpecifier(specifier)) {
          legacyLocals.add(specifier.local.name);
        } else if (t.isImportNamespaceSpecifier(specifier)) {
          legacyLocals.add(specifier.local.name);
        } else {
          addManualReview(
            report,
            rel,
            location(t, specifier),
            "Named import from react-native-geolocation-service found. Review manually; the common safe path assumes a default Geolocation import."
          );
        }
      }

      removedLegacyImport = true;
      path.remove();
    },
    VariableDeclarator(path) {
      const init = path.node.init;
      if (
        t.isCallExpression(init) &&
        t.isIdentifier(init.callee, { name: "require" }) &&
        t.isStringLiteral(init.arguments[0], { value: LEGACY_PACKAGE })
      ) {
        addManualReview(
          report,
          rel,
          location(t, path.node),
          "CommonJS require('react-native-geolocation-service') found. Convert this import manually to named Modern API imports."
        );
      }
    }
  });

  if (!removedLegacyImport || legacyLocals.size === 0) {
    return false;
  }

  traverse(ast, {
    CallExpression(path) {
      const info = memberInfo(t, path.node.callee);
      if (!info || !legacyLocals.has(info.objectName)) return;

      const args = path.node.arguments;

      if (info.propertyName === "getCurrentPosition") {
        requiredImports.add("getCurrentPosition");
        const transformedOptions = transformOptions(t, args[2], {
          report,
          file: rel,
          callName: "getCurrentPosition"
        });
        if (transformedOptions.showLocationDialog === true) {
          requiredImports.add("requestLocationSettings");
        }
        if (args.length > 3) {
          addManualReview(
            report,
            rel,
            location(t, path.node),
            "getCurrentPosition has more than three arguments. Extra arguments were not converted."
          );
        }
        path.replaceWith(
          buildGetCurrentPositionExpression(t, args, transformedOptions)
        );
        return;
      }

      if (info.propertyName === "watchPosition") {
        requiredImports.add("watchPosition");
        const transformedOptions = transformOptions(t, args[2], {
          report,
          file: rel,
          callName: "watchPosition"
        });
        if (transformedOptions.showLocationDialog === true) {
          addManualReview(
            report,
            rel,
            location(t, path.node),
            "watchPosition used showLocationDialog: true. Add requestLocationSettings() before starting the watch if the app still wants the Android settings dialog."
          );
        }
        path.replaceWith(buildWatchPositionCall(t, args, transformedOptions));
        return;
      }

      if (info.propertyName === "clearWatch") {
        requiredImports.add("unwatch");
        path.replaceWith(
          t.callExpression(
            t.identifier("unwatch"),
            args.map((arg) => t.cloneNode(arg, true))
          )
        );
        return;
      }

      if (info.propertyName === "stopObserving") {
        requiredImports.add("stopObserving");
        path.replaceWith(t.callExpression(t.identifier("stopObserving"), []));
        return;
      }

      if (info.propertyName === "requestAuthorization") {
        requiredImports.add("requestPermission");
        requiredImports.add("setConfiguration");
        const level = t.isStringLiteral(args[0]) ? args[0].value : null;
        if (level && ["always", "whenInUse"].includes(level)) {
          const statement = path.getStatementParent();
          statement?.insertBefore(
            t.expressionStatement(
              t.callExpression(t.identifier("setConfiguration"), [
                configObject(t, "playServices", level)
              ])
            )
          );
        } else {
          addManualReview(
            report,
            rel,
            location(t, path.node),
            "requestAuthorization has a dynamic or omitted authorization level. Set authorizationLevel in startup configuration manually."
          );
        }
        if (source.includes("disabled")) {
          addManualReview(
            report,
            rel,
            location(t, path.node),
            "Legacy requestAuthorization handling references disabled. Modern requestPermission() does not return disabled; use hasServicesEnabled() or getProviderStatus() separately."
          );
        }
        path.replaceWith(
          t.callExpression(t.identifier("requestPermission"), [])
        );
        return;
      }

      if (info.propertyName === "setRNConfiguration") {
        requiredImports.add("setConfiguration");
        path.replaceWith(
          t.callExpression(
            t.identifier("setConfiguration"),
            args.map((arg) => t.cloneNode(arg, true))
          )
        );
      }
    },
    MemberExpression(path) {
      const info = memberInfo(t, path.node);
      if (!info || !legacyLocals.has(info.objectName)) return;
      if (path.parentPath.isCallExpression({ callee: path.node })) return;
      if (!ERROR_CONSTANT_NAMES.has(info.propertyName)) return;

      requiredImports.add("LocationErrorCode");
      path.replaceWith(enumMember(t, info.propertyName));
    },
    BinaryExpression(path) {
      if (!["==", "===", "!=", "!=="].includes(path.node.operator)) return;

      const leftIsCode = isCodeMember(t, path.node.left);
      const rightIsCode = isCodeMember(t, path.node.right);
      if (!leftIsCode && !rightIsCode) return;

      const literalSide = leftIsCode ? path.node.right : path.node.left;
      const codeName = numericErrorCodeName(t, literalSide);
      if (!codeName) return;

      requiredImports.add("LocationErrorCode");
      if (leftIsCode) {
        path.node.right = enumMember(t, codeName);
      } else {
        path.node.left = enumMember(t, codeName);
      }
    }
  });

  upsertNitroImport(t, ast.program, requiredImports);

  const output = generate(
    ast,
    {
      jsescOption: { minimal: true }
    },
    source
  ).code;

  if (output !== source) {
    report.changedFiles.push(rel);
    if (!dryRun) {
      writeFileSync(file, `${output}\n`);
    }
    return true;
  }

  return false;
}

function transformStartupFile(file, root, tools, report, options) {
  const { parser, traverse, generate, t } = tools;
  if (!existsSync(file)) {
    addManualReview(
      report,
      relative(root, file),
      null,
      "Startup file passed to --startup-file does not exist."
    );
    return false;
  }

  const source = readFileSync(file, "utf8");
  let ast;
  try {
    ast = parser.parse(source, {
      sourceType: "module",
      plugins: parserPlugins(file),
      errorRecovery: false
    });
  } catch (error) {
    report.parseFailures.push({
      file: relative(root, file),
      message: error.message
    });
    return false;
  }

  let hasSetConfigurationCall = false;
  traverse(ast, {
    CallExpression(path) {
      if (t.isIdentifier(path.node.callee, { name: "setConfiguration" })) {
        hasSetConfigurationCall = true;
      }
    }
  });

  const rel = relative(root, file);
  if (hasSetConfigurationCall) {
    addManualReview(
      report,
      rel,
      null,
      "Startup file already calls setConfiguration(). Confirm it uses authorizationLevel and locationProvider expected for a service migration."
    );
    return false;
  }

  upsertNitroImport(t, ast.program, new Set(["setConfiguration"]));

  const callStatement = t.expressionStatement(
    t.callExpression(t.identifier("setConfiguration"), [
      configObject(t, options.locationProvider)
    ])
  );

  let insertionIndex = 0;
  while (
    insertionIndex < ast.program.body.length &&
    t.isImportDeclaration(ast.program.body[insertionIndex])
  ) {
    insertionIndex += 1;
  }
  ast.program.body.splice(insertionIndex, 0, callStatement);

  const output = generate(
    ast,
    {
      jsescOption: { minimal: true }
    },
    source
  ).code;

  if (output !== source) {
    report.changedFiles.push(rel);
    if (!options.dryRun) {
      writeFileSync(file, `${output}\n`);
    }
    return true;
  }

  return false;
}

function validationCommands(manager, packageJson) {
  const scripts = packageJson.scripts ?? {};
  return ["typecheck", "lint", "test"]
    .filter((scriptName) => scripts[scriptName])
    .map((scriptName) => commandForScript(manager, scriptName));
}

function buildReportText({
  options,
  manager,
  packageJson,
  dependencies,
  missingPackages,
  hasLegacyPackage,
  report
}) {
  const lines = [];
  lines.push("# Geolocation Service Migration Report");
  lines.push("");
  lines.push(`App root: ${options.root}`);
  lines.push(`Detected package manager: ${manager}`);
  lines.push(
    `${LEGACY_PACKAGE} in package.json: ${hasLegacyPackage ? "yes" : "no"}`
  );
  lines.push(
    `Missing Nitro packages: ${
      missingPackages.length > 0 ? missingPackages.join(", ") : "none"
    }`
  );
  lines.push(
    `Installed package entries scanned: ${Object.keys(dependencies).length}`
  );
  lines.push("");

  lines.push("## Import Sites");
  if (report.importSites.length === 0) {
    lines.push("No react-native-geolocation-service import sites found.");
  } else {
    for (const file of report.importSites) {
      lines.push(`- ${file}`);
    }
  }
  lines.push("");

  lines.push("## Callsite Inventory");
  if (report.callsites.size === 0) {
    lines.push("No known service call names found.");
  } else {
    for (const [name, count] of [...report.callsites.entries()].sort()) {
      lines.push(`- ${name}: ${count}`);
    }
  }
  lines.push("");

  lines.push("## Changed Files");
  if (report.changedFiles.length === 0) {
    lines.push(
      options.dryRun ? "No file changes would be made." : "No files changed."
    );
  } else {
    for (const file of [...new Set(report.changedFiles)].sort()) {
      lines.push(`- ${file}`);
    }
  }
  lines.push("");

  lines.push("## Parse Failures");
  if (report.parseFailures.length === 0) {
    lines.push("None.");
  } else {
    for (const failure of report.parseFailures) {
      lines.push(`- ${failure.file}: ${failure.message}`);
    }
  }
  lines.push("");

  lines.push("## Manual Review");
  if (report.manualReview.length === 0) {
    lines.push("None.");
  } else {
    for (const item of report.manualReview) {
      const loc = item.line ? `${item.file}:${item.line}` : item.file;
      lines.push(`- ${loc}: ${item.message}`);
    }
  }
  lines.push("");

  lines.push("## Risky Search Hits");
  if (report.riskyHits.length === 0) {
    lines.push("None.");
  } else {
    for (const hit of report.riskyHits.slice(0, 200)) {
      lines.push(`- ${hit.file}:${hit.line}: ${hit.text}`);
    }
    if (report.riskyHits.length > 200) {
      lines.push(`- ... ${report.riskyHits.length - 200} more hit(s)`);
    }
  }
  lines.push("");

  const commands = validationCommands(manager, packageJson);
  report.validationCommands = commands;
  lines.push("## Suggested Validation Commands");
  if (commands.length === 0) {
    lines.push("No typecheck/lint/test scripts were found in package.json.");
    lines.push("Run the target app's equivalent validation commands manually.");
  } else {
    for (const command of commands) {
      lines.push(`- ${command}`);
    }
  }

  return lines.join("\n");
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
  const files = await collectSourceFiles(options.root);
  const report = createReport(options.root);
  scanInventory(files, options.root, report);

  console.log(`App root: ${options.root}`);
  console.log(`Detected package manager: ${manager}`);

  if (options.inventoryOnly) {
    const reportText = buildReportText({
      options,
      manager,
      packageJson,
      dependencies,
      missingPackages,
      hasLegacyPackage,
      report
    });
    console.log(`\n${reportText}`);
    return;
  }

  if (!hasLegacyPackage && report.importSites.length === 0) {
    addManualReview(
      report,
      "(package)",
      null,
      `${LEGACY_PACKAGE} is not listed in package.json and no import sites were found. Confirm this app actually needs the service migration.`
    );
  }

  if (!options.skipInstall && missingPackages.length > 0) {
    const [command, args] = commandForInstall(manager, missingPackages);
    runCommand(command, args, { cwd: options.root, dryRun: options.dryRun });
  } else if (missingPackages.length === 0) {
    console.log("Required Nitro packages are already present.");
  }

  const needsAstTools = report.importSites.length > 0 || options.startupFile;
  const tools = needsAstTools
    ? loadBabelTools(options.root, {
        allowToolInstall: options.allowToolInstall
      })
    : null;

  if (tools) {
    for (const file of files) {
      transformSourceFile(file, options.root, tools, report, {
        dryRun: options.dryRun
      });
    }

    if (options.startupFile) {
      transformStartupFile(options.startupFile, options.root, tools, report, {
        dryRun: options.dryRun,
        locationProvider: options.locationProvider
      });
    }
  }

  if (!options.skipRemove && hasLegacyPackage) {
    const [command, args] = commandForRemove(manager, LEGACY_PACKAGE);
    runCommand(command, args, { cwd: options.root, dryRun: options.dryRun });
  } else if (!hasLegacyPackage) {
    console.log(`${LEGACY_PACKAGE} is not listed in package.json.`);
  }

  const reportText = buildReportText({
    options,
    manager,
    packageJson,
    dependencies,
    missingPackages,
    hasLegacyPackage,
    report
  });

  if (options.report) {
    if (options.dryRun) {
      console.log(`[dry-run] Would write report to ${options.report}`);
    } else {
      writeFileSync(options.report, `${reportText}\n`);
      console.log(`Wrote report to ${options.report}`);
    }
  }

  console.log(`\n${reportText}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
