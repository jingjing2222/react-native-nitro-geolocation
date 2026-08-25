import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const MINIMUM_REACT_NATIVE = { major: 0, minor: 75 };

function check(code, status, message, remediation) {
  return { code, status, message, ...(remediation ? { remediation } : {}) };
}

function readText(file) {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return undefined;
  }
}

function declaredDependency(packageJson, name) {
  for (const section of [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies"
  ]) {
    const version = packageJson[section]?.[name];
    if (typeof version === "string") return version;
  }
  return undefined;
}

function reactNativeVersionStatus(version) {
  const parsed = parseReactNativeVersion(version);
  if (!parsed) return "unknown";
  const { major, minor } = parsed;
  if (
    major > MINIMUM_REACT_NATIVE.major ||
    (major === MINIMUM_REACT_NATIVE.major &&
      minor >= MINIMUM_REACT_NATIVE.minor)
  ) {
    return "supported";
  }
  return "unsupported";
}

function parseReactNativeVersion(version) {
  const match = version?.match(/(?:^|[^\d])(\d+)\.(\d+)(?:\.\d+)?/);
  if (!match) return undefined;
  return { major: Number(match[1]), minor: Number(match[2]) };
}

function findFiles(directory, fileName, depth = 0, maxDepth = 6) {
  if (depth > maxDepth || !existsSync(directory)) return [];

  const results = [];
  for (const entry of readdirSync(directory)) {
    if (["build", "Pods", ".git"].includes(entry)) continue;
    const candidate = path.join(directory, entry);
    let metadata;
    try {
      metadata = statSync(candidate);
    } catch {
      continue;
    }
    if (metadata.isFile() && entry === fileName) results.push(candidate);
    if (metadata.isDirectory()) {
      results.push(...findFiles(candidate, fileName, depth + 1, maxDepth));
    }
  }
  return results;
}

function activeAndroidPermission(manifest, name) {
  const withoutComments = manifest.replace(/<!--[\s\S]*?-->/g, "");
  const tags =
    withoutComments.match(/<uses-permission(?:-sdk-\d+)?\b[^>]*>/gi) ?? [];
  return tags.some((tag) => {
    const declaresName = new RegExp(
      `\\bandroid:name\\s*=\\s*["']${name.replaceAll(".", "\\.")}["']`,
      "i"
    ).test(tag);
    const removesNode = /\btools:node\s*=\s*["'](?:remove|removeAll)["']/i.test(
      tag
    );
    const limitsSdk = /\bandroid:maxSdkVersion\s*=/i.test(tag);
    return declaresName && !removesNode && !limitsSdk;
  });
}

function inspectAndroid(project, checks, reactNativeVersion) {
  const android = path.join(project, "android");
  if (!existsSync(android)) {
    checks.push(
      check(
        "android-project",
        "warning",
        "No generated android directory was found.",
        "Run the native prebuild first, then rerun the doctor to verify Android configuration."
      )
    );
    return;
  }

  const properties = readText(path.join(android, "gradle.properties")) ?? "";
  function effectiveBooleanProperty(name) {
    const values = [
      ...properties.matchAll(
        new RegExp(
          `^\\s*${name.replace(".", "\\.")}\\s*=\\s*(true|false)\\s*$`,
          "gim"
        )
      )
    ];
    const environment = process.env[`ORG_GRADLE_PROJECT_${name}`];
    const value = environment ?? values.at(-1)?.[1];
    return value?.toLowerCase() === "true";
  }
  const architectureEnabled =
    effectiveBooleanProperty("newArchEnabled") ||
    effectiveBooleanProperty("react.newArchEnabled");
  checks.push(
    architectureEnabled
      ? check(
          "android-new-architecture",
          "pass",
          "Android enables React Native's New Architecture."
        )
      : check(
          "android-new-architecture",
          "error",
          `Android does not explicitly enable React Native's New Architecture${reactNativeVersion ? ` for React Native ${reactNativeVersion.major}.${reactNativeVersion.minor}` : ""}.`,
          "Set newArchEnabled=true or react.newArchEnabled=true in android/gradle.properties (or the matching ORG_GRADLE_PROJECT_ environment variable) and rebuild the app."
        )
  );

  const sourceManifest = path.join(android, "app/src/main/AndroidManifest.xml");
  const manifest = readText(sourceManifest) ?? "";
  for (const permission of ["COARSE", "FINE"]) {
    const name = `android.permission.ACCESS_${permission}_LOCATION`;
    const code = `android-permission-${permission.toLowerCase()}`;
    checks.push(
      activeAndroidPermission(manifest, name)
        ? check(code, "pass", `${name} is active in the main app manifest.`)
        : check(
            code,
            "error",
            `${name} is missing from the app manifest.`,
            `Add <uses-permission android:name="${name}" /> to android/app/src/main/AndroidManifest.xml.`
          )
    );
  }
}

function parsePbxObjects(contents) {
  const lines = contents.split(/\r?\n/);
  const objects = new Map();
  for (let index = 0; index < lines.length; index += 1) {
    const start = lines[index].match(
      /^(\s+)([A-F0-9]{24})(?: \/\*.*\*\/)? = \{\s*$/
    );
    if (!start) continue;
    const [, indentation, identifier] = start;
    const body = [];
    for (index += 1; index < lines.length; index += 1) {
      if (lines[index] === `${indentation}};`) break;
      body.push(lines[index]);
    }
    objects.set(identifier, body.join("\n"));
  }
  return objects;
}

function buildSetting(block, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = block.match(
    new RegExp(`^\\s*${escapedName}\\s*=\\s*(.*);\\s*$`, "m")
  );
  if (!match) return undefined;
  const value = match[1].trim();
  if (value.startsWith('"') && value.endsWith('"')) return value.slice(1, -1);
  return value;
}

function resolvedBuildSetting(
  block,
  name,
  builtIns = {},
  resolving = new Set()
) {
  if (builtIns[name] !== undefined) return builtIns[name];
  if (resolving.has(name)) return undefined;
  const raw = buildSetting(block, name);
  if (raw === undefined) return undefined;
  resolving.add(name);
  let unresolved = false;
  const value = raw.replace(
    /\$\(([^)]+)\)|\$\{([^}]+)\}/g,
    (_, first, second) => {
      const variable = String(first ?? second).split(":", 1)[0];
      if (variable === "inherited") {
        unresolved = true;
        return "";
      }
      const replacement = resolvedBuildSetting(
        block,
        variable,
        builtIns,
        resolving
      );
      if (replacement === undefined) {
        unresolved = true;
        return "";
      }
      return replacement;
    }
  );
  resolving.delete(name);
  return unresolved ? undefined : value;
}

function configurationList(objects, listId) {
  const list = listId ? objects.get(listId) : undefined;
  const ids = list?.match(/[A-F0-9]{24}/g) ?? [];
  return ids.flatMap((identifier) => {
    const block = objects.get(identifier);
    if (!block?.includes("isa = XCBuildConfiguration;")) return [];
    return [{ block, name: buildSetting(block, "name") }];
  });
}

function readXcconfig(file, visited = new Set()) {
  if (visited.has(file)) return "";
  visited.add(file);
  const contents = readText(file);
  if (!contents) return "";
  const settings = [];
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.replace(/\/\/.*$/, "").trim();
    const include = line.match(/^#include\??\s+["<](.*)[">]$/);
    if (include) {
      settings.push(
        readXcconfig(path.resolve(path.dirname(file), include[1]), visited)
      );
      continue;
    }
    const setting = line.match(/^([A-Za-z0-9_.]+)\s*(?:\?=|=)\s*(.*?)\s*$/);
    if (setting) settings.push(`${setting[1]} = ${setting[2]};`);
  }
  return settings.join("\n");
}

function xcconfigSettings(pbxproj, objects, configuration) {
  const reference = configuration.match(
    /baseConfigurationReference = ([A-F0-9]{24})/
  )?.[1];
  const fileReference = reference ? objects.get(reference) : undefined;
  const configuredPath = fileReference
    ? buildSetting(fileReference, "path")
    : undefined;
  if (!configuredPath) return "";
  return readXcconfig(
    path.resolve(path.dirname(path.dirname(pbxproj)), configuredPath)
  );
}

function applicationBuildConfigurations(pbxproj) {
  const contents = readText(pbxproj);
  if (!contents) return [];
  const objects = parsePbxObjects(contents);
  const configurations = [];
  const project = [...objects.values()].find((block) =>
    block.includes("isa = PBXProject;")
  );
  const projectListId = project?.match(
    /buildConfigurationList = ([A-F0-9]{24})/
  )?.[1];
  const projectConfigurations = configurationList(objects, projectListId);

  for (const target of objects.values()) {
    if (
      !target.includes("isa = PBXNativeTarget;") ||
      !target.includes('productType = "com.apple.product-type.application";')
    ) {
      continue;
    }
    const listId = target.match(/buildConfigurationList = ([A-F0-9]{24})/)?.[1];
    const targetName = buildSetting(target, "name") ?? "App";
    const projectDirectory = path.dirname(path.dirname(pbxproj));
    for (const configuration of configurationList(objects, listId)) {
      const projectConfiguration = projectConfigurations.find(
        (candidate) => candidate.name === configuration.name
      );
      configurations.push({
        settings: [
          configuration.block,
          xcconfigSettings(pbxproj, objects, configuration.block),
          projectConfiguration?.block ?? "",
          projectConfiguration
            ? xcconfigSettings(pbxproj, objects, projectConfiguration.block)
            : ""
        ].join("\n"),
        builtIns: {
          SRCROOT: projectDirectory,
          PROJECT_DIR: projectDirectory,
          TARGET_NAME: targetName,
          PRODUCT_NAME: targetName,
          EXECUTABLE_NAME: targetName
        }
      });
    }
  }
  return configurations;
}

function resolveInfoPlist(pbxproj, setting) {
  let relative = setting
    .replace(/^\$\((?:SRCROOT|PROJECT_DIR)\)\/?/, "")
    .replace(/^\$\{(?:SRCROOT|PROJECT_DIR)\}\/?/, "");
  if (relative.includes("$(") || relative.includes("${")) return undefined;
  if (path.isAbsolute(relative)) return relative;
  relative = relative.replace(/^\.\//, "");
  return path.resolve(path.dirname(path.dirname(pbxproj)), relative);
}

function nonEmptyUsageDescription(contents) {
  if (!contents) return false;
  const withoutComments = contents.replace(/<!--[\s\S]*?-->/g, "");
  const match = withoutComments.match(
    /<key>\s*NSLocationWhenInUseUsageDescription\s*<\/key>\s*<string>([\s\S]*?)<\/string>/i
  );
  return Boolean(match?.[1].trim());
}

function inspectApplicationPlists(ios) {
  const pbxprojects = findFiles(ios, "project.pbxproj", 0, 3);
  const results = [];
  for (const pbxproj of pbxprojects) {
    for (const configuration of applicationBuildConfigurations(pbxproj)) {
      const generatesInfoPlist =
        resolvedBuildSetting(
          configuration.settings,
          "GENERATE_INFOPLIST_FILE",
          configuration.builtIns
        )?.toUpperCase() === "YES";
      const generatedDescription = resolvedBuildSetting(
        configuration.settings,
        "INFOPLIST_KEY_NSLocationWhenInUseUsageDescription",
        configuration.builtIns
      );
      if (generatesInfoPlist && generatedDescription?.trim()) {
        results.push(true);
        continue;
      }
      const setting = resolvedBuildSetting(
        configuration.settings,
        "INFOPLIST_FILE",
        configuration.builtIns
      );
      const infoPlist = setting
        ? resolveInfoPlist(pbxproj, setting)
        : undefined;
      results.push(
        nonEmptyUsageDescription(infoPlist ? readText(infoPlist) : undefined)
      );
    }
  }
  return results;
}

function inspectIos(project, checks) {
  const ios = path.join(project, "ios");
  if (!existsSync(ios)) {
    checks.push(
      check(
        "ios-project",
        "warning",
        "No generated ios directory was found.",
        "Run the native prebuild first, then rerun the doctor to verify iOS configuration."
      )
    );
    return;
  }

  const applicationResults = inspectApplicationPlists(ios);
  const hasResolvedApplication = applicationResults.length > 0;
  const hasDescription =
    hasResolvedApplication && applicationResults.every((result) => result);
  checks.push(
    hasDescription
      ? check(
          "ios-when-in-use-description",
          "pass",
          "NSLocationWhenInUseUsageDescription is configured."
        )
      : check(
          "ios-when-in-use-description",
          "error",
          hasResolvedApplication
            ? "A non-empty NSLocationWhenInUseUsageDescription is missing from an app target build configuration."
            : "Could not resolve an application target Info.plist or generated usage-description setting.",
          "Set a user-facing NSLocationWhenInUseUsageDescription for every app target build configuration."
        )
  );
}

export function inspectProject(projectPath) {
  const project = path.resolve(projectPath);
  const checks = [];
  const packageJsonPath = path.join(project, "package.json");
  let packageJson;

  try {
    packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    checks.push(
      check("project-package", "pass", "Project package.json is readable.")
    );
  } catch {
    checks.push(
      check(
        "project-package",
        "error",
        `Could not read a valid package.json at ${packageJsonPath}.`,
        "Pass --project with the React Native app root and fix any package.json syntax errors."
      )
    );
    return createReport(project, checks);
  }

  const declaredReactNative = declaredDependency(packageJson, "react-native");
  const reactNative = resolveReactNativeVersion(project, declaredReactNative);
  const versionStatus = reactNativeVersionStatus(reactNative);
  if (versionStatus === "supported") {
    checks.push(
      check(
        "react-native-version",
        "pass",
        `React Native ${reactNative} satisfies the 0.75+ requirement.`
      )
    );
  } else if (versionStatus === "unsupported") {
    checks.push(
      check(
        "react-native-version",
        "error",
        `React Native ${reactNative} is below the supported 0.75+ range.`,
        "Upgrade React Native to 0.75 or newer before installing Nitro Geolocation."
      )
    );
  } else {
    checks.push(
      check(
        "react-native-version",
        "warning",
        declaredReactNative
          ? `Could not determine the React Native version from ${declaredReactNative}.`
          : "react-native is not declared in package.json.",
        "Declare a concrete React Native 0.75+ version and rerun the doctor."
      )
    );
  }

  const nitro = declaredDependency(packageJson, "react-native-nitro-modules");
  checks.push(
    nitro
      ? check(
          "nitro-modules-dependency",
          "pass",
          `react-native-nitro-modules ${nitro} is declared.`
        )
      : check(
          "nitro-modules-dependency",
          "error",
          "react-native-nitro-modules is not declared.",
          "Install react-native-nitro-modules alongside react-native-nitro-geolocation."
        )
  );

  inspectAndroid(project, checks, parseReactNativeVersion(reactNative));
  inspectIos(project, checks);
  return createReport(project, checks);
}

function resolveReactNativeVersion(project, declaredVersion) {
  let directory = project;
  for (let depth = 0; depth < 6; depth += 1) {
    const installedPackage = readText(
      path.join(directory, "node_modules/react-native/package.json")
    );
    if (installedPackage) {
      try {
        const version = JSON.parse(installedPackage).version;
        if (typeof version === "string") return version;
      } catch {
        return declaredVersion;
      }
    }
    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  return declaredVersion;
}

function createReport(project, checks) {
  const summary = { pass: 0, warning: 0, error: 0 };
  for (const item of checks) summary[item.status] += 1;
  return { ok: summary.error === 0, project, summary, checks };
}

export function formatReport(report) {
  const marker = { pass: "PASS", warning: "WARN", error: "FAIL" };
  const lines = [`Nitro Geolocation doctor: ${report.project}`, ""];
  for (const item of report.checks) {
    lines.push(`[${marker[item.status]}] ${item.message}`);
    if (item.remediation) lines.push(`       ${item.remediation}`);
  }
  lines.push(
    "",
    `${report.summary.pass} passed, ${report.summary.warning} warnings, ${report.summary.error} errors`
  );
  return `${lines.join("\n")}\n`;
}
