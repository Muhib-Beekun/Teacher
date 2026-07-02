import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const svg = path.join(root, 'media', 'icon.svg');
const targets = [
    { png: path.join(root, 'icon.png'), size: 128 },
    { png: path.join(root, 'media', 'icon.png'), size: 128 },
    { png: path.join(root, 'media', 'icon-256.png'), size: 256 }
];

function render(out, size) {
    const args = [svg, out, '--fit-width', String(size), '--fit-height', String(size)];
    const res = spawnSync('npx', ['@resvg/resvg-js-cli', ...args], { cwd: root, stdio: 'inherit', shell: true });
    if (res.status !== 0) {
        process.exit(res.status ?? 1);
    }
}

for (const target of targets) {
    render(target.png, target.size);
    console.log(`Wrote ${target.png}`);
}

console.log('Extension icon at package root: icon.png (used by Extensions view)');
