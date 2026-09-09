import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const [command, ...args] = process.argv.slice(2);
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
    throw error;
  }
}

async function waitForGroupExit() {
  const deadline = Date.now() + 1500;
  while (signalGroup(0) && Date.now() < deadline) await delay(50);
  return !signalGroup(0);
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
