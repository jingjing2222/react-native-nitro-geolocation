const stableVersionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export const defaultCandidateTag = "ga-candidate";
export const protectedPackageName = "react-native-nitro-geolocation";

export const isStableVersion = (version) => stableVersionPattern.test(version);

export const assertCandidateTag = (candidateTag) => {
  if (
    candidateTag.length === 0 ||
    candidateTag !== candidateTag.trim() ||
    /\s/.test(candidateTag)
  ) {
    throw new Error("The GA candidate tag must be a non-empty npm tag");
  }
  if (candidateTag === "latest") {
    throw new Error("The GA candidate tag must never be latest");
  }
};

export const resolvePublishTag = (
  release,
  candidateTag = process.env.NITRO_GEOLOCATION_GA_CANDIDATE_TAG ??
    defaultCandidateTag
) => {
  assertCandidateTag(candidateTag);

  if (
    release.name === protectedPackageName &&
    release.tag === "latest" &&
    isStableVersion(release.version)
  ) {
    return candidateTag;
  }

  return release.tag;
};

export const assertPromotableVersion = (version) => {
  if (!isStableVersion(version)) {
    throw new Error(
      `Only an exact stable x.y.z version can be promoted to latest: ${version}`
    );
  }
};

export const compareStableVersions = (left, right) => {
  assertPromotableVersion(left);
  assertPromotableVersion(right);

  const leftParts = left.split(".").map((part) => BigInt(part));
  const rightParts = right.split(".").map((part) => BigInt(part));

  for (let index = 0; index < leftParts.length; index += 1) {
    if (leftParts[index] > rightParts[index]) return 1;
    if (leftParts[index] < rightParts[index]) return -1;
  }
  return 0;
};
