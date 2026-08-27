// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// STATIC_BUILD=1 -> tamamen statik çıktı (cPanel + PHP API kurulumu için).
const isStatic = process.env["STATIC_BUILD"] === "1";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    // Statik build'de SSR kapatılır, tek index.html üretilir (SPA).
    ...(isStatic
      ? { spa: { enabled: true, prerender: { crawlLinks: false } } }
      : { server: { entry: "server" } }),
  },
  // Kendi sunucunuzda (Lovable dışında) build alındığında çıktı Node.js sunucusu
  // olarak üretilir: `.output/server/index.mjs` -> `npm start`.
  // Lovable önizleme/yayın build'i bu ayarı kendi hedefiyle geçersiz kılar.
  ...(isStatic
    ? { nitro: false as const }
    : { nitro: { preset: process.env["NITRO_PRESET"] ?? "node-server" } }),
});
