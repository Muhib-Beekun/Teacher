import { describe, it, expect, beforeEach } from 'vitest';
import {
    statusText, statusKind, settingsOpen, listening, flushing,
    compilingBrief, micRuntime, recordingArmed, liveEditLock,
    micSpeechBlocked, micProcessing, appSettings, runtime, health,
    transcriptHtml, briefHtml, briefMarkdown, briefByVersion,
    briefVersion, needsRegenerate, compileError,
    codewordsTerms, codewordsPath, activeFixTarget,
    setStatus, applySession, applyRuntime
} from '../../src/web-ui/state';

describe('state: setStatus', () => {
    beforeEach(() => {
        statusText.value = '';
        statusKind.value = '';
    });

    it('sets status text and kind', () => {
        setStatus('Connected', 'ok');
        expect(statusText.value).toBe('Connected');
        expect(statusKind.value).toBe('ok');
    });

    it('defaults kind to empty string', () => {
        setStatus('Loading…');
        expect(statusKind.value).toBe('');
    });
});

describe('state: applySession', () => {
    beforeEach(() => {
        transcriptHtml.value = '';
        briefHtml.value = '';
        briefMarkdown.value = '';
        briefByVersion.value = {};
        briefVersion.value = undefined;
        compileError.value = undefined;
        needsRegenerate.value = false;
    });

    it('applies session snapshot fields', () => {
        applySession({
            transcriptHtml: '<p>Seg 1</p>',
            briefHtml: '<p>Brief</p>',
            compiled: '## Goal\nTest.',
            briefMarkdownByVersion: { 1: '## Goal\nTest.' },
            briefVersion: 1,
            needsRegenerate: true,
            segmentCount: 1,
            sttLabel: 'webspeech',
            compileLabel: 'cloud',
            contextHint: '100 terms',
        });

        expect(transcriptHtml.value).toBe('<p>Seg 1</p>');
        expect(briefHtml.value).toBe('<p>Brief</p>');
        expect(briefMarkdown.value).toBe('## Goal\nTest.');
        expect(briefByVersion.value).toEqual({ 1: '## Goal\nTest.' });
        expect(briefVersion.value).toBe(1);
        expect(needsRegenerate.value).toBe(true);
    });

    it('sets compile error status when present', () => {
        statusText.value = '';
        statusKind.value = '';
        applySession({
            transcriptHtml: '',
            briefHtml: '',
            compiled: '',
            compileError: 'API timeout',
            briefMarkdownByVersion: {},
            segmentCount: 0,
            sttLabel: '',
            compileLabel: '',
            contextHint: '',
        });
        expect(compileError.value).toBe('API timeout');
        expect(statusText.value).toContain('API timeout');
        expect(statusKind.value).toBe('warn');
    });

    it('ignores null/undefined session', () => {
        applySession(null);
        applySession(undefined);
        expect(transcriptHtml.value).toBe('');
    });
});

describe('state: applyRuntime', () => {
    beforeEach(() => {
        runtime.value = null;
    });

    it('stores runtime info', () => {
        applyRuntime({
            url: 'http://127.0.0.1:3721/',
            segmentCount: 3,
            needsRegenerate: false,
            contextTermCount: 200,
            targetFileCount: 5,
            totalFixCount: 2,
        });
        expect(runtime.value).not.toBeNull();
        expect(runtime.value!.segmentCount).toBe(3);
        expect(runtime.value!.contextTermCount).toBe(200);
    });

    it('ignores null', () => {
        applyRuntime(null);
        expect(runtime.value).toBeNull();
    });
});

describe('state: signal defaults', () => {
    it('has correct initial values', () => {
        expect(settingsOpen.value).toBe(false);
        expect(listening.value).toBe(false);
        expect(flushing.value).toBe(false);
        expect(compilingBrief.value).toBe(false);
        expect(micRuntime.value).toBe('idle');
        expect(recordingArmed.value).toBe(false);
        expect(liveEditLock.value).toBe(false);
        expect(micSpeechBlocked.value).toBe(false);
        expect(micProcessing.value).toBe(false);
    });
});
