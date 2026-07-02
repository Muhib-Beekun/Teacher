#!/usr/bin node
/** Cross-platform Open VSX publish (Windows-safe; no bash $(...) in npm scripts). */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const vsix = path.join(root, `teacher-${pkg.version}.vsix`);
const token = process.argv[2]?.trim() || process.env.OVSX_PAT?.trim();

if (!token) {
    console.error('Usage: npm run publish:ovsx -- <ovsx-token>');
    console.error('Or set OVSX_PAT in the environment for this shell only.');
    process.exit(1);
}

if (!fs.existsSync(vsix)) {
    console.error(`Missing ${path.basename(vsix)} — run npm run package first.`);
    process.exit(1);
}

console.log(`Publishing ${path.basename(vsix)} to Open VSX…`);

const result = spawnSync(
    'npx',
    ['ovsx', 'publish', vsix, '-p', token],
    { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' }
);

process.exit(result.status ?? 1);
