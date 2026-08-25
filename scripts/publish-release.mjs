import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const dryRun = process.argv.includes("--dry-run");

const run = (command, args, { changesetsOutput = true } = {}) => {
  const env = { ...process.env };
  if (!changesetsOutput) {
    env.CHANGESETS_OUTPUT = "";
  }

  execFileSync(command, args, {
    cwd: process.cwd(),
    env,
    stdio: "inherit"
  });
};

const workspaceLocations = new Map(
  execFileSync("yarn", ["workspaces", "list", "--json"], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"]
  })
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line))
    .map((workspace) => [workspace.name, workspace.location])
);
const workDir = await mkdtemp(
  path.join(tmpdir(), "nitro-geolocation-publish-")
);
const planPath = path.join(workDir, "publish-plan.json");

try {
  run("yarn", ["changeset", "publish-plan", "--output", planPath], {
    changesetsOutput: false
  });

  const publishPlan = JSON.parse(await readFile(planPath, "utf8"));
  const releases = publishPlan.plan
    .flat()
    .filter((release) => release.kind === "publish");

  for (const release of releases) {
    const workspaceLocation = workspaceLocations.get(release.name);
    if (workspaceLocation === undefined) {
      throw new Error(`Release workspace not found: ${release.name}`);
    }

    const args = [
      "publish",
      path.resolve(workspaceLocation),
      "--access",
      release.access,
      "--tag",
      release.tag,
      "--registry",
      "https://registry.npmjs.org",
      "--loglevel",
      "warn"
    ];
    if (dryRun) {
      args.push("--dry-run");
    }
    run("npm", args);
  }

  if (!dryRun) {
    run("yarn", ["changeset", "git-tag"]);
  }
} finally {
  await rm(workDir, { recursive: true, force: true });
}
