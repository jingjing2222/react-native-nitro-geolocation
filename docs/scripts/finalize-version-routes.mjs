import { readFile, writeFile } from "node:fs/promises";

const manifest = JSON.parse(
  await readFile(
    new URL(
      "../../packages/react-native-nitro-geolocation/package.json",
      import.meta.url
    ),
    "utf8"
  )
);
// Cloudflare Pages keeps links to the RC documentation usable after 2.x becomes
// the default documentation version. RC builds still serve those routes directly.
await writeFile(
  new URL("../doc_build/_redirects", import.meta.url),
  manifest.version.includes("-rc.") ? "" : "/v2/ / 301\n/v2/* /:splat 301\n"
);
