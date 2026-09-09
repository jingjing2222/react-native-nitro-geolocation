const supportedVersionPattern =
  /^2\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-rc\.(0|[1-9]\d*))?$/;
const podVersionPattern =
  /^([ ]{2}- NitroGeolocation \()(2\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-rc\.(?:0|[1-9]\d*))?)(\):)$/gm;

export const assertSupportedReleaseVersion = (version) => {
  if (!supportedVersionPattern.test(version)) {
    throw new Error(
      `The 2.x release synchronizer does not support version ${version}`
    );
  }
};

export const syncVersionedDocumentation = (text, version, previousVersion) => {
  assertSupportedReleaseVersion(version);
  assertSupportedReleaseVersion(previousVersion);

  let synchronized = text.replaceAll(previousVersion, version);
  if (!version.includes("-rc.")) {
    synchronized = synchronized
      .replaceAll(
        "react-native-nitro-geolocation@rc",
        "react-native-nitro-geolocation"
      )
      .replaceAll("2.0 RC", "2.0")
      .replace(
        /React Native Nitro Geolocation 2\.0 is currently a \*\*release candidate\*\*\.[\s\S]*?(?=Pin the repository)/,
        "React Native Nitro Geolocation 2.0 is the stable release line. Validate the\nexact devices, native dependencies, and features your application ships.\n\n## Release policy\n\n- Stable 2.x releases preserve the documented public contracts; incompatible\n  changes require a new major version.\n- Pin exact dependency versions and retain your application's release evidence.\n- The default site documents 2.x. The 1.x snapshot remains under `/v1/`.\n- A stable package is staged under `ga-candidate` until matching native release\n  artifacts pass verification and the release is promoted to `latest`.\n\n"
      )
      .replace(
        /> \*\*2\.0 release candidate:\*\*[\s\S]*?\[unversioned documentation\]\(https:\/\/react-native-nitro-geolocation\.pages\.dev\/\)\./,
        "> **2.0:** this README documents the stable 2.x contracts. Use the\n> [2.x documentation](https://react-native-nitro-geolocation.pages.dev/) or\n> the [1.x archive](https://react-native-nitro-geolocation.pages.dev/v1/)."
      )
      .replaceAll("2.0 release candidate", "2.0 release")
      .replaceAll("2.0 release-candidate", "2.0")
      .replaceAll(
        "release-candidate documentation; pin the RC before evaluating it",
        "2.x documentation; pin exact versions when validating your application"
      )
      .replaceAll("release-candidate issues", "release issues")
      .replaceAll("RC stability policy", "release policy")
      .replaceAll("RC-policy", "release-policy")
      .replaceAll("RC policy", "release policy")
      .replaceAll("Evaluate the RC for release", "Evaluate release readiness")
      .replaceAll("RC expectations", "Release expectations")
      .replaceAll("Install an exact RC", "Install an exact version")
      .replaceAll("before adopting the RC", "before adopting 2.0")
      .replaceAll("Install an RC", "Install the stable release")
      .replaceAll(
        "Use `@rc` to evaluate the latest release candidate:",
        "Install the stable release from npm:"
      )
      .replace(
        /Release candidates may still receive contract fixes before 2\.0 stable\. Do not\nsilently follow the moving `@rc` tag in a production lockfile\. Keep a tested\n1\.x rollback branch until the/,
        "Stable 2.x releases preserve the documented public contracts. Pin exact\nversions in a production lockfile. Keep a tested 1.x rollback branch until the"
      )
      .replaceAll(
        "Pin the RC rather than following a moving tag",
        "Pin an exact version rather than following a moving tag"
      )
      .replaceAll("/v2/", "/");
  }

  return synchronized;
};

export const syncVersionedNavigation = (text, version) => {
  assertSupportedReleaseVersion(version);
  if (version.includes("-rc.")) return text;
  const navigation = JSON.parse(text);
  for (const item of navigation) {
    if (item.text === "2.0 RC") {
      item.text = "2.0";
      item.tag = undefined;
    }
    if (item.text === "1.x stable") {
      item.text = "1.x archive";
      item.link = "https://react-native-nitro-geolocation.pages.dev/v1/";
    }
  }
  return `${JSON.stringify(navigation, null, 2)}\n`;
};

export const readPodfileLockVersion = (text) => {
  const matches = [...text.matchAll(podVersionPattern)];
  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one NitroGeolocation Podfile.lock version, found ${matches.length}`
    );
  }

  return matches[0][2];
};

export const syncPodfileLockVersion = (text, version) => {
  assertSupportedReleaseVersion(version);
  readPodfileLockVersion(text);

  return text.replace(podVersionPattern, `$1${version}$3`);
};
