import { readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../dist/", import.meta.url));
const rows = [];

async function walk(directory) {
  for (const name of await readdir(directory)) {
    const path = join(directory, name);
    const info = await stat(path);
    if (info.isDirectory()) {
      await walk(path);
      continue;
    }
    rows.push({
      file: relative(root, path).replaceAll("\\", "/"),
      bytes: info.size,
    });
  }
}

await walk(root);

const assets = rows
  .filter(({ file }) => file.startsWith("assets/"))
  .sort((a, b) => b.bytes - a.bytes);
const javascript = assets.filter(({ file }) => file.endsWith(".js"));
const css = assets.filter(({ file }) => file.endsWith(".css"));

const sum = (items) => items.reduce((total, item) => total + item.bytes, 0);
const kb = (bytes) => Math.round((bytes / 1024) * 100) / 100;

const report = {
  generatedAt: new Date().toISOString(),
  files: rows.length,
  assets: assets.length,
  javascriptKb: kb(sum(javascript)),
  cssKb: kb(sum(css)),
  largestAssets: assets.slice(0, 10).map(({ file, bytes }) => ({
    file,
    kb: kb(bytes),
  })),
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
