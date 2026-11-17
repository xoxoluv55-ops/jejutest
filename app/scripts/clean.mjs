// Removes previous build output from the repo root (the game is published from the repo root for GitHub Pages).
import { rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
for (const p of ['index.html', 'game', 'assets']) rmSync(resolve(root, p), { recursive: true, force: true });
