#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const baseBranch = process.env.BASE_BRANCH ?? "main";
const remote = process.env.BASE_REMOTE ?? "origin";
const baseRef = `${remote}/${baseBranch}`;

const releaseGroups = [
  {
    id: "react-native-nitro-geolocation",
    packageName: "react-native-nitro-geolocation",
    packageDir: "packages/react-native-nitro-geolocation",
    branch: "changeset-release/react-native-nitro-geolocation",
    title: "chore: version react-native-nitro-geolocation",
    ignoredPackages: ["@react-native-nitro-geolocation/rozenite-plugin"]
  },
  {
    id: "rozenite-plugin",
    packageName: "@react-native-nitro-geolocation/rozenite-plugin",
    packageDir: "packages/rozenite-devtools-plugin",
    branch: "changeset-release/rozenite-plugin",
    title: "chore: version rozenite plugin",
    ignoredPackages: ["react-native-nitro-geolocation"]
  }
];

const releasePackageNames = new Set(
  releaseGroups.map((group) => group.packageName)
);

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

function getChangesetsByGroup() {
  const changesets = readChangesets();
  const byGroup = new Map(releaseGroups.map((group) => [group.id, []]));

  for (const changeset of changesets) {
    const independentlyReleasedPackages = changeset.releases
      .map((release) => release.name)
      .filter((name) => releasePackageNames.has(name));

    if (new Set(independentlyReleasedPackages).size > 1) {
      throw new Error(
        [
          `.changeset/${changeset.file} includes multiple independently released packages:`,
          `  ${independentlyReleasedPackages.join(", ")}`,
          "Split it into one changeset per package so release PRs can be generated independently."
        ].join("\n")
      );
    }

    for (const group of releaseGroups) {
      if (
        changeset.releases.some((release) => release.name === group.packageName)
      ) {
        byGroup.get(group.id).push(changeset);
      }
    }
  }

  return byGroup;
}

function readChangesetConfig() {
  return JSON.parse(readFileSync(".changeset/config.json", "utf8"));
}

function writeChangesetConfigForGroup(group) {
  const config = readChangesetConfig();
  config.ignore = [
    ...new Set([...(config.ignore ?? []), ...group.ignoredPackages])
  ];
  writeFileSync(
    ".changeset/config.json",
    `${JSON.stringify(config, null, 2)}\n`
  );
}

function createOrUpdatePullRequest(group) {
  const body = [
    `This PR versions \`${group.packageName}\` from its pending changesets.`,
    "",
    "Merge this PR to publish the package from `release.yml` with npm trusted publishing."
  ].join("\n");

  const openPrs = JSON.parse(
    output("gh", [
      "pr",
      "list",
      "--head",
      group.branch,
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
      group.title,
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
    group.branch,
    "--title",
    group.title,
    "--body",
    body
  ]);
}

function createReleasePullRequests() {
  configureGit();
  run("git", ["fetch", remote, baseBranch, "--tags"]);

  const changesetsByGroup = getChangesetsByGroup();

  for (const group of releaseGroups) {
    const groupChangesets = changesetsByGroup.get(group.id);
    if (groupChangesets.length === 0) {
      console.log(`No pending changesets for ${group.packageName}.`);
      continue;
    }

    run("git", ["switch", "-C", group.branch, baseRef]);
    writeChangesetConfigForGroup(group);
    run("yarn", ["changeset", "version"]);
    run("git", [
      "restore",
      "--source",
      baseRef,
      "--",
      ".changeset/config.json"
    ]);

    if (!hasStatusChanges()) {
      console.log(`No version changes generated for ${group.packageName}.`);
      continue;
    }

    run("git", ["add", "-A"]);
    run("git", ["commit", "-m", group.title]);
    run("git", ["push", "--force-with-lease", remote, group.branch]);
    createOrUpdatePullRequest(group);
  }

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
  const group = releaseGroups.find(
    (releaseGroup) => releaseGroup.packageName === parsed?.packageName
  );

  if (!parsed || !group) {
    console.log(`Skipping GitHub release for unrecognized tag ${tag}.`);
    return;
  }

  const tempDir = mkdtempSync(path.join(tmpdir(), "release-notes-"));
  const notesPath = path.join(tempDir, "notes.md");
  writeFileSync(notesPath, getReleaseNotes(group.packageDir, parsed.version));

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
  const changesetsByGroup = getChangesetsByGroup();
  for (const group of releaseGroups) {
    const files = changesetsByGroup
      .get(group.id)
      .map((changeset) => changeset.file);
    console.log(
      `${group.packageName}: ${files.length ? files.join(", ") : "none"}`
    );
  }
}

const command = process.argv[2];

switch (command) {
  case "version-prs":
    createReleasePullRequests();
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
