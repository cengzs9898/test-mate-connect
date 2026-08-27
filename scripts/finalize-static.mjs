/**
 * Statik build sonrası düzenleme (cPanel kurulumu için).
 * - dist/client/_shell.html -> index.html (SPA giriş dosyası)
 * - php/api/* -> dist/client/api/ (PHP uç noktası)
 * Sonuç: dist/client klasörünün içeriğini olduğu gibi public_html'e yükleyin.
 */
import { cp, copyFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const out = path.resolve("dist/client");
if (!existsSync(out)) {
  console.error("dist/client bulunamadı — önce `npm run build:static` çalıştırın.");
  process.exit(1);
}

await copyFile(path.join(out, "_shell.html"), path.join(out, "index.html"));

const apiSrc = path.resolve("php/api");
const apiOut = path.join(out, "api");
await mkdir(apiOut, { recursive: true });
for (const file of await readdir(apiSrc)) {
  await cp(path.join(apiSrc, file), path.join(apiOut, file));
}

console.log("Statik çıktı hazır: dist/client (index.html + api/mmpi.php + .htaccess)");
