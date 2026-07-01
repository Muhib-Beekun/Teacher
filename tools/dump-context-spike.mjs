#!/usr/bin/env node
/**
 * Lexical-only context spike (no VS Code APIs).
 * Prints dictionary_context from package.json deps + .teacher/codewords.txt.
 *
 * Usage: node tools/dump-context-spike.mjs [workspaceRoot]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(process.argv[2] ?? path.join(__dirname, '..'));

function readPackageJsonDeps(filePath) {
    try {
        const pkg = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const fields = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
        const names = [];
        for (const field of fields) {
            if (pkg[field] && typeof pkg[field] === 'object') {
                names.push(...Object.keys(pkg[field]));
            }
        }
        return names;
    } catch {
        return [];
    }
}

function readCodewords(filePath) {
    try {
        return fs
            .readFileSync(filePath, 'utf8')
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line.length > 0 && !line.startsWith('#'));
    } catch {
        return [];
    }
}

const terms = new Set();
for (const dep of readPackageJsonDeps(path.join(root, 'package.json'))) {
    terms.add(dep);
}
for (const word of readCodewords(path.join(root, '.teacher', 'codewords.txt'))) {
    terms.add(word);
}

const dictionary_context = [...terms].sort((a, b) => a.localeCompare(b));

console.log(JSON.stringify({ workspaceRoot: root, dictionary_context }, null, 2));
