import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import net from "node:net";
import path from "node:path";
import { createInterface } from "node:readline";
import test from "node:test";

const supervisor = path.resolve(
  import.meta.dirname,
  "../examples/v0.81.1/scripts/run-owned-process.mjs"
);
// These Bash harnesses use POSIX process groups; keep release tests usable on Windows.
const skipProcessGroups = process.platform === "win32";

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error.code === "ESRCH") return false;
    throw error;
  }
}

for (const ignoreTermination of [false, true]) {
  test(
    `owned server descendants stop (ignore TERM: ${ignoreTermination})`,
    {
      timeout: 10000,
      skip: skipProcessGroups
    },
    async (t) => {
      const unrelated = net.createServer();
      unrelated.listen(0, "127.0.0.1");
      await once(unrelated, "listening");
      t.after(() => unrelated.close());

      const serverSource = `
      const net = require('node:net');
      if (${ignoreTermination}) process.on('SIGTERM', () => {});
      const server = net.createServer();
      server.listen(0, '127.0.0.1', () => {
        console.log(JSON.stringify({pid: process.pid, port: server.address().port}));
      });
    `;
      const parentSource = `
      const {spawn} = require('node:child_process');
      console.log(JSON.stringify({parent: process.pid}));
      spawn(process.execPath, ['-e', ${JSON.stringify(serverSource)}], {stdio:'inherit'});
      setInterval(() => {}, 1000);
    `;
      const owner = spawn(
        process.execPath,
        [supervisor, process.execPath, "-e", parentSource],
        {
          stdio: ["ignore", "pipe", "pipe"]
        }
      );
      const exit = once(owner, "exit");
      let stderr = "";
      owner.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
      t.after(() => owner.kill("SIGTERM"));
      const lines = createInterface({ input: owner.stdout });
      const iterator = lines[Symbol.asyncIterator]();
      const { parent } = JSON.parse((await iterator.next()).value);
      const { pid, port } = JSON.parse((await iterator.next()).value);
      assert.ok(isAlive(parent));
      assert.ok(isAlive(pid));
      const started = Date.now();
      owner.kill("SIGTERM");
      const [code] = await exit;
      assert.equal(code, 0, stderr);
      assert.ok(Date.now() - started < 5000, "Cleanup must be bounded");
      assert.equal(isAlive(parent), false);
      assert.equal(isAlive(pid), false);

      // Binding the same address proves the former descendant released its port.
      const probe = net.createServer();
      probe.listen(port, "127.0.0.1");
      await once(probe, "listening");
      await new Promise((resolve) => probe.close(resolve));
      assert.equal(unrelated.listening, true);
    }
  );
}

test(
  "a failed server command preserves its exit status",
  { timeout: 5000, skip: skipProcessGroups },
  async () => {
    const owner = spawn(
      process.execPath,
      [supervisor, process.execPath, "-e", "process.exit(7)"],
      {
        stdio: "ignore"
      }
    );
    const [code] = await once(owner, "exit");
    assert.equal(code, 7);
  }
);
