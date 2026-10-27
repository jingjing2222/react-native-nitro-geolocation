#!/usr/bin/env python3
"""Install a real consumer APK, reboot an emulator, and check the OS-delivered boot receiver."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import time

APP = "com.nitrogeolocation.boote2e"
RECEIVER = "com.margelo.nitro.nitrogeolocation.background.NitroBootReceiver"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("apk", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    adb = [os.environ.get("ADB", "adb")]
    if os.environ.get("ANDROID_SERIAL"):
        adb += ["-s", os.environ["ANDROID_SERIAL"]]

    def command(*parts, check=True, timeout=30):
        return subprocess.run(adb + list(parts), capture_output=True, text=True, check=check, timeout=timeout).stdout.strip()

    def save(name, *parts):
        value = command(*parts, check=False)
        (args.output / name).write_text(value + "\n")
        return value

    result = {"apk": str(args.apk), "passed": False}
    try:
        if command("shell", "getprop", "ro.kernel.qemu") != "1":
            raise RuntimeError("This test only reboots an emulator, never a physical device")
        result["api"] = command("shell", "getprop", "ro.build.version.sdk")
        result["fingerprint"] = command("shell", "getprop", "ro.build.fingerprint")
        command("uninstall", APP, check=False)
        command("install", str(args.apk.resolve()), timeout=120)
        package = save("package-before.txt", "shell", "dumpsys", "package", APP)
        if RECEIVER not in package:
            raise RuntimeError("Production boot receiver is missing from the installed package")
        save("launch-before.txt", "shell", "am", "start", "-W", "-n", APP + "/.MainActivity")
        command("shell", "input", "keyevent", "KEYCODE_HOME")
        # PackageManager persists stopped/notLaunched asynchronously. A reboot immediately
        # after first launch can otherwise restore the stale stopped=true state from disk.
        time.sleep(15)
        command("shell", "sync")
        package = save("package-armed.txt", "shell", "dumpsys", "package", APP)
        if "stopped=false" not in package:
            raise RuntimeError("Consumer is force-stopped; Android would skip its boot receiver")
        result["bootBefore"] = command("shell", "cat", "/proc/sys/kernel/random/boot_id")
        command("logcat", "-b", "all", "-c")
        command("reboot")
        deadline = time.monotonic() + 180
        while time.monotonic() < deadline:
            try:
                if command("shell", "getprop", "sys.boot_completed", check=False, timeout=5) == "1":
                    new_boot = command("shell", "cat", "/proc/sys/kernel/random/boot_id")
                    if new_boot != result["bootBefore"]:
                        result["bootAfter"] = new_boot
                        break
            except subprocess.TimeoutExpired:
                pass
            time.sleep(2)
        else:
            raise RuntimeError("Emulator did not complete a new boot within 180 seconds")

        command("shell", "input", "keyevent", "KEYCODE_MENU")
        # Require positive OS evidence that the real receiver ran, not just an empty crash buffer.
        deadline = time.monotonic() + 90
        while time.monotonic() < deadline:
            log = command("logcat", "-b", "all", "-d", "-v", "threadtime")
            delivered = any(APP in line and "for broadcast" in line and RECEIVER in line for line in log.splitlines())
            if delivered:
                result["receiverStarted"] = True
                break
            time.sleep(2)
        else:
            raise RuntimeError("No OS process-start evidence for the production boot receiver")
        time.sleep(15)
        crash = save("crash.txt", "logcat", "-b", "crash", "-d", "-v", "threadtime")
        if APP in crash:
            result["failure"] = "boot_job_without_constraints" if (
                "You're trying to build a job with no constraints" in crash
                and "NitroBootRestoreJobService" in crash
                and RECEIVER in crash
            ) else "unexpected_app_crash"
            raise RuntimeError(result["failure"])

        command("shell", "am", "start", "-S", "-W", "-n", APP + "/.MainActivity", "--ez", "verify_boot", "true")
        time.sleep(1)
        state = json.loads(command("shell", "run-as", APP, "cat", "files/boot-state.json"))
        result["state"] = state
        if state != {"pendingJobs": 0, "backgroundDatabase": False}:
            raise RuntimeError("Unused background feature created a job or background storage")
        result["passed"] = True
    except (RuntimeError, subprocess.SubprocessError, ValueError) as error:
        result.setdefault("failure", str(error))
    finally:
        for name, parts in {
            "logcat.txt": ("logcat", "-b", "all", "-d", "-v", "threadtime"),
            "crash-final.txt": ("logcat", "-b", "crash", "-d", "-v", "threadtime"),
            "broadcasts.txt": ("shell", "dumpsys", "activity", "broadcasts"),
            "jobscheduler.txt": ("shell", "dumpsys", "jobscheduler"),
        }.items():
            try:
                save(name, *parts)
            except subprocess.SubprocessError:
                pass
        try:
            screenshot = subprocess.run(adb + ["exec-out", "screencap", "-p"], capture_output=True, timeout=15)
            if screenshot.returncode == 0:
                (args.output / "screen.png").write_bytes(screenshot.stdout)
        except subprocess.SubprocessError:
            pass
        (args.output / "result.json").write_text(json.dumps(result, indent=2) + "\n")
        print(json.dumps(result, indent=2), flush=True)
    return 0 if result["passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
