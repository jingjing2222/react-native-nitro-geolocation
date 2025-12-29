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
    ],
    sidebar: {
      "/guide/": [
        {
          text: "Getting Started",
          items: [
            { text: "Introduction", link: "/guide/" },
            { text: "Quick Start", link: "/guide/quick-start" }
          ]
        },
        {
          text: "API Reference",
          items: [
            {
              text: "Modern API (Recommended)",
              link: "/guide/modern-api"
            },
            {
              text: "Legacy API (Compat)",
              link: "/guide/legacy-api"
            }
          ]
        },
        {
          text: "Development Tools",
          items: [
            {
              text: "DevTools Plugin (Rozenite)",
              link: "/guide/devtools"
            }
          ]
        },
        {
          text: "Learn More",
          items: [
            { text: "Why Nitro Module?", link: "/guide/why-nitro-module" },
            { text: "Benchmark", link: "/guide/benchmark" }
          ]
        }
      ]
    }
  }
});
