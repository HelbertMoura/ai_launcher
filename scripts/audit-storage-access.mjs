import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const root = process.cwd();
const allowed = new Set(['src/lib/storage/index.ts', 'src/lib/secrets.ts']);
const access = /(?:window\.)?localStorage\.(?:getItem|setItem|removeItem)\s*\(/;
const violations = [];

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (['.ts', '.tsx'].includes(extname(path)) && !/\.test\.[^.]+$/.test(path)) {
      const file = relative(root, path).replaceAll('\\', '/');
      if (allowed.has(file)) continue;
      const lines = (await readFile(path, 'utf8')).split(/\r?\n/);
      lines.forEach((line, index) => {
        if (access.test(line) && !line.trimStart().startsWith('//')) violations.push(`${file}:${index + 1}`);
      });
    }
  }
}

await walk(join(root, 'src'));
if (violations.length) {
  console.error(`Direct localStorage access is restricted to storage adapters:\n${violations.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log('Storage access audit passed (2 approved adapters).');
}
