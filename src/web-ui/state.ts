import { signal } from '@preact/signals';
import type { AppSettingsView, SessionSnapshot, RuntimeInfo, HealthInfo } from '../shared/types';

export const statusText = signal('Connecting…');
export const statusKind = signal('');

export const settingsOpen = signal(false);
export const listening = signal(false);
export const flushing = signal(false);
export const compilingBrief = signal(false);
export const micRuntime = signal('idle');
export const recordingArmed = signal(false);
export const liveEditLock = signal(false);
export const micSpeechBlocked = signal(false);

export const appSettings = signal<AppSettingsView | null>(null);
export const runtime = signal<RuntimeInfo | null>(null);
export const health = signal<HealthInfo>({ stt: 'webspeech' });

export const transcriptHtml = signal('<p class="empty">Session ready.</p>');
export const briefHtml = signal('<p class="empty">Speak. Your agent brief appears here after each pause.</p>');
export const briefMarkdown = signal('');
export const briefByVersion = signal<Record<number, string>>({});
export const briefVersion = signal<number | undefined>(undefined);
export const needsRegenerate = signal(false);
export const compileError = signal<string | undefined>(undefined);

export const codewordsTerms = signal<string[]>([]);
export const codewordsPath = signal('.teacher/codewords.txt');

export const activeFixTarget = signal<{
    index: number;
    heard: string;
    corrected: string;
    rect: { left: number; bottom: number };
} | null>(null);

export function setStatus(text: string, kind?: string): void {
    statusText.value = text;
    statusKind.value = kind || '';
}

export function applySession(session: SessionSnapshot | null | undefined): void {
    if (!session) return;
    if (session.transcriptHtml) transcriptHtml.value = session.transcriptHtml;
    if (session.briefHtml) briefHtml.value = session.briefHtml;
    if (session.compiled !== undefined) briefMarkdown.value = session.compiled;
    if (session.briefMarkdownByVersion) briefByVersion.value = session.briefMarkdownByVersion;
    briefVersion.value = session.briefVersion;
    compileError.value = session.compileError;
    needsRegenerate.value = !!session.needsRegenerate;
    if (session.compileError) setStatus('Compile: ' + session.compileError, 'warn');
}

export function applyRuntime(rt: RuntimeInfo | null | undefined): void {
    if (!rt) return;
    runtime.value = rt;
}
