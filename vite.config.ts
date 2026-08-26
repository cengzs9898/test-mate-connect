// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // Kendi sunucunuzda (Lovable dışında) build alındığında çıktı Node.js sunucusu
  // olarak üretilir: `.output/server/index.mjs` -> `npm start`.
  // Lovable önizleme/yayın build'i bu ayarı kendi hedefiyle geçersiz kılar.
  nitro: {
    preset: process.env["NITRO_PRESET"] ?? "node-server",
  },
});
