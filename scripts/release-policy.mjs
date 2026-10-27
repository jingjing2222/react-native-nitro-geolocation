const stableVersionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export const protectedPackageName = "react-native-nitro-geolocation";

export const isStableVersion = (version) => stableVersionPattern.test(version);

export const resolvePublishTag = (release) => {
  if (
    release.name === protectedPackageName &&
    release.tag === "latest" &&
    !isStableVersion(release.version)
  ) {
    throw new Error("Only stable Geolocation releases can publish to latest");
  }

  return release.tag;
};
