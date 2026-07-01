import * as fs from 'fs';
import * as path from 'path';

const DEP_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'] as const;

/** Parse dependency names from a package.json object. */
export function parsePackageJsonDeps(pkg: Record<string, unknown>): string[] {
    const names: string[] = [];
    for (const field of DEP_FIELDS) {
        const block = pkg[field];
        if (block && typeof block === 'object' && !Array.isArray(block)) {
            names.push(...Object.keys(block as Record<string, string>));
        }
    }
    return names;
}

/** Read dependency names from package.json on disk (CLI / lexical spike). */
export function readPackageJsonDeps(filePath: string): string[] {
    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        return parsePackageJsonDeps(JSON.parse(raw) as Record<string, unknown>);
    } catch {
        return [];
    }
}

/** Read user glossary lines from `.teacher/codewords.txt`. */
export function readCodewordsFile(filePath: string): string[] {
    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        return raw
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line.length > 0 && !line.startsWith('#'));
    } catch {
        return [];
    }
}

/** Collect package.json dependency names under a workspace root (shallow + one level). */
export function collectWorkspaceDeps(rootDir: string): string[] {
    const terms = new Set<string>();
    const candidates = [
        path.join(rootDir, 'package.json'),
        ...listChildPackageJsonPaths(rootDir)
    ];

    for (const pkgPath of candidates) {
        for (const dep of readPackageJsonDeps(pkgPath)) {
            terms.add(dep);
        }
    }

    return [...terms];
}

function listChildPackageJsonPaths(rootDir: string): string[] {
    const found: string[] = [];
    try {
        for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
            if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'node_modules') {
                continue;
            }
            const pkgPath = path.join(rootDir, entry.name, 'package.json');
            if (fs.existsSync(pkgPath)) {
                found.push(pkgPath);
            }
        }
    } catch {
        // ignore unreadable roots
    }
    return found;
}

/** Strip extension and normalize a path basename for STT biasing. */
export function basenameTerm(filePath: string): string {
    const base = path.basename(filePath);
    const dot = base.lastIndexOf('.');
    return dot > 0 ? base.slice(0, dot) : base;
}
