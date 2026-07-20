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

/** Pull href values from clipboard HTML (hyperlink copies). */
export function extractHrefValues(html: string): string[] {
    if (!html) {
        return [];
    }
    const out: string[] = [];
    const re = /href\s*=\s*(["'])(.*?)\1/gi;
    let match: RegExpExecArray | null;
    while ((match = re.exec(html)) !== null) {
        const href = (match[2] ?? '').trim();
        if (href) {
            out.push(href);
        }
    }
    return out;
}

/** Strip tags from HTML clipboard data without using the DOM. */
export function stripHtmlToPlainText(html: string): string {
    return (html || '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/\s+/g, ' ')
        .trim();
}

function isBasenameOnlyPath(path: string): boolean {
    return !/[\\/]/.test(path) && !/^[A-Za-z]:/.test(path);
}

/**
 * Resolve clipboard plain + HTML into safe prompt text.
 * Prefers a file path from plain text or from a hyperlink href; never returns markup.
 * When plain is only a basename (typical hyperlink copy) and href has a fuller path, use href.
 */
export function resolveClipboardToPromptText(plain: string, html = ''): string {
    const plainNorm = (plain || '').replace(/\u00a0/g, ' ').trim();
    const fromPlain = normalizePastedFilePath(plainNorm);

    for (const href of extractHrefValues(html)) {
        let candidate = href.trim();
        try {
            candidate = decodeURIComponent(candidate);
        } catch {
            // keep undecoded
        }
        const fromHref = normalizePastedFilePath(candidate);
        if (!fromHref) {
            continue;
        }
        if (!fromPlain) {
            return fromHref;
        }
        if (isBasenameOnlyPath(fromPlain) && !isBasenameOnlyPath(fromHref)) {
            return fromHref;
        }
    }

    if (fromPlain) {
        return fromPlain;
    }

    const stripped = plainNorm || stripHtmlToPlainText(html);
    return normalizePastedFilePath(stripped) ?? stripped;
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
