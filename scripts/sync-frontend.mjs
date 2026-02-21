import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const source = path.resolve(root, '../tablut-frontend-ng/dist/tablut-frontend-ng/browser');
const target = path.resolve(root, 'src/browser');

if (!fs.existsSync(source)) {
  console.error(`Frontend build not found at: ${source}`);
  process.exit(1);
}

fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });
fs.cpSync(source, target, { recursive: true });

console.log(`Synced frontend from ${source} to ${target}`);
