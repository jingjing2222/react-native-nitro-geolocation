import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createWriteStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const example = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const device = process.env.IOS_UDID;
assert.ok(
  device,
  "Set IOS_UDID to a booted simulator with the Release example installed"
);
const output = path.resolve(
  process.env.EVIDENCE_DIR ?? "evidence/issue-224-e2e"
);
const appId = "nitrogeolocation.example";
const appPath = process.env.IOS_APP_PATH;
assert.ok(
  appPath,
  "Set IOS_APP_PATH to the built Release .app (installed with clean data)"
);
const env = {
  ...process.env,
  DEVELOPER_DIR:
    process.env.DEVELOPER_DIR ?? "/Applications/Xcode.app/Contents/Developer"
};

async function command(binary, args, logName) {
  const log = createWriteStream(path.join(output, logName));
  const child = spawn(binary, args, { env, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.pipe(log);
  child.stderr.pipe(log);
  const [code] = await once(child, "exit");
  log.end();
  assert.equal(code, 0, `${binary} failed (${code}); see ${logName}`);
}
const simctl = (...args) =>
  command("xcrun", ["simctl", ...args], `simctl-${args[0]}.log`);

async function until(predicate, timeout, message) {
  const deadline = Date.now() + timeout;
  while (!predicate() && Date.now() < deadline) await delay(100);
  assert.ok(predicate(), message);
}

// This is an app E2E: Maestro drives the real RN UI; simctl supplies CoreLocation
// coordinates. A host collector proves JS ran BEFORE the app returns foreground.
test(
  "#224: modern watch delivers two fresh locations while backgrounded with pre-granted Always",
  { timeout: 240_000 },
  async () => {
    await mkdir(output, { recursive: true });
    const events = [];
    const injections = [];
    let verdict = null;
    let resumedAt = null;
    const server = http.createServer(async (request, response) => {
      if (request.method === "POST" && request.url === "/events") {
        const chunks = [];
        for await (const chunk of request) chunks.push(chunk);
        try {
          events.push({
            ...JSON.parse(Buffer.concat(chunks).toString()),
            receivedAt: Date.now()
          });
          response.writeHead(204).end();
        } catch {
          response.writeHead(400).end();
        }
      } else if (request.url === "/result" && verdict) {
        response
          .writeHead(200, { "Content-Type": "application/json" })
          .end(JSON.stringify(verdict));
      } else response.writeHead(404).end();
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const port = String(server.address().port);
    const maestro = (flow) =>
      command(
        process.env.MAESTRO ?? "maestro",
        [
          "--device",
          device,
          "test",
          "--platform",
          "ios",
          "-e",
          `COLLECTOR_PORT=${port}`,
          "--test-output-dir",
          path.join(output, `maestro-${flow}`),
          path.join(example, ".maestro/issue-224", `${flow}.yaml`)
        ],
        `maestro-${flow}.log`
      );
    let recording;
    try {
      await simctl("uninstall", device, appId).catch(() => {});
      await simctl("install", device, path.resolve(appPath));
      await simctl("privacy", device, "grant", "location-always", appId);
      await simctl("location", device, "set", "37.5665,126.9780");
      recording = spawn(
        "xcrun",
        [
          "simctl",
          "io",
          device,
          "recordVideo",
          "--codec=h264",
          "--force",
          path.join(output, "watch-background.mp4")
        ],
        { env, stdio: "ignore" }
      );
      await maestro("start");
      assert.ok(
        events.some(
          (event) =>
            event.type === "permission" &&
            event.before.scope === "background" &&
            event.after === "granted"
        ),
        "Always permission must precede requestPermission"
      );
      assert.ok(
        events.some(
          (event) =>
            event.type === "position" &&
            event.state === "active" &&
            Math.abs(event.latitude - 37.5665) < 0.0001 &&
            Math.abs(event.longitude - 126.978) < 0.0001
        ),
        "Watch must first work in the foreground"
      );
      await until(
        () =>
          events.some(
            (event) => event.type === "state" && event.state === "background"
          ),
        10_000,
        "App did not enter background"
      );
      // Let the normal foreground-to-background grace period expire. No app timer,
      // background task, separate background API, or debugger keeps the app alive.
      await delay(20_000);
      for (const [latitude, longitude] of [
        [37.57, 126.982],
        [37.575, 126.987]
      ]) {
        const injectedAt = Date.now();
        injections.push({ latitude, longitude, injectedAt });
        await simctl("location", device, "set", `${latitude},${longitude}`);
        await delay(10_000);
      }
      const frozenAt = Date.now();
      const backgroundAt = events.find(
        (event) => event.type === "state" && event.state === "background"
      ).receivedAt;
      assert.ok(
        !events.some(
          (event) =>
            event.type === "state" &&
            event.state === "active" &&
            event.receivedAt > backgroundAt
        ),
        "App returned foreground before proof was frozen"
      );
      const matches = injections.map((point) =>
        events.find(
          (event) =>
            event.type === "position" &&
            event.state === "background" &&
            Math.abs(event.latitude - point.latitude) < 0.0001 &&
            Math.abs(event.longitude - point.longitude) < 0.0001 &&
            event.measuredAt >= point.injectedAt &&
            event.sentAt >= point.injectedAt &&
            event.receivedAt >= point.injectedAt &&
            event.receivedAt <= frozenAt
        )
      );
      const passed =
        matches.every(Boolean) && matches[0].receivedAt < matches[1].receivedAt;
      verdict = {
        passed,
        frozenAt,
        message: `${matches.filter(Boolean).length}/2 fresh route callbacks received before resume`
      };
      console.log(JSON.stringify(verdict));
      // Freeze BEFORE launching Maestro again: startup itself must not rescue proof.
      resumedAt = Date.now();
      let verificationError;
      try {
        await maestro("verify");
      } catch (error) {
        verificationError = error;
      }
      assert.ok(passed, verdict.message);
      if (verificationError) throw verificationError;
    } finally {
      await simctl(
        "io",
        device,
        "screenshot",
        path.join(output, "result.png")
      ).catch(() => {});
      if (recording && recording.exitCode === null) {
        const stopped = once(recording, "exit");
        recording.kill("SIGINT");
        await stopped;
      }
      await writeFile(
        path.join(output, "proof.json"),
        JSON.stringify({ verdict, resumedAt, injections, events }, null, 2)
      );
      await simctl("terminate", device, appId).catch(() => {});
      await simctl("location", device, "clear").catch(() => {});
      server.closeAllConnections();
      server.close();
    }
  }
);
