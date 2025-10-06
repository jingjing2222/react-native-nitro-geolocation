import * as path from "node:path";
import { defineConfig } from "rspress/config";

export default defineConfig({
  root: path.join(__dirname, "docs"),
  title: "React Native Nitro Geolocation",
  description: "A React Native Geolocation module Using Nitro",
  icon: "/logo.png",
  logo: "/logo.png",
  logoText: "React Native Nitro Geolocation",
  head: [
    [
      "meta",
      {
        name: "keywords",
        content: "react-native, geolocation, nitro, mobile, location"
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
        content: "A React Native Geolocation module Using Nitro"
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
        content: "A React Native Geolocation module Using Nitro"
      }
    ],
    ["meta", { name: "twitter:image", content: "/logo.png" }]
  ],
  themeConfig: {
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
