import { access, readFile } from "node:fs/promises";
import path from "node:path";

const buildRoot = path.resolve(import.meta.dirname, "../doc_build");
const packageReadme = path.resolve(
  import.meta.dirname,
  "../../packages/react-native-nitro-geolocation/README.md"
);
const requiredRoutes = [
  "index.html",
  "guide/modern-api.html",
  "v2/index.html",
  "v2/guide/modern-api.html",
  "v2/guide/release-readiness.html",
  "v2/guide/swift-package-manager.html",
  "v2/guide/troubleshooting.html",
  "v2/guide/upgrade-from-v1.html",
  "v2/guide/v2-unified-background-events.html",
  "background/location-lifecycle.html",
  "background/reliability-contract.html",
  "guide/consumer-e2e-contract-kit.html",
  "guide/gps-offline-recipe.html",
  "guide/install-doctor.html",
  "guide/privacy-compliance.html",
  "guide/release-readiness.html",
  "guide/swift-package-manager.html",
  "guide/troubleshooting.html",
  "guide/upgrade-from-v1.html",
  "guide/v2-error-migration.html",
  "guide/v2-unified-background-events.html",
  "guide/watch-observability.html"
];

await Promise.all(
  requiredRoutes.map(async (route) => {
    try {
      await access(path.join(buildRoot, route));
    } catch {
      throw new Error(`Missing versioned documentation route: ${route}`);
    }
  })
);

const v2Home = await readFile(path.join(buildRoot, "v2/index.html"), "utf8");
const requiredV2Links = [
  "/v2/guide/quick-start.html",
  "/v2/guide/upgrade-from-v1.html",
  "/v2/background/overview.html"
];

for (const href of requiredV2Links) {
  if (!v2Home.includes(`href="${href}"`)) {
    throw new Error(`The v2 home page does not link to its v2 route: ${href}`);
  }
}

const v2Guide = await readFile(
  path.join(buildRoot, "v2/guide/index.html"),
  "utf8"
);
const requiredDecisionLinks = [
  "/v2/guide/quick-start.html",
  "/v2/guide/upgrade-from-v1.html",
  "/v2/guide/community-migration.html",
  "/v2/guide/service-migration.html",
  "/v2/guide/expo-development-build.html",
  "/v2/background/overview.html",
  "/v2/guide/release-readiness.html",
  "/v2/guide/troubleshooting.html"
];

for (const href of requiredDecisionLinks) {
  if (!v2Guide.includes(`href="${href}"`)) {
    throw new Error(`The v2 decision page is missing its task link: ${href}`);
  }
}

const v2Modern = await readFile(
  path.join(buildRoot, "v2/guide/modern-api.html"),
  "utf8"
);

if (!v2Modern.includes(">2.0 RC<")) {
  throw new Error("A deep v2 page does not expose the persistent RC marker.");
}

if (
  !v2Modern.includes('href="https://react-native-nitro-geolocation.pages.dev/"')
) {
  throw new Error("A deep v2 page does not expose the stable 1.x docs link.");
}

const readme = await readFile(packageReadme, "utf8");

if (
  /react-native-nitro-geolocation\.pages\.dev\/(?:guide|background)\//.test(
    readme
  )
) {
  throw new Error("The 2.0 RC package README links to unversioned API docs.");
}

for (const command of readme.matchAll(
  /^(?:yarn add|npm install)[^\n]*(?:^|\s)react-native-nitro-geolocation(?:@|\s|$)[^\n]*$/gm
)) {
  if (!/react-native-nitro-geolocation@(?:rc|2\.0\.0-rc\.)/.test(command[0])) {
    throw new Error(
      `The 2.0 RC README install is not pinned to an RC: ${command[0]}`
    );
  }
}

console.log(
  `Versioned documentation routes OK: ${requiredRoutes.length} checked.`
);
