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
    return declaresName && !removesNode;
  });
}

function mergedAndroidManifests(android) {
  const intermediates = path.join(android, "app/build/intermediates");
  if (!existsSync(intermediates)) return [];
  return readdirSync(intermediates)
    .filter((entry) => /merged_manifest|packaged_manifest/.test(entry))
    .flatMap((entry) =>
      findFiles(path.join(intermediates, entry), "AndroidManifest.xml", 0, 8)
    );
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
  const architectureValues = [
    ...properties.matchAll(/^\s*newArchEnabled\s*=\s*(true|false)\s*$/gim)
  ];
  const configuredArchitecture = architectureValues.at(-1)?.[1].toLowerCase();
  const defaultArchitectureEnabled =
    reactNativeVersion &&
    (reactNativeVersion.major > 0 || reactNativeVersion.minor >= 76);
  checks.push(
    configuredArchitecture === "false"
      ? check(
          "android-new-architecture",
          "error",
          "Android explicitly disables React Native's New Architecture.",
          "Set newArchEnabled=true in android/gradle.properties and rebuild the app."
        )
      : configuredArchitecture === "true"
        ? check(
            "android-new-architecture",
            "pass",
            "Android enables React Native's New Architecture."
          )
        : defaultArchitectureEnabled
          ? check(
              "android-new-architecture",
              "pass",
              "React Native 0.76+ enables the New Architecture by default and Android does not override it."
            )
          : check(
              "android-new-architecture",
              "error",
              "Android does not explicitly enable React Native's New Architecture for this React Native version.",
              "Set newArchEnabled=true in android/gradle.properties and rebuild the app."
            )
  );

  const sourceManifest = path.join(android, "app/src/main/AndroidManifest.xml");
  const mergedManifests = mergedAndroidManifests(android);
  const manifestFiles =
    mergedManifests.length > 0 ? mergedManifests : [sourceManifest];
  for (const permission of ["COARSE", "FINE"]) {
    const name = `android.permission.ACCESS_${permission}_LOCATION`;
    const code = `android-permission-${permission.toLowerCase()}`;
    const missingFrom = manifestFiles.filter(
      (file) => !activeAndroidPermission(readText(file) ?? "", name)
    );
    checks.push(
      missingFrom.length === 0
        ? check(
            code,
            "pass",
            `${name} is active in the app manifest${manifestFiles.length > 1 ? "s" : ""}.`
          )
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

function applicationBuildConfigurations(pbxproj) {
  const contents = readText(pbxproj);
  if (!contents) return [];
  const objects = parsePbxObjects(contents);
  const configurations = [];

  for (const target of objects.values()) {
    if (
      !target.includes("isa = PBXNativeTarget;") ||
      !target.includes('productType = "com.apple.product-type.application";')
    ) {
      continue;
    }
    const listId = target.match(/buildConfigurationList = ([A-F0-9]{24})/)?.[1];
    const list = listId ? objects.get(listId) : undefined;
    const ids = list?.match(/[A-F0-9]{24}/g) ?? [];
    for (const identifier of ids) {
      const configuration = objects.get(identifier);
      if (configuration?.includes("isa = XCBuildConfiguration;")) {
        configurations.push(configuration);
      }
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
      const generatedDescription = buildSetting(
        configuration,
        "INFOPLIST_KEY_NSLocationWhenInUseUsageDescription"
      );
      if (generatedDescription?.trim()) {
        results.push(true);
        continue;
      }
      const setting = buildSetting(configuration, "INFOPLIST_FILE");
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

  const reactNative = declaredDependency(packageJson, "react-native");
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
        reactNative
          ? `Could not determine the React Native version from ${reactNative}.`
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
