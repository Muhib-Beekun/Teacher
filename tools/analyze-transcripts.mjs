#!/usr/bin/env node
/**
 * Scan Cursor agent-transcripts for correction patterns.
 * Usage: node tools/analyze-transcripts.mjs [cursorProjectsRoot]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.join(
    process.env.USERPROFILE || process.env.HOME || '',
    '.cursor',
    'projects'
);
const root = path.resolve(process.argv[2] ?? defaultRoot);

const PATTERNS = [
    { name: 'ignore_that', re: /\bignore that\b/i },
    { name: 'scratch_that', re: /\b(scratch|disregard|forget) that\b/i },
    { name: 'i_meant', re: /\bi meant\b/i },
    { name: 'actually', re: /^actually[,.]/im },
    { name: 'not_the', re: /\bnot the \w+/i },
    { name: 'only_scope', re: /\bonly \w+/i }
];

const counts = Object.fromEntries(PATTERNS.map((p) => [p.name, 0]));
const samples = [];
let files = 0;
let userLines = 0;

function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith('.jsonl')) processFile(full);
    }
}

function processFile(filePath) {
    files++;
    for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
        if (!line.trim()) continue;
        let row;
        try {
            row = JSON.parse(line);
        } catch {
            continue;
        }
        if (row.role !== 'user') continue;
        const text = extractText(row);
        if (!text) continue;
        userLines++;
        for (const p of PATTERNS) {
            if (p.re.test(text)) {
                counts[p.name]++;
                if (samples.length < 20) {
                    samples.push({ pattern: p.name, file: filePath, excerpt: text.slice(0, 160) });
                }
            }
        }
    }
}

function extractText(row) {
    const content = row.message?.content;
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
        return content.filter((c) => c.type === 'text').map((c) => c.text).join('\n');
    }
    return '';
}

walk(root);

console.log(JSON.stringify({ root, filesScanned: files, userLines, counts, samples }, null, 2));
