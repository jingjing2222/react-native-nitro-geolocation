import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";

const PLUGIN_ID = "@react-native-nitro-geolocation/rozenite-plugin";
const EXPECTED_RUNTIME_VERSION = "2.2.0";
const REQUEST_TIMEOUT_MS = 120_000;
const E2E_TIMEOUT_MS = 30_000;

const getAvailablePort = () =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      assert(address && typeof address === "object");
      const { port } = address;
      server.close((error) => {
        if (error) reject(error);
        else resolve(port);
      });
    });
  });

const fetchResponse = async (url) => {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  assert.equal(response.status, 200, `${url} returned ${response.status}`);
  return response;
};

const fetchText = async (url, expectedContentType) => {
  const response = await fetchResponse(url);
  assert.match(
    response.headers.get("content-type") ?? "",
    expectedContentType,
    `${url} returned an unexpected content type`
  );
  return response.text();
};

const assertIncludes = (contents, expected, label) => {
  assert.ok(contents.includes(expected), `${label} is missing ${expected}`);
};

const sendJson = (response, status, value) => {
  response.statusCode = status;
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(value));
};

const readJson = async (request) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
};

const createBridgeClient = () => {
  const handlers = new Map();
  const outgoing = [];
  return {
    outgoing,
    send(type, payload) {
      outgoing.push({ pluginId: PLUGIN_ID, type, payload });
    },
    onMessage(type, handler) {
      const listeners = handlers.get(type) ?? new Set();
      listeners.add(handler);
      handlers.set(type, listeners);
      return {
        remove: () => listeners.delete(handler)
      };
    },
    receive(message) {
      if (message?.pluginId !== PLUGIN_ID) return;
      for (const handler of handlers.get(message.type) ?? []) {
        handler(message.payload);
      }
    },
    close() {
      handlers.clear();
    },
    request() {
      throw new Error("request is not used by the geolocation plugin");
    }
  };
};

const runElectron = async (electronPath, driverPath, url) => {
  const command = process.platform === "linux" ? "xvfb-run" : electronPath;
  const args =
    process.platform === "linux"
      ? ["-a", electronPath, driverPath]
      : [driverPath];
  const child = spawn(command, args, {
    env: {
      ...process.env,
      ELECTRON_DISABLE_SECURITY_WARNINGS: "true",
      ROZENITE_E2E_URL: url
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  const exitCode = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Electron behavior E2E timed out"));
    }, E2E_TIMEOUT_MS);
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      resolve(code);
    });
  });
  assert.equal(exitCode, 0, `Electron E2E failed.\n${stderr}\n${stdout}`);
  const resultLine = stdout.trim().split("\n").at(-1);
  assert.ok(resultLine, "Electron E2E did not return a result");
  return JSON.parse(resultLine);
};

const closeHttpServer = (server) =>
  new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });

const run = async () => {
  const repositoryRoot = process.cwd();
  const exampleRoot = path.join(repositoryRoot, "examples/v0.81.1");
  const pluginRoot = path.join(
    repositoryRoot,
    "packages/rozenite-devtools-plugin"
  );
  const port = await getAvailablePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  process.env.WITH_ROZENITE = "true";

  const requireFromExample = createRequire(
    path.join(exampleRoot, "package.json")
  );
  const requireFromPlugin = createRequire(
    path.join(pluginRoot, "package.json")
  );
  const viteEntry = requireFromPlugin.resolve("vite");
  const { createServer: createViteServer } = await import(
    pathToFileURL(viteEntry).href
  );
  const vite = await createViteServer({
    appType: "custom",
    logLevel: "silent",
    root: repositoryRoot,
    server: { middlewareMode: true }
  });

  const { connectGeolocationDevToolsRN } = await vite.ssrLoadModule(
    "/packages/rozenite-devtools-plugin/src/react-native/connectGeolocationDevToolsRN.ts"
  );
  const { createPosition } = await vite.ssrLoadModule(
    "/packages/rozenite-devtools-plugin/src/shared/presets.ts"
  );
  const { getDevtoolsCurrentPosition } = await vite.ssrLoadModule(
    "/packages/react-native-nitro-geolocation/src/devtools/getCurrentPosition.ts"
  );
  const watchModule = await vite.ssrLoadModule(
    "/packages/react-native-nitro-geolocation/src/devtools/watchPosition.ts"
  );

  const initialPosition = createPosition("Los Angeles, USA");
  globalThis.__geolocationDevtools = {
    initialPosition,
    position: initialPosition
  };
  globalThis.__geolocationDevToolsEnabled = true;

  const bridgeClient = createBridgeClient();
  const disconnect = connectGeolocationDevToolsRN(bridgeClient);
  const watchRecords = new Map();
  let nextWatchId = 1;
  const harnessHtml = readFileSync(
    path.join(repositoryRoot, "scripts/rozenite-e2e-harness.html"),
    "utf8"
  );

  const e2eMiddleware = async (request, response, next) => {
    if (!request.url?.startsWith("/rozenite-e2e")) {
      next();
      return;
    }
    try {
      const url = new URL(request.url, baseUrl);
      const route = url.pathname.slice("/rozenite-e2e".length) || "/";
      if (request.method === "GET" && route === "/") {
        response.setHeader("content-type", "text/html; charset=utf-8");
        response.end(harnessHtml);
        return;
      }
      if (request.method === "POST" && route === "/from-panel") {
        bridgeClient.receive(await readJson(request));
        sendJson(response, 200, { received: true });
        return;
      }
      if (request.method === "GET" && route === "/to-panel") {
        const after = Number(url.searchParams.get("after") ?? 0);
        sendJson(response, 200, {
          messages: bridgeClient.outgoing.slice(after),
          next: bridgeClient.outgoing.length
        });
        return;
      }
      if (request.method === "GET" && route === "/current-position") {
        sendJson(response, 200, await getDevtoolsCurrentPosition());
        return;
      }
      if (request.method === "POST" && route === "/watches") {
        const body = await readJson(request);
        const id = `watch-${nextWatchId++}`;
        const updates = [];
        const token = watchModule.devtoolsWatchPosition(
          (position) => updates.push(position),
          undefined,
          body.options,
          body.platform
        );
        watchRecords.set(id, { id, token, updates });
        sendJson(response, 200, { id, token });
        return;
      }
      if (request.method === "GET" && route === "/watches") {
        sendJson(response, 200, {
          records: Array.from(watchRecords.values()),
          active: watchModule.getDevtoolsActiveWatches()
        });
        return;
      }
      const watchId = route.match(/^\/watches\/(watch-\d+)$/)?.[1];
      if (request.method === "DELETE" && watchId) {
        const record = watchRecords.get(watchId);
        if (record) watchModule.devtoolsUnwatch(record.token);
        sendJson(response, 200, { removed: Boolean(record) });
        return;
      }
      sendJson(response, 404, { error: "Not found" });
    } catch (error) {
      sendJson(response, 500, {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  };

  const metro = requireFromExample("metro");
  const config = await metro.loadConfig({
    config: path.join(exampleRoot, "metro.config.js"),
    cwd: exampleRoot,
    port,
    resetCache: true
  });
  const { httpServer } = await metro.runServer(config, {
    host: "127.0.0.1",
    unstable_extraMiddleware: [e2eMiddleware],
    waitForBundler: true,
    watch: false
  });

  try {
    const configResponse = await fetchResponse(
      `${baseUrl}/rozenite/app/config`
    );
    const rozeniteConfig = await configResponse.json();
    assert.deepEqual(rozeniteConfig.installedPlugins, [PLUGIN_ID]);
    assert.equal(rozeniteConfig.runtimeVersion, EXPECTED_RUNTIME_VERSION);

    const pluginBaseUrl = `${baseUrl}/rozenite/plugins/${PLUGIN_ID.replace("/", "_")}`;
    const manifestResponse = await fetchResponse(
      `${pluginBaseUrl}/rozenite.json`
    );
    const manifest = await manifestResponse.json();
    assert.equal(manifest.name, PLUGIN_ID);
    const panelUrl = `${pluginBaseUrl}${manifest.panels[0].source}`;
    const panelHtml = await fetchText(panelUrl, /text\/html/);
    assertIncludes(panelHtml, "__ROZENITE_PANEL__", "panel HTML");

    for (const platform of ["android", "ios"]) {
      const bundle = await fetchText(
        `${baseUrl}/index.bundle?platform=${platform}&dev=true&minify=false&modulesOnly=false&runModule=true`,
        /(?:application|text)\/javascript/
      );
      assertIncludes(bundle, PLUGIN_ID, `${platform} React Native bundle`);
    }

    const rozenitePackage = requireFromPlugin.resolve("rozenite/package.json");
    const requireFromRozenite = createRequire(rozenitePackage);
    const electronPath = requireFromRozenite("electron");
    const behavior = await runElectron(
      electronPath,
      path.join(repositoryRoot, "scripts/rozenite-e2e-electron.cjs"),
      `${baseUrl}/rozenite-e2e/`
    );
    assert.deepEqual(behavior, {
      initial: "Los Angeles, USA",
      preset: "Tokyo, Japan",
      distanceFilter: "passed",
      maxUpdates: "passed",
      final: "New York, USA",
      cleanup: "passed"
    });
    console.log(`Rozenite behavior E2E passed: ${JSON.stringify(behavior)}`);
  } finally {
    watchModule.devtoolsStopObserving();
    disconnect();
    bridgeClient.close();
    await closeHttpServer(httpServer);
    await vite.close();
    globalThis.__geolocationDevToolsEnabled = undefined;
    globalThis.__geolocationDevtools = undefined;
  }
};

await run();
