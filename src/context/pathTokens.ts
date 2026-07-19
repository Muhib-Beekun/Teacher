/** File extensions Teacher treats as workspace targets when spoken/typed/pasted. */
export const TARGET_FILE_EXTENSIONS = 'ts|tsx|js|jsx|py|go|rs|md|html|json|mjs|cjs';

const EXT_GROUP = `(?:${TARGET_FILE_EXTENSIONS})`;

/**
 * Path-like token with optional leading minus (exclude) and optional quotes.
 * Captures: [1]=minus?, [2]=path
 */
export const PATH_TOKEN_RE = new RegExp(
    `(?:^|[\\s,;([{])(-)?[\`'"]?((?:[A-Za-z]:)?(?:[\\\\/]?[\\w.@+-]+)+\\.${EXT_GROUP})[\`'"]?(?=$|[\\s,;)\\]])`,
    'gi'
);

const LOOKS_LIKE_FILE_PATH = new RegExp(
    `^(?:[A-Za-z]:)?(?:[\\\\/]?[\\w.@+-]+)+\\.${EXT_GROUP}$`,
    'i'
);

export interface PathTokenHit {
    path: string;
    excluded: boolean;
}

/** Normalize clipboard / spoken path text for target matching. */
export function normalizeFilePathToken(raw: string): string {
    let t = (raw || '').trim();
    if (!t) {
        return '';
    }
    t = t.replace(/^["'`]+|["'`]+$/g, '');
    if (/^file:/i.test(t)) {
        try {
            const u = new URL(t);
            t = decodeURIComponent(u.pathname);
            // URL pathname on Windows is `/C:/Users/...` — drop leading slash before drive.
            if (/^\/[A-Za-z]:/.test(t)) {
                t = t.slice(1);
            }
        } catch {
            t = t.replace(/^file:\/\/\/?/i, '');
            if (/^\/[A-Za-z]:/.test(t)) {
                t = t.slice(1);
            }
            try {
                t = decodeURIComponent(t);
            } catch {
                // keep as-is
            }
        }
    }
    return t.trim();
}

/**
 * If clipboard text is a single file path (or file:// URI), return a clean path
 * suitable for insertion into the live prompt. Otherwise null.
 */
export function normalizePastedFilePath(raw: string): string | null {
    const normalized = normalizeFilePathToken(raw);
    if (!normalized || /\s/.test(normalized)) {
        return null;
    }
    if (!LOOKS_LIKE_FILE_PATH.test(normalized)) {
        return null;
    }
    return normalized;
}

/** Extract include/exclude path tokens from speech or typed prompt text. */
export function extractPathTokens(speech: string): PathTokenHit[] {
    const hits: PathTokenHit[] = [];
    const seen = new Set<string>();
    PATH_TOKEN_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = PATH_TOKEN_RE.exec(speech)) !== null) {
        const path = normalizeFilePathToken(match[2] ?? '');
        if (!path) {
            continue;
        }
        const key = `${match[1] ? '-' : '+'}:${path.toLowerCase()}`;
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        hits.push({ path, excluded: !!match[1] });
    }
    return hits;
}

/** True when `candidate` matches an excluded path token (basename or full path). */
export function isPathExcluded(candidate: string, excluded: Set<string>): boolean {
    if (excluded.size === 0) {
        return false;
    }
    const norm = candidate.replace(/\\/g, '/').toLowerCase();
    const base = norm.split('/').pop() ?? norm;
    for (const ex of excluded) {
        const exNorm = ex.replace(/\\/g, '/').toLowerCase();
        const exBase = exNorm.split('/').pop() ?? exNorm;
        if (
            norm === exNorm ||
            base === exNorm ||
            norm.endsWith('/' + exNorm) ||
            exNorm.endsWith('/' + base) ||
            base === exBase ||
            norm.endsWith('/' + exBase)
        ) {
            return true;
        }
    }
    return false;
}
