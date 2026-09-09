import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import test from "node:test";
import {
  hasLiveLinuxGroupMembers,
  parseLinuxProcessStat
} from "../examples/v0.81.1/scripts/run-owned-process.mjs";

const supervisor = path.resolve(
  import.meta.dirname,
  "../examples/v0.81.1/scripts/run-owned-process.mjs"
);
// These Bash harnesses use POSIX process groups; keep release tests usable on Windows.
const skipProcessGroups = process.platform === "win32";

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    if (process.platform === "linux") {
      const stat = parseLinuxProcessStat(
        readFileSync(`/proc/${pid}/stat`, "utf8")
      );
      assert.ok(stat, "Process state must be observable");
      return !["Z", "X", "x"].includes(stat.state) || stat.threads > 1;
    }
    return true;
  } catch (error) {
    if (error.code === "ESRCH" || error.code === "ENOENT") return false;
    throw error;
  }
}

function processStat(pid, state, group, { name = "node", threads = 1 } = {}) {
  // State is field 3, pgrp is field 5, and num_threads is field 20.
  return `${pid} (${name}) ${state} 1 ${group} ${Array(14).fill(0).join(" ")} ${threads} 0`;
}

function procFixture(records) {
  return {
    list: () => ["self", ...Object.keys(records)],
    read: (file) => {
      const record = records[file.split("/")[2]];
      if (record instanceof Error) throw record;
      return record;
    }
  };
}

test("Linux stat parsing handles spaces and parentheses in process names", () => {
  assert.deepEqual(
    parseLinuxProcessStat(processStat(42, "Z", 40, { name: "a ) (b)" })),
    {
      pid: 42,
      state: "Z",
      group: 40,
      threads: 1
    }
  );
  assert.equal(parseLinuxProcessStat("not a process stat"), null);
  assert.equal(parseLinuxProcessStat("42 (node) Z 1 40"), null);
});

test("Linux zombie-only groups are exited but mixed or multithreaded groups are live", () => {
  const records = {
    40: processStat(40, "Z", 40),
    41: processStat(41, "X", 40),
    42: processStat(42, "x", 40),
    50: processStat(50, "S", 50)
  };
  assert.equal(hasLiveLinuxGroupMembers(40, procFixture(records)), false);
  assert.equal(hasLiveLinuxGroupMembers(50, procFixture(records)), true);
  records[41] = processStat(41, "S", 40);
  assert.equal(hasLiveLinuxGroupMembers(40, procFixture(records)), true);
  records[41] = processStat(41, "Z", 40, { threads: 2 });
  assert.equal(hasLiveLinuxGroupMembers(40, procFixture(records)), true);
});

test("Linux group observations fail closed unless all remaining members are observed", () => {
  const zombie = processStat(40, "Z", 40);
  for (const code of ["ENOENT", "ESRCH"]) {
    assert.equal(
      hasLiveLinuxGroupMembers(
        40,
        procFixture({
          40: zombie,
          41: Object.assign(new Error("vanished"), { code })
        })
      ),
      false
    );
  }
  for (const record of [
    "malformed",
    Object.assign(new Error("denied"), { code: "EACCES" })
  ]) {
    assert.equal(
      hasLiveLinuxGroupMembers(40, procFixture({ 40: zombie, 41: record })),
      true
    );
  }
  assert.equal(
    hasLiveLinuxGroupMembers(40, procFixture({ 50: processStat(50, "S", 50) })),
    true
  );
  assert.equal(
    hasLiveLinuxGroupMembers(40, {
      list: () => {
        throw new Error("no /proc");
      }
    }),
    true
  );
  let snapshots = 0;
  assert.equal(
    hasLiveLinuxGroupMembers(40, {
      ...procFixture({ 40: zombie }),
      list: () => (++snapshots === 1 ? ["40"] : ["40", "41"])
    }),
    true
  );
});

test("Linux snapshots follow owned growth without waiting for unrelated PID churn", () => {
  function observe(records, snapshots) {
    let calls = 0;
    const alive = hasLiveLinuxGroupMembers(40, {
      ...procFixture(records),
      list: () => {
        const snapshot = snapshots[calls++];
        assert.ok(snapshot, "Unexpected additional snapshot");
        return snapshot;
      }
    });
    return { alive, calls };
  }
  const zombie = processStat(40, "Z", 40);
  assert.deepEqual(
    observe(
      {
        40: zombie,
        50: processStat(50, "S", 50)
      },
      [["40"], ["40", "50"]]
    ),
    { alive: false, calls: 2 }
  );
  assert.deepEqual(
    observe(
      {
        40: zombie,
        41: processStat(41, "S", 40)
      },
      [["40"], ["40", "41"]]
    ),
    { alive: true, calls: 2 }
  );
  assert.deepEqual(
    observe(
      {
        40: zombie,
        41: processStat(41, "Z", 40),
        42: processStat(42, "S", 40)
      },
      [["40"], ["40", "41"], ["40", "41", "42"]]
    ),
    { alive: true, calls: 3 }
  );
  assert.deepEqual(
    observe(
      {
        40: zombie,
        41: processStat(41, "Z", 40),
        50: processStat(50, "S", 50)
      },
      [["40"], ["40", "41"], ["40", "41", "50"]]
    ),
    { alive: false, calls: 3 }
  );
  assert.deepEqual(
    observe(
      {
        40: zombie,
        41: processStat(41, "Z", 40),
        42: processStat(42, "Z", 40)
      },
      [["40"], ["40", "41"], ["40", "41", "42"]]
    ),
    { alive: true, calls: 3 }
  );
});

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

test(
  "the supervisor CLI runs through a symlinked path",
  { timeout: 5000, skip: skipProcessGroups },
  async (t) => {
    const directory = mkdtempSync(path.join(tmpdir(), "owned-server-test-"));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const link = path.join(directory, "supervisor.mjs");
    symlinkSync(supervisor, link);
    const owner = spawn(
      process.execPath,
      [link, process.execPath, "-e", "process.exit(7)"],
      { stdio: "ignore" }
    );
    const [code] = await once(owner, "exit");
    assert.equal(code, 7);
  }
);
