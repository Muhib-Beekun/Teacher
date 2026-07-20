import { describe, expect, it } from 'vitest';
import {
    applyUtteranceBoost,
    buildSttPromptFromTerms,
    isUsefulContextTerm,
    rankAndCapTerms,
    TermCandidate
} from '../../src/context/contextIndexRank';

describe('contextIndexRank', () => {
    it('ranks higher scores first and caps term count', () => {
        const candidates: TermCandidate[] = [
            { term: 'low', score: 5, source: 'basename' },
            { term: 'high', score: 100, source: 'symbol' },
            { term: 'mid', score: 50, source: 'open_file' }
        ];
        expect(rankAndCapTerms(candidates, 2)).toEqual(['high', 'mid']);
    });

    it('merges duplicate terms keeping max score', () => {
        const candidates: TermCandidate[] = [
            { term: 'Foo', score: 30, source: 'symbol' },
            { term: 'foo', score: 80, source: 'open_file' }
        ];
        expect(rankAndCapTerms(candidates, 10)).toEqual(['foo']);
    });

    it('boosts terms mentioned in recent utterance', () => {
        const candidates: TermCandidate[] = [
            { term: 'CompileService', score: 5, source: 'basename' },
            { term: 'Other', score: 10, source: 'basename' }
        ];
        applyUtteranceBoost(candidates, 'update CompileService next');
        expect(rankAndCapTerms(candidates, 1)[0]).toBe('CompileService');
    });

    it('builds stt prompt from ranked terms', () => {
        const prompt = buildSttPromptFromTerms(['CompileService', 'Ollama']);
        expect(prompt).toContain('CompileService');
        expect(prompt).toContain('Software development dictation');
    });

    it('filters useless terms', () => {
        expect(isUsefulContextTerm('a')).toBe(false);
        expect(isUsefulContextTerm('___')).toBe(false);
        expect(isUsefulContextTerm('CompileService')).toBe(true);
    });

    it('rejects markdown headings and spaced prose that crowd the STT dictionary', () => {
        expect(isUsefulContextTerm('# AmpliJob')).toBe(false);
        expect(isUsefulContextTerm('## About the client')).toBe(false);
        expect(isUsefulContextTerm('Open technical items')).toBe(false);
        expect(isUsefulContextTerm('CapturePanel')).toBe(true);
        expect(isUsefulContextTerm('BrowserSessionBridge')).toBe(true);
        expect(isUsefulContextTerm('teacher-app.js')).toBe(true);
    });
});
