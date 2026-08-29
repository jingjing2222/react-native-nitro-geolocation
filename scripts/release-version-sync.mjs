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
      .replaceAll("2.0 RC", "2.0");
  }

  return synchronized;
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
