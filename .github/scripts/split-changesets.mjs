#!/usr/bin/env node

import {
  existsSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import path from "node:path";

const changesetDir = path.resolve(".changeset");
const releaseGroups = [
  {
    packageName: "react-native-nitro-geolocation",
    changesetPrefix: "geolocation"
  },
  {
    packageName: "@react-native-nitro-geolocation/rozenite-plugin",
    changesetPrefix: "rozenite"
  }
];
const releaseGroupsByPackageName = new Map(
  releaseGroups.map((group) => [group.packageName, group])
);

function parseChangeset(file) {
  const filePath = path.join(changesetDir, file);
  const content = readFileSync(filePath, "utf8");
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(\r?\n[\s\S]*)?$/);

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

  return {
    file,
    body: match[2] ?? "\n",
    releases
  };
}

function stripReleasePrefix(file) {
  const baseName = path.basename(file, ".md");

  for (const group of releaseGroups) {
    const prefix = `${group.changesetPrefix}-`;
    if (baseName.startsWith(prefix)) {
      return baseName.slice(prefix.length);
    }
  }

  return baseName;
}

function createChangesetContent(releases, body) {
  return [
    "---",
    ...releases.map(
      (release) => `${JSON.stringify(release.name)}: ${release.type}`
    ),
    `---${body}`
  ].join("\n");
}

function writeChangeset(file, content, sourceFile) {
  const filePath = path.join(changesetDir, file);

  if (file !== sourceFile && existsSync(filePath)) {
    const existingContent = readFileSync(filePath, "utf8");
    if (existingContent !== content) {
      throw new Error(
        `Cannot split .changeset/${sourceFile}: .changeset/${file} already exists.`
      );
    }
  }

  writeFileSync(filePath, content);
}

function splitChangeset(changeset) {
  const groupedReleases = new Map();
  const ungroupedReleases = [];

  for (const release of changeset.releases) {
    const group = releaseGroupsByPackageName.get(release.name);

    if (!group) {
      ungroupedReleases.push(release);
      continue;
    }

    const releases = groupedReleases.get(group) ?? [];
    releases.push(release);
    groupedReleases.set(group, releases);
  }

  if (groupedReleases.size <= 1) {
    return false;
  }

  if (ungroupedReleases.length > 0) {
    throw new Error(
      [
        `Cannot split .changeset/${changeset.file}: it mixes independently released packages with ungrouped packages:`,
        `  ${ungroupedReleases.map((release) => release.name).join(", ")}`
      ].join("\n")
    );
  }

  const baseName = stripReleasePrefix(changeset.file);
  const splitFiles = [];

  for (const [group, releases] of groupedReleases) {
    const file = `${group.changesetPrefix}-${baseName}.md`;
    const content = createChangesetContent(releases, changeset.body);
    writeChangeset(file, content, changeset.file);
    splitFiles.push(file);
  }

  if (!splitFiles.includes(changeset.file)) {
    unlinkSync(path.join(changesetDir, changeset.file));
  }

  console.log(
    `Split .changeset/${changeset.file} into ${splitFiles
      .map((file) => `.changeset/${file}`)
      .join(", ")}.`
  );

  return true;
}

function splitChangesets() {
  if (!existsSync(changesetDir)) {
    return;
  }

  const changesets = readdirSync(changesetDir)
    .filter((file) => file.endsWith(".md") && file !== "README.md")
    .map(parseChangeset);

  for (const changeset of changesets) {
    splitChangeset(changeset);
  }
}

splitChangesets();
