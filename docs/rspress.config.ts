import * as path from "node:path";
import { defineConfig } from "@rspress/core";

export default defineConfig({
  root: path.join(__dirname, "docs"),
  title: "React Native Nitro Geolocation",
  description: "Nitro-powered native geolocation for modern React Native apps",
  icon: "/logo.png",
  logo: "/logo.png",
  logoText: "React Native Nitro Geolocation",
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
        content: "Nitro-powered native geolocation for modern React Native apps"
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
        content: "Nitro-powered native geolocation for modern React Native apps"
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
