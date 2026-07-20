import { describe, expect, it } from 'vitest';
import {
    extractHrefValues,
    extractPathTokens,
    isPathExcluded,
    normalizeFilePathToken,
    normalizePastedFilePath,
    resolveClipboardToPromptText,
    stripHtmlToPlainText
} from '../../src/context/pathTokens';
import { extractWorkspaceTargets } from '../../src/context/targetMatch';
import { emptyVoiceSessionContext } from '../../src/context/VoiceSessionContext';

describe('pathTokens', () => {
    it('normalizes file:// URIs and quoted paths', () => {
        expect(normalizeFilePathToken('"src/foo.ts"')).toBe('src/foo.ts');
        expect(normalizeFilePathToken('file:///C:/Users/Public/Projects/Teacher/src/foo.ts')).toBe(
            'C:/Users/Public/Projects/Teacher/src/foo.ts'
        );
    });

    it('detects single-path clipboard pastes', () => {
        expect(normalizePastedFilePath('src/web-ui/components/CapturePanel.tsx')).toBe(
            'src/web-ui/components/CapturePanel.tsx'
        );
        expect(normalizePastedFilePath('C:\\Users\\Public\\Projects\\Teacher\\src\\foo.ts')).toBe(
            'C:\\Users\\Public\\Projects\\Teacher\\src\\foo.ts'
        );
        expect(normalizePastedFilePath('please look at src/foo.ts later')).toBeNull();
    });

    it('extracts include and minus-prefix exclude tokens', () => {
        const hits = extractPathTokens('fix src/a.ts and skip -src/b.ts also `src/c.md`');
        expect(hits).toEqual([
            { path: 'src/a.ts', excluded: false },
            { path: 'src/b.ts', excluded: true },
            { path: 'src/c.md', excluded: false }
        ]);
    });

    it('matches excluded basenames and full paths', () => {
        const excluded = new Set(['src/b.ts']);
        expect(isPathExcluded('src/b.ts', excluded)).toBe(true);
        expect(isPathExcluded('b.ts', excluded)).toBe(true);
        expect(isPathExcluded('src/a.ts', excluded)).toBe(false);
    });

    it('resolves hyperlink clipboard HTML to a file path without markup', () => {
        const html =
            '<html><body><!--StartFragment--><a href="file:///C:/Users/Public/Projects/Teacher/src/foo.ts">foo.ts</a><!--EndFragment--></body></html>';
        expect(extractHrefValues(html)).toEqual([
            'file:///C:/Users/Public/Projects/Teacher/src/foo.ts'
        ]);
        expect(resolveClipboardToPromptText('foo.ts', html)).toBe(
            'C:/Users/Public/Projects/Teacher/src/foo.ts'
        );
        expect(resolveClipboardToPromptText('', html)).toBe(
            'C:/Users/Public/Projects/Teacher/src/foo.ts'
        );
        expect(stripHtmlToPlainText('<a href="x">hello &amp; world</a>')).toBe('hello & world');
        expect(resolveClipboardToPromptText('just some words', '<b>ignored</b>')).toBe(
            'just some words'
        );
    });
});

describe('extractWorkspaceTargets', () => {
    it('includes pasted-style paths and honors minus exclusion', () => {
        const ctx = emptyVoiceSessionContext();
        ctx.targetFiles = ['src/a.ts', 'src/b.ts', 'src/other.ts'];
        const targets = extractWorkspaceTargets(
            'Work on src/a.ts please, and -src/b.ts should stay out. Also mention other.',
            ctx
        );
        expect(targets).toContain('src/a.ts');
        expect(targets).toContain('src/other.ts');
        expect(targets).not.toContain('src/b.ts');
    });

    it('includes absolute Windows paths from prompt text', () => {
        const targets = extractWorkspaceTargets(
            'Open C:\\Users\\Public\\Projects\\Teacher\\src\\foo.ts',
            emptyVoiceSessionContext()
        );
        expect(targets.some((t) => /foo\.ts$/i.test(t))).toBe(true);
    });
});
