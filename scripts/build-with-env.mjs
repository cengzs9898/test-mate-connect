import { spawnSync } from "node:child_process";
import path from "node:path";

const target = process.argv[2];
const env = { ...process.env };

if (target === "static") {
  env.STATIC_BUILD = "1";
} else if (target === "node") {
  env.NITRO_PRESET = "node-server";
} else {
  console.error("Geçersiz build hedefi.");
  process.exit(1);
}

// Vite'ı npx/npm aracılığıyla çağırmak bazı Windows npm kurulumlarında
// node_modules/npm/bin dosyalarının aranmasına neden oluyor. Kurulu Vite CLI'ını
// mevcut Node çalıştırıcısıyla doğrudan başlatmak tüm platformlarda daha güvenli.
const viteCli = path.resolve("node_modules", "vite", "bin", "vite.js");
const build = spawnSync(process.execPath, [viteCli, "build"], {
  env,
  stdio: "inherit",
  shell: false,
});

if (build.error) {
  console.error(build.error.message);
  process.exit(1);
}

if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

if (target === "static") {
  const finalize = spawnSync(process.execPath, ["scripts/finalize-static.mjs"], {
    stdio: "inherit",
    shell: false,
  });

  if (finalize.error) {
    console.error(finalize.error.message);
    process.exit(1);
  }

  process.exit(finalize.status ?? 0);
}