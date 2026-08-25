import { access, readFile } from "node:fs/promises";
import path from "node:path";

const buildRoot = path.resolve(import.meta.dirname, "../doc_build");
const requiredRoutes = [
  "index.html",
  "guide/modern-api.html",
  "v2/index.html",
  "v2/guide/modern-api.html",
  "v2/guide/swift-package-manager.html",
  "v2/guide/v2-unified-background-events.html",
  "background/location-lifecycle.html",
  "background/reliability-contract.html",
  "guide/consumer-e2e-contract-kit.html",
  "guide/gps-offline-recipe.html",
  "guide/install-doctor.html",
  "guide/privacy-compliance.html",
  "guide/swift-package-manager.html",
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
  "/v2/guide/index.html",
  "/v2/guide/v2-error-migration.html"
];

for (const href of requiredV2Links) {
  if (!v2Home.includes(`href="${href}"`)) {
    throw new Error(`The v2 home page does not link to its v2 route: ${href}`);
  }
}

console.log(
  `Versioned documentation routes OK: ${requiredRoutes.length} checked.`
);
