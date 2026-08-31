const { app, BrowserWindow } = require("electron");

app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("no-sandbox");

const run = async () => {
  const url = process.env.ROZENITE_E2E_URL;
  if (!url) throw new Error("ROZENITE_E2E_URL is required");

  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: false
    }
  });
  window.webContents.on("console-message", (_event, ...args) => {
    const message =
      typeof args[0] === "object" && args[0] !== null
        ? args[0].message
        : args[1];
    if (message?.startsWith("[ROZENITE_E2E_CASE]")) {
      process.stdout.write(`${message}\n`);
    }
  });
  await window.loadURL(url);
  const result = await window.webContents.executeJavaScript(
    "window.runE2E()",
    true
  );
  process.stdout.write(`${JSON.stringify(result)}\n`);
  window.destroy();
};

app
  .whenReady()
  .then(run)
  .then(
    () => app.quit(),
    (error) => {
      console.error(error);
      process.exitCode = 1;
      app.quit();
    }
  );
