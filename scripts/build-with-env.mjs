import { spawnSync } from "node:child_process";

const target = process.argv[2];
const isWindows = process.platform === "win32";
const executable = isWindows ? "npx.cmd" : "npx";
const env = { ...process.env };

if (target === "static") {
  env.STATIC_BUILD = "1";
} else if (target === "node") {
  env.NITRO_PRESET = "node-server";
} else {
  console.error("Geçersiz build hedefi.");
  process.exit(1);
}

const build = spawnSync(executable, ["vite", "build"], {
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