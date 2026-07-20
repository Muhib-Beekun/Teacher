import { describe, expect, it } from 'vitest';
import { findPhraseSymbolFixes } from '../../src/stt/symbolPhraseMatch';

describe('findPhraseSymbolFixes', () => {
    it('corrects spoken camelCase phrases to dictionary symbols', () => {
        const fixes = findPhraseSymbolFixes('please update the capture panel next', [
            'CapturePanel',
            'SessionManager'
        ]);
        expect(fixes.some((f) => f.corrected === 'CapturePanel' && /capture panel/i.test(f.heard))).toBe(
            true
        );
    });

    it('matches file basenames even when the dictionary term includes an extension', () => {
        const fixes = findPhraseSymbolFixes('open the session manager file', ['SessionManager.ts']);
        expect(fixes.some((f) => f.corrected === 'SessionManager')).toBe(true);
    });
});
