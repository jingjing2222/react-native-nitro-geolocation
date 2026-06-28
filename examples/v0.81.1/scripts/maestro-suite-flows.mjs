#!/usr/bin/env node
import { readFileSync } from "node:fs";

const [suitePath, platformArg] = process.argv.slice(2);

if (!suitePath || !platformArg) {
  console.error("Usage: maestro-suite-flows.mjs <suite.yaml> <android|ios>");
  process.exit(2);
}

const targetPlatform = platformArg.toLowerCase();
const lines = readFileSync(suitePath, "utf8").split(/\r?\n/);

function parseEnvGuard(expression) {
  const trimmed = expression.trim();
  if (trimmed === "true") {
    return true;
  }
  if (trimmed === "false") {
    return false;
  }

  const match = trimmed.match(
    /^\$\{\s*([A-Z0-9_]+)\s*==\s*['"]([^'"]+)['"]\s*\}$/
  );
  if (!match) {
    throw new Error(`Unsupported Maestro runFlow guard: ${expression}`);
  }

  const [, name, expected] = match;
  return (process.env[name] ?? "") === expected;
}

function shouldInclude(entry) {
  if (entry.platform && entry.platform.toLowerCase() !== targetPlatform) {
    return false;
  }
  if (entry.trueExpression && !parseEnvGuard(entry.trueExpression)) {
    return false;
  }
  return true;
}

const entries = [];
let current = null;

function flush() {
  if (current?.file) {
    entries.push(current);
  }
  current = null;
}

for (const line of lines) {
  const direct = line.match(/^- runFlow:\s*(\S+\.ya?ml)\s*$/);
  if (direct) {
    flush();
    entries.push({ file: direct[1] });
    continue;
  }

  if (/^- runFlow:\s*$/.test(line)) {
    flush();
    current = {};
    continue;
  }

  if (!current) {
    continue;
  }

  const file = line.match(/^\s+file:\s*(\S+\.ya?ml)\s*$/);
  if (file) {
    current.file = file[1];
    continue;
  }

  const platform = line.match(/^\s+platform:\s*(\S+)\s*$/);
  if (platform) {
    current.platform = platform[1];
    continue;
  }

  const trueExpression = line.match(/^\s+true:\s*(.+?)\s*$/);
  if (trueExpression) {
    current.trueExpression = trueExpression[1];
  }
}

flush();

for (const entry of entries) {
  if (shouldInclude(entry)) {
    console.log(entry.file);
  }
}
