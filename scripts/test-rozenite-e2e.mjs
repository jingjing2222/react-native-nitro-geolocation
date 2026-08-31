import assert from "node:assert/strict";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";

const PLUGIN_ID = "@react-native-nitro-geolocation/rozenite-plugin";
const EXPECTED_RUNTIME_VERSION = "2.2.0";
const REQUEST_TIMEOUT_MS = 120_000;

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
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
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

const run = async () => {
  const exampleRoot = path.resolve("examples/v0.81.1");
  const port = await getAvailablePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  process.env.WITH_ROZENITE = "true";

  const requireFromExample = createRequire(
    path.join(exampleRoot, "package.json")
  );
  const metro = requireFromExample("metro");
  const config = await metro.loadConfig({
    config: path.join(exampleRoot, "metro.config.js"),
    cwd: exampleRoot,
    port,
    resetCache: true
  });
  const { httpServer } = await metro.runServer(config, {
    host: "127.0.0.1",
    waitForBundler: true,
    watch: false
  });

  try {
    const configResponse = await fetchResponse(
      `${baseUrl}/rozenite/app/config`
    );
    const config = await configResponse.json();
    assert.deepEqual(config.installedPlugins, [PLUGIN_ID]);
    assert.equal(config.runtimeVersion, EXPECTED_RUNTIME_VERSION);

    const pluginBaseUrl = `${baseUrl}/rozenite/plugins/${PLUGIN_ID.replace("/", "_")}`;
    const manifestResponse = await fetchResponse(
      `${pluginBaseUrl}/rozenite.json`
    );
    const manifest = await manifestResponse.json();
    assert.equal(manifest.name, PLUGIN_ID);
    assert.deepEqual(manifest.panels, [
      {
        name: "Geolocation",
        source: "/devtools/geolocation-devtools.html"
      }
    ]);

    const panelUrl = `${pluginBaseUrl}${manifest.panels[0].source}`;
    const panelHtml = await fetchText(panelUrl, /text\/html/);
    assertIncludes(panelHtml, "__ROZENITE_PANEL__", "panel HTML");
    assertIncludes(panelHtml, '<div id="root"></div>', "panel HTML");

    const scriptSource = panelHtml.match(
      /<script[^>]+src="([^"]*geolocation-devtools\.js)"/
    )?.[1];
    const stylesheetSource = panelHtml.match(
      /<link[^>]+href="([^"]*geolocation-devtools-[^"]+\.css)"/
    )?.[1];
    assert.ok(scriptSource, "panel HTML is missing its JavaScript entry");
    assert.ok(stylesheetSource, "panel HTML is missing its stylesheet");

    const panelScript = await fetchText(
      new URL(scriptSource, panelUrl).href,
      /(?:application|text)\/javascript/
    );
    for (const marker of [
      PLUGIN_ID,
      "Current Position",
      "initialPosition",
      "ready",
      "position"
    ]) {
      assertIncludes(panelScript, marker, "panel JavaScript");
    }

    const stylesheet = await fetchText(
      new URL(stylesheetSource, panelUrl).href,
      /text\/css/
    );
    assertIncludes(stylesheet, "--background", "panel stylesheet");

    const hostHtml = await fetchText(
      `${baseUrl}/rozenite/rn_fusebox.html`,
      /text\/html/
    );
    assertIncludes(hostHtml, PLUGIN_ID, "Rozenite host HTML");
    assertIncludes(hostHtml, EXPECTED_RUNTIME_VERSION, "Rozenite host HTML");

    for (const platform of ["android", "ios"]) {
      const bundle = await fetchText(
        `${baseUrl}/index.bundle?platform=${platform}&dev=true&minify=false&modulesOnly=false&runModule=true`,
        /(?:application|text)\/javascript/
      );
      for (const marker of [
        PLUGIN_ID,
        "plugin-mounted",
        "__geolocationDevToolsEnabled",
        "Los Angeles, USA"
      ]) {
        assertIncludes(bundle, marker, `${platform} React Native bundle`);
      }
    }

    console.log(
      `Rozenite E2E passed: runtime ${config.runtimeVersion}, panel assets, and mobile bundles verified.`
    );
  } finally {
    await new Promise((resolve, reject) => {
      httpServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
};

await run();
