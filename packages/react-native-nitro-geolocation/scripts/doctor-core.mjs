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
  const match = version?.match(/(?:^|[^\d])(\d+)\.(\d+)(?:\.\d+)?/);
  if (!match) return "unknown";
  const major = Number(match[1]);
  const minor = Number(match[2]);
  if (
    major > MINIMUM_REACT_NATIVE.major ||
    (major === MINIMUM_REACT_NATIVE.major &&
      minor >= MINIMUM_REACT_NATIVE.minor)
  ) {
    return "supported";
  }
  return "unsupported";
}

function findInfoPlists(directory, depth = 0) {
  if (depth > 4 || !existsSync(directory)) return [];

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
    if (metadata.isFile() && entry === "Info.plist") results.push(candidate);
    if (metadata.isDirectory()) {
      results.push(...findInfoPlists(candidate, depth + 1));
    }
  }
  return results;
}

function inspectAndroid(project, checks) {
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
  const newArchitectureDisabled = /^\s*newArchEnabled\s*=\s*false\s*$/im.test(
    properties
  );
  checks.push(
    newArchitectureDisabled
      ? check(
          "android-new-architecture",
          "error",
          "Android explicitly disables React Native's New Architecture.",
          "Set newArchEnabled=true in android/gradle.properties and rebuild the app."
        )
      : check(
          "android-new-architecture",
          "pass",
          "Android does not disable React Native's New Architecture."
        )
  );

  const manifest =
    readText(path.join(android, "app/src/main/AndroidManifest.xml")) ?? "";
  for (const permission of ["COARSE", "FINE"]) {
    const name = `android.permission.ACCESS_${permission}_LOCATION`;
    const code = `android-permission-${permission.toLowerCase()}`;
    checks.push(
      manifest.includes(name)
        ? check(code, "pass", `${name} is declared.`)
        : check(
            code,
            "error",
            `${name} is missing from the app manifest.`,
            `Add <uses-permission android:name="${name}" /> to android/app/src/main/AndroidManifest.xml.`
          )
    );
  }
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

  const infoPlists = findInfoPlists(ios);
  const hasDescription = infoPlists.some((infoPlist) =>
    readText(infoPlist)?.includes("NSLocationWhenInUseUsageDescription")
  );
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
          "NSLocationWhenInUseUsageDescription is missing from the app Info.plist.",
          "Add a user-facing NSLocationWhenInUseUsageDescription string to the app target's Info.plist."
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

  inspectAndroid(project, checks);
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
