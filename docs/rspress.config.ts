import * as path from "node:path";
import { type RspressPlugin, defineConfig } from "@rspress/core";

const v2OnlyRoutes = [
  "background/location-lifecycle",
  "background/reliability-contract",
  "guide/consumer-e2e-contract-kit",
  "guide/gps-offline-recipe",
  "guide/install-doctor",
  "guide/privacy-compliance",
  "guide/release-readiness",
  "guide/swift-package-manager",
  "guide/troubleshooting",
  "guide/upgrade-from-v1",
  "guide/v2-error-migration",
  "guide/v2-unified-background-events",
  "guide/watch-observability"
];

const versionFallbacks: RspressPlugin = {
  name: "version-fallbacks",
  addPages() {
    return v2OnlyRoutes.map((route) => ({
      routePath: `/${route}`,
      content: `---
title: Available in 2.x
---

# Available in 2.x

This page documents a 2.x feature and is not part of the 1.x API snapshot.

[Open the 2.x page](/v2/${route}.html) or [return to the 1.x guide](/guide/index.html).
`
    }));
  }
};

export default defineConfig({
  root: path.join(__dirname, "docs"),
  title: "React Native Nitro Geolocation",
  description: "Nitro-powered native geolocation for React Native apps",
  icon: "/logo.png",
  logo: "/logo.png",
  logoText: "React Native Nitro Geolocation",
  multiVersion: {
    default: "v1",
    versions: ["v1", "v2"]
  },
  route: {
    exclude: ["./index.md", "./guide/**", "./background/**"]
  },
  plugins: [versionFallbacks],
  head: [
    [
      "meta",
      {
        name: "keywords",
        content:
          "react-native, geolocation, location, gps, ios, android, nitro, nitro-modules, jsi, new-architecture, fused-location, geocoding, heading"
      }
    ],
    [
      "meta",
      { property: "og:title", content: "React Native Nitro Geolocation" }
    ],
    [
      "meta",
      {
        property: "og:description",
        content: "Nitro-powered native geolocation for React Native apps"
      }
    ],
    ["meta", { property: "og:image", content: "/logo.png" }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { name: "twitter:card", content: "summary_large_image" }],
    [
      "meta",
      { name: "twitter:title", content: "React Native Nitro Geolocation" }
    ],
    [
      "meta",
      {
        name: "twitter:description",
        content: "Nitro-powered native geolocation for React Native apps"
      }
    ],
    ["meta", { name: "twitter:image", content: "/logo.png" }]
  ],
  llms: true,
  themeConfig: {
    llmsUI: true,
    socialLinks: [
      {
        icon: "github",
        mode: "link",
        content:
          "https://github.com/jingjing2222/react-native-nitro-geolocation"
      }
    ]
  }
});
