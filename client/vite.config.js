// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const isProd = process.env.NODE_ENV === "production";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",

      // keep SW in dev so install works on localhost
      devOptions: { enabled: true, type: "module" },

      includeAssets: [
        "offline.html",
        "favicon.png"            // you have favicon.png (not .ico/.svg)
      ],

      manifest: {
        name: "Just Finance",
        short_name: "JustFinance",
        start_url: "/",
        scope: "/",
        display: "standalone",
        theme_color: "#0f172a",
        background_color: "#0f172a",
        icons: [
          // use your existing files
          {
            src: "/icons/manifest-icon-192.maskable.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable"
          },
          {
            src: "/icons/manifest-icon-512.maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable"
          },
          // optional: nice to include 180 for iOS
          { src: "/icons/apple-icon-180.png", sizes: "180x180", type: "image/png" }
        ],
      },

      // only show offline page in prod; and never for icons/manifest
      workbox: isProd
        ? {
            navigateFallback: "offline.html",
            navigateFallbackDenylist: [/^\/icons\//, /manifest\.webmanifest$/, /^\/assets\//],
          }
        : undefined,
    }),
  ],
});
