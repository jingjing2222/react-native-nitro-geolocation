import { execFileSync } from "node:child_process";
import {
  assertCandidateTag,
  assertPromotableVersion,
  compareStableVersions,
  defaultCandidateTag,
  protectedPackageName
} from "./release-policy.mjs";

const packageName = protectedPackageName;
const registry = "https://registry.npmjs.org";
const version = process.argv[2];
const dryRun = process.argv.includes("--dry-run");
const candidateTag =
  process.env.NITRO_GEOLOCATION_GA_CANDIDATE_TAG ?? defaultCandidateTag;

if (version === undefined) {
  throw new Error("Usage: node scripts/promote-latest.mjs <x.y.z> [--dry-run]");
}
assertPromotableVersion(version);
assertCandidateTag(candidateTag);

const npmView = (...args) =>
  execFileSync("npm", ["view", ...args, "--registry", registry, "--json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"]
  }).trim();

const publishedVersion = JSON.parse(
  npmView(`${packageName}@${version}`, "version")
);
if (publishedVersion !== version) {
  throw new Error(
    `npm does not resolve ${packageName}@${version} to the requested version`
  );
}

const publishedGitHead = JSON.parse(
  npmView(`${packageName}@${version}`, "gitHead")
);
const checkedOutGitHead = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"]
}).trim();
if (publishedGitHead !== checkedOutGitHead) {
  throw new Error(
    `npm gitHead ${publishedGitHead ?? "is missing"}; expected release commit ${checkedOutGitHead}`
  );
}

const distTags = JSON.parse(npmView(packageName, "dist-tags"));
if (distTags[candidateTag] !== version) {
  throw new Error(
    `${candidateTag} points to ${distTags[candidateTag] ?? "nothing"}, not ${version}`
  );
}

const currentLatest = distTags.latest;
if (currentLatest !== undefined) {
  assertPromotableVersion(currentLatest);
  if (compareStableVersions(version, currentLatest) < 0) {
    throw new Error(
      `Refusing to move latest backwards from ${currentLatest} to ${version}`
    );
  }
}

if (dryRun) {
  console.log(`Would promote ${packageName}@${version} to latest.`);
  process.exit(0);
}

execFileSync(
  "npm",
  [
    "dist-tag",
    "add",
    `${packageName}@${version}`,
    "latest",
    "--registry",
    registry
  ],
  {
    stdio: "inherit"
  }
);

const updatedTags = JSON.parse(npmView(packageName, "dist-tags"));
if (updatedTags.latest !== version) {
  throw new Error(`latest promotion verification failed for ${version}`);
}

console.log(`Promoted ${packageName}@${version} to latest.`);
