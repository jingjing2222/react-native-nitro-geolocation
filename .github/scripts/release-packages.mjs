#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const baseBranch = process.env.BASE_BRANCH ?? "main";
const remote = process.env.BASE_REMOTE ?? "origin";
const baseRef = `${remote}/${baseBranch}`;
const releaseBranch = "changeset-release/main";
const releaseTitle = "chore: version packages";

const releasePackages = [
  {
    packageName: "react-native-nitro-geolocation",
    packageDir: "packages/react-native-nitro-geolocation"
  },
  {
    packageName: "@react-native-nitro-geolocation/rozenite-plugin",
    packageDir: "packages/rozenite-devtools-plugin"
  }
];

function run(command, args, options = {}) {
  console.log(`$ ${[command, ...args].join(" ")}`);
  execFileSync(command, args, {
    stdio: "inherit",
    env: { ...process.env, ...options.env }
  });
}

function output(command, args) {
  return execFileSync(command, args, {
    encoding: "utf8",
    env: process.env
  }).trim();
}

function hasStatusChanges() {
  return output("git", ["status", "--porcelain"]).length > 0;
}

function configureGit() {
  run("git", ["config", "user.name", "github-actions[bot]"]);
  run("git", [
    "config",
    "user.email",
    "github-actions[bot]@users.noreply.github.com"
  ]);
}

function readChangesets() {
  const changesetDir = path.resolve(".changeset");
  return readdirSync(changesetDir)
    .filter((file) => file.endsWith(".md") && file !== "README.md")
    .map((file) => {
      const content = readFileSync(path.join(changesetDir, file), "utf8");
      const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (!match) {
        throw new Error(`Could not find changeset frontmatter in ${file}`);
      }

      const releases = match[1]
        .split(/\r?\n/)
        .map((line) =>
          line.match(/^\s*['"]?(.+?)['"]?\s*:\s*(major|minor|patch|none)\s*$/)
        )
        .filter(Boolean)
        .map((lineMatch) => ({
          name: lineMatch[1],
          type: lineMatch[2]
        }));

      return { file, releases };
    });
}

function hasPendingChangesets() {
  return readChangesets().length > 0;
}

function createOrUpdatePullRequest() {
  const body = [
    "This PR versions packages from pending changesets.",
    "",
    "Merge this PR to publish updated package versions from `release.yml` with npm trusted publishing."
  ].join("\n");

  const openPrs = JSON.parse(
    output("gh", [
      "pr",
      "list",
      "--head",
      releaseBranch,
      "--base",
      baseBranch,
      "--state",
      "open",
      "--json",
      "number"
    ]) || "[]"
  );

  if (openPrs.length > 0) {
    run("gh", [
      "pr",
      "edit",
      String(openPrs[0].number),
      "--title",
      releaseTitle,
      "--body",
      body
    ]);
    return;
  }

  run("gh", [
    "pr",
    "create",
    "--base",
    baseBranch,
    "--head",
    releaseBranch,
    "--title",
    releaseTitle,
    "--body",
    body
  ]);
}

function createReleasePullRequest() {
  configureGit();
  run("git", ["fetch", remote, baseBranch, "--tags"]);

  if (!hasPendingChangesets()) {
    console.log("No pending changesets. Skipping version PR.");
    return;
  }

  run("git", ["switch", "-C", releaseBranch, baseRef]);
  run("yarn", ["changeset", "version"]);

  if (!hasStatusChanges()) {
    console.log("No version changes generated.");
    return;
  }

  run("git", ["add", "-A"]);
  run("git", ["commit", "-m", releaseTitle]);
  run("git", ["push", "--force-with-lease", remote, releaseBranch]);
  createOrUpdatePullRequest();
  run("git", ["switch", "--detach", baseRef]);
}

function parseTag(tag) {
  const separator = tag.lastIndexOf("@");
  if (separator <= 0) {
    return null;
  }

  return {
    packageName: tag.slice(0, separator),
    version: tag.slice(separator + 1)
  };
}

function getReleaseNotes(packageDir, version) {
  const changelog = readFileSync(path.join(packageDir, "CHANGELOG.md"), "utf8");
  const lines = changelog.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `## ${version}`);

  if (start === -1) {
    return `Release ${version}`;
  }

  const end = lines.findIndex(
    (line, index) => index > start && line.startsWith("## ")
  );

  return lines
    .slice(start, end === -1 ? undefined : end)
    .join("\n")
    .trim();
}

function createOrUpdateGitHubRelease(tag) {
  const parsed = parseTag(tag);
  const releasePackage = releasePackages.find(
    (candidate) => candidate.packageName === parsed?.packageName
  );

  if (!parsed || !releasePackage) {
    console.log(`Skipping GitHub release for unrecognized tag ${tag}.`);
    return;
  }

  const tempDir = mkdtempSync(path.join(tmpdir(), "release-notes-"));
  const notesPath = path.join(tempDir, "notes.md");
  writeFileSync(
    notesPath,
    getReleaseNotes(releasePackage.packageDir, parsed.version)
  );

  const existingRelease = spawnSync("gh", ["release", "view", tag], {
    stdio: "ignore",
    env: process.env
  });

  if (existingRelease.status === 0) {
    run("gh", [
      "release",
      "edit",
      tag,
      "--title",
      tag,
      "--notes-file",
      notesPath
    ]);
    return;
  }

  run("gh", [
    "release",
    "create",
    tag,
    "--title",
    tag,
    "--notes-file",
    notesPath
  ]);
}

function publishUnpublishedPackages() {
  configureGit();
  run("git", ["fetch", remote, baseBranch, "--tags"]);
  run("git", ["switch", "--detach", baseRef]);

  if (hasPendingChangesets()) {
    console.log(
      "Pending changesets found. Skipping publish until the version PR is merged."
    );
    return;
  }

  const tagsBefore = new Set(
    output("git", ["tag", "--list"]).split("\n").filter(Boolean)
  );
  run("yarn", ["changeset", "publish"]);
  const tagsAfter = output("git", ["tag", "--list"])
    .split("\n")
    .filter(Boolean);
  const newTags = tagsAfter.filter((tag) => !tagsBefore.has(tag));

  if (newTags.length === 0) {
    console.log("No new package tags were created.");
    return;
  }

  run("git", [
    "push",
    remote,
    ...newTags.map((tag) => `refs/tags/${tag}:refs/tags/${tag}`)
  ]);

  for (const tag of newTags) {
    createOrUpdateGitHubRelease(tag);
  }
}

function checkReleasePlan() {
  const changesets = readChangesets();
  if (changesets.length === 0) {
    console.log("No pending changesets.");
    return;
  }

  for (const changeset of changesets) {
    const releases = changeset.releases.map(
      (release) => `${release.name}@${release.type}`
    );
    console.log(`${changeset.file}: ${releases.join(", ") || "empty"}`);
  }
}

const command = process.argv[2];

switch (command) {
  case "version-prs":
    createReleasePullRequest();
    break;
  case "publish":
    publishUnpublishedPackages();
    break;
  case "check":
    checkReleasePlan();
    break;
  default:
    throw new Error("Usage: release-packages.mjs <version-prs|publish|check>");
}
