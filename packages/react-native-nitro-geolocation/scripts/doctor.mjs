#!/usr/bin/env node

import process from "node:process";
import { formatReport, inspectProject } from "./doctor-core.mjs";

const HELP = `Usage: nitro-geolocation doctor [--project <path>] [--json]

Read and report React Native, Nitro, Android, and iOS setup issues.
The command never changes project files.
`;

function parseArguments(arguments_) {
  const result = { project: process.cwd(), json: false, help: false };
  const args = [...arguments_];

  if (args[0] === "doctor") args.shift();
  else if (args[0] && !args[0].startsWith("-")) {
    throw new Error(`Unknown command: ${args[0]}`);
  }

  while (args.length > 0) {
    const argument = args.shift();
    if (argument === "--json") result.json = true;
    else if (argument === "--help" || argument === "-h") result.help = true;
    else if (argument === "--project") {
      const project = args.shift();
      if (!project || project.startsWith("-")) {
        throw new Error("--project requires a path");
      }
      result.project = project;
    } else {
      throw new Error(`Unknown option: ${argument}`);
    }
  }
  return result;
}

try {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(HELP);
    process.exit(0);
  }
  const report = inspectProject(options.project);
  process.stdout.write(
    options.json
      ? `${JSON.stringify(report, undefined, 2)}\n`
      : formatReport(report)
  );
  process.exit(report.ok ? 0 : 1);
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n\n${HELP}`
  );
  process.exit(2);
}
