import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const cliPath = path.resolve(import.meta.dirname, "../scripts/doctor.mjs");

function createProject({
  reactNative = "0.87.0",
  nitro = true,
  androidPermissions = true,
  androidManifest,
  iosPermission = true,
  iosTestPermission = false,
  generatedIosPermission,
  generateInfoPlist = true,
  newArchitecture = true,
  newArchitectureKey = "newArchEnabled"
}: {
  reactNative?: string;
  nitro?: boolean;
  androidPermissions?: boolean;
  androidManifest?: string;
  iosPermission?: boolean;
  iosTestPermission?: boolean;
  generatedIosPermission?: string;
  generateInfoPlist?: boolean;
  newArchitecture?: boolean | "absent";
  newArchitectureKey?: "newArchEnabled" | "react.newArchEnabled";
} = {}) {
  const project = mkdtempSync(path.join(tmpdir(), "nitro-geolocation-doctor-"));
  const dependencies: Record<string, string> = {
    "react-native": reactNative,
    "react-native-nitro-geolocation": "2.0.0-rc.0"
  };

  if (nitro) dependencies["react-native-nitro-modules"] = "0.35.10";

  writeFileSync(
    path.join(project, "package.json"),
    JSON.stringify({ name: "consumer-app", private: true, dependencies })
  );

  mkdirSync(path.join(project, "android/app/src/main"), { recursive: true });
  writeFileSync(
    path.join(project, "android/gradle.properties"),
    newArchitecture === "absent"
      ? "android.useAndroidX=true\n"
      : `${newArchitectureKey}=${String(newArchitecture)}\n`
  );
  writeFileSync(
    path.join(project, "android/app/src/main/AndroidManifest.xml"),
    androidManifest ??
      (androidPermissions
        ? '<manifest xmlns:android="http://schemas.android.com/apk/res/android"><uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" /><uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" /></manifest>'
        : '<manifest xmlns:android="http://schemas.android.com/apk/res/android"></manifest>')
  );

  mkdirSync(path.join(project, "ios/Consumer"), { recursive: true });
  mkdirSync(path.join(project, "ios/ATests"), { recursive: true });
  writeFileSync(
    path.join(project, "ios/ATests/Info.plist"),
    iosTestPermission
      ? "<plist><dict><key>NSLocationWhenInUseUsageDescription</key><string>Only the tests use this.</string></dict></plist>"
      : "<plist><dict></dict></plist>"
  );
  writeFileSync(
    path.join(project, "ios/Consumer/Info.plist"),
    iosPermission
      ? "<plist><dict><key>NSLocationWhenInUseUsageDescription</key><string>Show nearby places.</string></dict></plist>"
      : "<plist><dict></dict></plist>"
  );
  mkdirSync(path.join(project, "ios/Consumer.xcodeproj"), { recursive: true });
  writeFileSync(
    path.join(project, "ios/Consumer.xcodeproj/project.pbxproj"),
    `// !$*UTF8*$!
{
  objects = {
		AAAAAAAAAAAAAAAAAAAAAAAA /* Consumer */ = {
			isa = PBXNativeTarget;
			buildConfigurationList = BBBBBBBBBBBBBBBBBBBBBBBB;
			name = Consumer;
			productType = "com.apple.product-type.application";
		};
		BBBBBBBBBBBBBBBBBBBBBBBB /* Build configuration list for PBXNativeTarget "Consumer" */ = {
			isa = XCConfigurationList;
			buildConfigurations = (
				CCCCCCCCCCCCCCCCCCCCCCCC,
			);
		};
		CCCCCCCCCCCCCCCCCCCCCCCC /* Release */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
${
  generatedIosPermission
    ? `\t\t\t\tGENERATE_INFOPLIST_FILE = ${generateInfoPlist ? "YES" : "NO"};\n\t\t\t\tINFOPLIST_KEY_NSLocationWhenInUseUsageDescription = "${generatedIosPermission}";`
    : "\t\t\t\tINFOPLIST_FILE = $(TARGET_NAME)/Info.plist;"
}
			};
			name = Release;
		};
  };
}
`
  );

  return project;
}

describe("nitro-geolocation doctor", () => {
  const projects: string[] = [];

  afterEach(() => {
    for (const project of projects.splice(0)) {
      rmSync(project, { recursive: true, force: true });
    }
  });

  it("passes a naturally configured RN 0.87 consumer project", () => {
    const project = createProject();
    projects.push(project);

    const output = execFileSync(
      process.execPath,
      [cliPath, "doctor", "--project", project, "--json"],
      { encoding: "utf8" }
    );
    const report = JSON.parse(output);

    expect(report.ok).toBe(true);
    expect(report.summary).toEqual({ pass: 7, warning: 0, error: 0 });
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "react-native-version",
          status: "pass"
        }),
        expect.objectContaining({
          code: "android-permission-fine",
          status: "pass"
        }),
        expect.objectContaining({
          code: "ios-when-in-use-description",
          status: "pass"
        })
      ])
    );
  });

  it("reports every actionable error instead of stopping at the first one", () => {
    const project = createProject({
      reactNative: "0.74.7",
      nitro: false,
      androidPermissions: false,
      iosPermission: false,
      newArchitecture: false
    });
    projects.push(project);

    const result = spawnSync(
      process.execPath,
      [cliPath, "doctor", "--project", project, "--json"],
      { encoding: "utf8" }
    );
    const report = JSON.parse(result.stdout);

    expect(result.status).toBe(1);
    expect(report.ok).toBe(false);
    expect(
      report.checks.filter(
        ({ status }: { status: string }) => status === "error"
      )
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "react-native-version" }),
        expect.objectContaining({ code: "nitro-modules-dependency" }),
        expect.objectContaining({ code: "android-new-architecture" }),
        expect.objectContaining({ code: "android-permission-coarse" }),
        expect.objectContaining({ code: "android-permission-fine" }),
        expect.objectContaining({ code: "ios-when-in-use-description" })
      ])
    );
  });

  it("keeps projects without generated native folders actionable but valid", () => {
    const project = createProject();
    projects.push(project);
    rmSync(path.join(project, "android"), { recursive: true });
    rmSync(path.join(project, "ios"), { recursive: true });

    const output = execFileSync(
      process.execPath,
      [cliPath, "doctor", "--project", project, "--json"],
      { encoding: "utf8" }
    );
    const report = JSON.parse(output);

    expect(report.ok).toBe(true);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "android-project", status: "warning" }),
        expect.objectContaining({ code: "ios-project", status: "warning" })
      ])
    );
  });

  it("rejects false evidence from legacy defaults, comments, removals, and test targets", () => {
    const project = createProject({
      reactNative: "0.75.5",
      newArchitecture: "absent",
      androidManifest: `<manifest xmlns:android="http://schemas.android.com/apk/res/android" xmlns:tools="http://schemas.android.com/tools">
        <!-- <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" /> -->
        <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" android:maxSdkVersion="30" />
        <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" tools:node="remove" />
      </manifest>`,
      iosPermission: false,
      iosTestPermission: true
    });
    projects.push(project);
    const staleMergedManifest = path.join(
      project,
      "android/app/build/intermediates/merged_manifests/debug/processDebugManifest"
    );
    mkdirSync(staleMergedManifest, { recursive: true });
    writeFileSync(
      path.join(staleMergedManifest, "AndroidManifest.xml"),
      '<manifest xmlns:android="http://schemas.android.com/apk/res/android"><uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" /><uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" /></manifest>'
    );

    const result = spawnSync(
      process.execPath,
      [cliPath, "doctor", "--project", project, "--json"],
      { encoding: "utf8" }
    );
    const report = JSON.parse(result.stdout);

    expect(result.status).toBe(1);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "android-new-architecture",
          status: "error"
        }),
        expect.objectContaining({
          code: "android-permission-coarse",
          status: "error"
        }),
        expect.objectContaining({
          code: "android-permission-fine",
          status: "error"
        }),
        expect.objectContaining({
          code: "ios-when-in-use-description",
          status: "error"
        })
      ])
    );
  });

  it("rejects a missing --project value as CLI usage error", () => {
    const result = spawnSync(
      process.execPath,
      [cliPath, "doctor", "--project", "--json"],
      { encoding: "utf8" }
    );

    expect(result.status).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("--project requires a path");
  });

  it("accepts a non-empty generated Info.plist build setting", () => {
    const project = createProject({
      iosPermission: false,
      generatedIosPermission: "Allow location while using the app."
    });
    projects.push(project);

    const output = execFileSync(
      process.execPath,
      [cliPath, "doctor", "--project", project, "--json"],
      { encoding: "utf8" }
    );
    const report = JSON.parse(output);

    expect(report.ok).toBe(true);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "ios-when-in-use-description",
          status: "pass"
        })
      ])
    );
  });

  it("does not accept an unresolved generated usage-description variable", () => {
    const project = createProject({
      iosPermission: false,
      generatedIosPermission: "$(LOCATION_USAGE_DESCRIPTION)"
    });
    projects.push(project);

    const result = spawnSync(
      process.execPath,
      [cliPath, "doctor", "--project", project, "--json"],
      { encoding: "utf8" }
    );
    const report = JSON.parse(result.stdout);

    expect(result.status).toBe(1);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "ios-when-in-use-description",
          status: "error"
        })
      ])
    );
  });

  it("does not accept a generated key when Info.plist generation is disabled", () => {
    const project = createProject({
      iosPermission: false,
      generatedIosPermission: "Allow location while using the app.",
      generateInfoPlist: false
    });
    projects.push(project);

    const result = spawnSync(
      process.execPath,
      [cliPath, "doctor", "--project", project, "--json"],
      { encoding: "utf8" }
    );
    const report = JSON.parse(result.stdout);

    expect(result.status).toBe(1);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "ios-when-in-use-description",
          status: "error"
        })
      ])
    );
  });

  it("resolves project-level and target xcconfig build settings", () => {
    const project = createProject({ iosPermission: false });
    projects.push(project);
    mkdirSync(path.join(project, "ios/Config"), { recursive: true });
    writeFileSync(
      path.join(project, "ios/Config/Location.xcconfig"),
      "INFOPLIST_KEY_NSLocationWhenInUseUsageDescription = Allow $(PRODUCT_NAME) to use location.\n"
    );
    writeFileSync(
      path.join(project, "ios/Consumer.xcodeproj/project.pbxproj"),
      `// !$*UTF8*$!
{
  objects = {
		AAAAAAAAAAAAAAAAAAAAAAAA /* Consumer */ = {
			isa = PBXNativeTarget;
			buildConfigurationList = BBBBBBBBBBBBBBBBBBBBBBBB;
			name = Consumer;
			productType = "com.apple.product-type.application";
		};
		BBBBBBBBBBBBBBBBBBBBBBBB = {
			isa = XCConfigurationList;
			buildConfigurations = (CCCCCCCCCCCCCCCCCCCCCCCC,);
		};
		CCCCCCCCCCCCCCCCCCCCCCCC = {
			isa = XCBuildConfiguration;
			baseConfigurationReference = FFFFFFFFFFFFFFFFFFFFFFFF;
			buildSettings = {};
			name = Release;
		};
		DDDDDDDDDDDDDDDDDDDDDDDD = {
			isa = PBXProject;
			buildConfigurationList = EEEEEEEEEEEEEEEEEEEEEEEE;
		};
		EEEEEEEEEEEEEEEEEEEEEEEE = {
			isa = XCConfigurationList;
			buildConfigurations = (111111111111111111111111,);
		};
		FFFFFFFFFFFFFFFFFFFFFFFF = {
			isa = PBXFileReference;
			path = Config/Location.xcconfig;
		};
		111111111111111111111111 = {
			isa = XCBuildConfiguration;
			buildSettings = {
				GENERATE_INFOPLIST_FILE = YES;
			};
			name = Release;
		};
  };
}
`
    );

    const output = execFileSync(
      process.execPath,
      [cliPath, "doctor", "--project", project, "--json"],
      { encoding: "utf8" }
    );
    const report = JSON.parse(output);

    expect(report.ok).toBe(true);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "ios-when-in-use-description",
          status: "pass"
        })
      ])
    );
  });

  it("resolves one-line group-relative xcconfig file references", () => {
    const project = createProject({ iosPermission: false });
    projects.push(project);
    const configDirectory = path.join(
      project,
      "ios/Pods/Target Support Files/Consumer"
    );
    mkdirSync(configDirectory, { recursive: true });
    writeFileSync(
      path.join(configDirectory, "Location.xcconfig"),
      "GENERATE_INFOPLIST_FILE = YES\nINFOPLIST_KEY_NSLocationWhenInUseUsageDescription = Allow location.\n"
    );
    writeFileSync(
      path.join(project, "ios/Consumer.xcodeproj/project.pbxproj"),
      `// !$*UTF8*$!
{
  objects = {
		AAAAAAAAAAAAAAAAAAAAAAAA /* Consumer */ = {
			isa = PBXNativeTarget;
			buildConfigurationList = BBBBBBBBBBBBBBBBBBBBBBBB;
			name = Consumer;
			productType = "com.apple.product-type.application";
		};
		BBBBBBBBBBBBBBBBBBBBBBBB = {isa = XCConfigurationList; buildConfigurations = (CCCCCCCCCCCCCCCCCCCCCCCC,); };
		CCCCCCCCCCCCCCCCCCCCCCCC = {isa = XCBuildConfiguration; baseConfigurationReference = FFFFFFFFFFFFFFFFFFFFFFFF; buildSettings = {}; name = Release; };
		DDDDDDDDDDDDDDDDDDDDDDDD /* Pods */ = {isa = PBXGroup; children = (FFFFFFFFFFFFFFFFFFFFFFFF,); path = Pods; sourceTree = "<group>"; };
		FFFFFFFFFFFFFFFFFFFFFFFF /* Location.xcconfig */ = {isa = PBXFileReference; path = "Target Support Files/Consumer/Location.xcconfig"; sourceTree = "<group>"; };
  };
}
`
    );

    const output = execFileSync(
      process.execPath,
      [cliPath, "doctor", "--project", project, "--json"],
      { encoding: "utf8" }
    );
    const report = JSON.parse(output);

    expect(report.ok).toBe(true);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "ios-when-in-use-description",
          status: "pass"
        })
      ])
    );
  });

  it("honors xcconfig includes, conditional assignments, and inherited values", () => {
    const project = createProject({ iosPermission: false });
    projects.push(project);
    mkdirSync(path.join(project, "ios/Config"), { recursive: true });
    writeFileSync(
      path.join(project, "ios/Config/Base.xcconfig"),
      "GENERATE_INFOPLIST_FILE = YES\nINFOPLIST_KEY_NSLocationWhenInUseUsageDescription = Allow inherited location.\n"
    );
    writeFileSync(
      path.join(project, "ios/Config/Target.xcconfig"),
      '#include "Base.xcconfig"\nGENERATE_INFOPLIST_FILE ?= NO\nINFOPLIST_KEY_NSLocationWhenInUseUsageDescription ?= Wrong fallback.\n'
    );
    writeFileSync(
      path.join(project, "ios/Consumer.xcodeproj/project.pbxproj"),
      `// !$*UTF8*$!
{
  objects = {
		AAAAAAAAAAAAAAAAAAAAAAAA = {isa = PBXNativeTarget; buildConfigurationList = BBBBBBBBBBBBBBBBBBBBBBBB; name = Consumer; productType = "com.apple.product-type.application"; };
		BBBBBBBBBBBBBBBBBBBBBBBB = {isa = XCConfigurationList; buildConfigurations = (CCCCCCCCCCCCCCCCCCCCCCCC,); };
		CCCCCCCCCCCCCCCCCCCCCCCC = {
			isa = XCBuildConfiguration;
			baseConfigurationReference = FFFFFFFFFFFFFFFFFFFFFFFF;
			buildSettings = {
				GENERATE_INFOPLIST_FILE = $(inherited);
				INFOPLIST_KEY_NSLocationWhenInUseUsageDescription = $(inherited);
			};
			name = Release;
		};
		FFFFFFFFFFFFFFFFFFFFFFFF = {isa = PBXFileReference; path = Config/Target.xcconfig; sourceTree = SOURCE_ROOT; };
  };
}
`
    );

    const output = execFileSync(
      process.execPath,
      [cliPath, "doctor", "--project", project, "--json"],
      { encoding: "utf8" }
    );
    const report = JSON.parse(output);

    expect(report.ok).toBe(true);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "ios-when-in-use-description",
          status: "pass"
        })
      ])
    );
  });

  it("rejects a later empty xcconfig override", () => {
    const project = createProject({ iosPermission: false });
    projects.push(project);
    mkdirSync(path.join(project, "ios/Config"), { recursive: true });
    writeFileSync(
      path.join(project, "ios/Config/Base.xcconfig"),
      "GENERATE_INFOPLIST_FILE = YES\nINFOPLIST_KEY_NSLocationWhenInUseUsageDescription = Allow location.\n"
    );
    writeFileSync(
      path.join(project, "ios/Config/Target.xcconfig"),
      '#include "Base.xcconfig"\nINFOPLIST_KEY_NSLocationWhenInUseUsageDescription =\n'
    );
    writeFileSync(
      path.join(project, "ios/Consumer.xcodeproj/project.pbxproj"),
      `// !$*UTF8*$!
{
  objects = {
		AAAAAAAAAAAAAAAAAAAAAAAA = {isa = PBXNativeTarget; buildConfigurationList = BBBBBBBBBBBBBBBBBBBBBBBB; name = Consumer; productType = "com.apple.product-type.application"; };
		BBBBBBBBBBBBBBBBBBBBBBBB = {isa = XCConfigurationList; buildConfigurations = (CCCCCCCCCCCCCCCCCCCCCCCC,); };
		CCCCCCCCCCCCCCCCCCCCCCCC = {isa = XCBuildConfiguration; baseConfigurationReference = FFFFFFFFFFFFFFFFFFFFFFFF; buildSettings = {}; name = Release; };
		FFFFFFFFFFFFFFFFFFFFFFFF = {isa = PBXFileReference; path = Config/Target.xcconfig; sourceTree = SOURCE_ROOT; };
  };
}
`
    );

    const result = spawnSync(
      process.execPath,
      [cliPath, "doctor", "--project", project, "--json"],
      { encoding: "utf8" }
    );
    const report = JSON.parse(result.stdout);

    expect(result.status).toBe(1);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "ios-when-in-use-description",
          status: "error"
        })
      ])
    );
  });

  it("resolves an installed React Native version for catalog dependencies", () => {
    const project = createProject({
      reactNative: "catalog:",
      newArchitectureKey: "react.newArchEnabled"
    });
    projects.push(project);
    mkdirSync(path.join(project, "node_modules/react-native"), {
      recursive: true
    });
    writeFileSync(
      path.join(project, "node_modules/react-native/package.json"),
      JSON.stringify({ name: "react-native", version: "0.87.0" })
    );

    const output = execFileSync(
      process.execPath,
      [cliPath, "doctor", "--project", project, "--json"],
      { encoding: "utf8" }
    );
    const report = JSON.parse(output);

    expect(report.ok).toBe(true);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "react-native-version",
          status: "pass"
        }),
        expect.objectContaining({
          code: "android-new-architecture",
          status: "pass"
        })
      ])
    );
  });

  it("does not infer New Architecture from a recent React Native version", () => {
    const project = createProject({ newArchitecture: "absent" });
    projects.push(project);

    const result = spawnSync(
      process.execPath,
      [cliPath, "doctor", "--project", project, "--json"],
      { encoding: "utf8" }
    );
    const report = JSON.parse(result.stdout);

    expect(result.status).toBe(1);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "android-new-architecture",
          status: "error"
        })
      ])
    );
  });

  it("uses Gradle's OR semantics for legacy and scoped New Architecture keys", () => {
    const project = createProject();
    projects.push(project);
    writeFileSync(
      path.join(project, "android/gradle.properties"),
      "newArchEnabled=false\nreact.newArchEnabled=true\n"
    );

    const output = execFileSync(
      process.execPath,
      [cliPath, "doctor", "--project", project, "--json"],
      { encoding: "utf8" }
    );
    const report = JSON.parse(output);

    expect(report.ok).toBe(true);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "android-new-architecture",
          status: "pass"
        })
      ])
    );
  });

  it("recognizes the Gradle project-property environment override", () => {
    const project = createProject({ newArchitecture: "absent" });
    projects.push(project);

    const output = execFileSync(
      process.execPath,
      [cliPath, "doctor", "--project", project, "--json"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          ORG_GRADLE_PROJECT_newArchEnabled: "true"
        }
      }
    );
    const report = JSON.parse(output);

    expect(report.ok).toBe(true);
  });

  it("prefers the installed React Native version over an ambiguous range", () => {
    const project = createProject({ reactNative: ">=0.74 <0.88" });
    projects.push(project);
    mkdirSync(path.join(project, "node_modules/react-native"), {
      recursive: true
    });
    writeFileSync(
      path.join(project, "node_modules/react-native/package.json"),
      JSON.stringify({ name: "react-native", version: "0.87.0" })
    );

    const output = execFileSync(
      process.execPath,
      [cliPath, "doctor", "--project", project, "--json"],
      { encoding: "utf8" }
    );
    const report = JSON.parse(output);

    expect(report.ok).toBe(true);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "react-native-version",
          status: "pass"
        })
      ])
    );
  });
});
