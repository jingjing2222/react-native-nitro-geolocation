import { spawn } from "node:child_process";
import { readFileSync, readdirSync, realpathSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";

export function parseLinuxProcessStat(stat) {
  // comm can contain spaces and ')': fields start after its final delimiter.
  const pid = /^(\d+) \(/.exec(stat)?.[1];
  const fields = stat
    .slice(stat.lastIndexOf(")") + 1)
    .trim()
    .split(/\s+/);
  if (
    !pid ||
    !/^[A-Za-z]$/.test(fields[0]) ||
    !/^\d+$/.test(fields[1]) ||
    !/^\d+$/.test(fields[2]) ||
    !/^\d+$/.test(fields[17])
  )
    return null;
  const result = {
    pid: Number(pid),
    state: fields[0],
    group: Number(fields[2]),
    threads: Number(fields[17])
  };
  return [result.pid, result.group, result.threads].every(Number.isSafeInteger)
    ? result
    : null;
}

export function hasLiveLinuxGroupMembers(
  group,
  { list = readdirSync, read = readFileSync } = {}
) {
  // kill(group, 0) includes unreaped zombies. Only a complete /proc observation
  // can override that result; unavailable or ambiguous observations fail closed.
  try {
    const pids = new Set(list("/proc").filter((entry) => /^\d+$/.test(entry)));
    let observedGroup = false;
    for (const pid of pids) {
      let stat;
      try {
        stat = parseLinuxProcessStat(read(`/proc/${pid}/stat`, "utf8"));
      } catch (error) {
        if (error.code === "ENOENT" || error.code === "ESRCH") continue;
        return true;
      }
      if (!stat || stat.pid !== Number(pid)) return true;
      if (stat.group !== group) continue;
      observedGroup = true;
      // A zombie leader can still have live sibling threads.
      if (!["Z", "X", "x"].includes(stat.state) || stat.threads > 1)
        return true;
    }
    // A descendant forked during the snapshot must not escape observation.
    if (
      list("/proc").some((entry) => /^\d+$/.test(entry) && !pids.has(entry))
    ) {
      return true;
    }
    return !observedGroup;
  } catch {
    return true;
  }
}

function supervise(command, args) {
  if (!command) throw new Error("Expected a command to supervise.");
  // detached creates a new POSIX process group containing only this invocation's
  // server and descendants. Never discover or kill processes by port or name.
  const child = spawn(command, args, { detached: true, stdio: "inherit" });
  let stopping = false;

  function signalGroup(signal) {
    if (!child.pid) return false;
    try {
      process.kill(-child.pid, signal);
      return true;
    } catch (error) {
      if (error.code === "ESRCH") return false;
      // Existence probes can return EPERM while a group is exiting on macOS.
      if (signal === 0 && error.code === "EPERM") return true;
      throw error;
    }
  }

  function groupIsAlive() {
    return (
      signalGroup(0) &&
      (process.platform !== "linux" || hasLiveLinuxGroupMembers(child.pid))
    );
  }

  async function waitForGroupExit() {
    const deadline = Date.now() + 1500;
    while (groupIsAlive() && Date.now() < deadline) await delay(50);
    return !groupIsAlive();
  }

  async function stop(exitCode) {
    if (stopping) return;
    stopping = true;
    signalGroup("SIGTERM");
    if (!(await waitForGroupExit())) {
      signalGroup("SIGKILL");
      if (!(await waitForGroupExit())) {
        console.error("Owned server process group did not exit after SIGKILL.");
        exitCode = 1;
      }
    }
    process.exit(exitCode);
  }

  process.on("SIGTERM", () => void stop(0));
  process.on("SIGINT", () => void stop(130));
  child.on("error", (error) => {
    console.error(error.message);
    void stop(1);
  });
  child.on("exit", (code) => void stop(code ?? 1));
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
) {
  const [command, ...args] = process.argv.slice(2);
  supervise(command, args);
}
