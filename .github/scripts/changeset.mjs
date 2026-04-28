#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const changesetBin = require.resolve("@changesets/cli/bin.js");
const splitChangesetsBin = fileURLToPath(
  new URL("./split-changesets.mjs", import.meta.url)
);
const args = process.argv.slice(2);

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    stdio: "inherit",
    env: process.env
  });

  if (result.error) {
    throw result.error;
  }

  if (result.signal) {
    process.kill(process.pid, result.signal);
    return;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function shouldSplitChangesets() {
  const command = args.find((arg) => !arg.startsWith("-"));
  return command === undefined || command === "add";
}

if (args.includes("--help") || args.includes("-h")) {
  run(process.execPath, [changesetBin, "--help"]);
  process.exit(0);
}

run(process.execPath, [changesetBin, ...args]);

if (shouldSplitChangesets()) {
  run(process.execPath, [splitChangesetsBin]);
}
