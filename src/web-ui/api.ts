import {
    appSettings, health as healthSignal, setStatus, applySession, applyRuntime,
    codewordsTerms, codewordsPath, briefMarkdown, briefByVersion
} from './state';
import type { AppSettingsView, HealthInfo } from '../shared/types';

export function handleChange(key: string): (e: Event) => void {
    return (e: Event) => {
        const el = e.currentTarget as HTMLInputElement | HTMLSelectElement;
        let value: boolean | string | number;
        if (el instanceof HTMLInputElement && el.type === 'checkbox') {
            value = el.checked;
        } else if (el instanceof HTMLInputElement && el.type === 'number') {
            value = Number(el.value);
        } else {
            value = el.value;
        }
        patchSetting(key, value).catch(() => setStatus('Could not save setting.', 'warn'));
    };
}

export async function loadSettings(): Promise<void> {
    const json = await fetch('/api/settings').then(r => r.json()).catch(() => ({}));
    if (json.settings) appSettings.value = json.settings;
    if (json.runtime) applyRuntime(json.runtime);
}

export async function patchSetting(key: string, value: boolean | string | number): Promise<void> {
    const json = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value })
    }).then(r => r.json());
    if (json.settings) appSettings.value = json.settings;
    if (!json.ok) setStatus(json.error || 'Setting update failed.', 'warn');
}

export async function saveLlmKey(key: string): Promise<boolean> {
    if (!key.trim()) {
        setStatus('Enter an API key first.', 'warn');
        return false;
    }
    const json = await fetch('/api/settings/llm-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: key.trim() })
    }).then(r => r.json());
    if (json.settings) appSettings.value = json.settings;
    if (json.ok) {
        setStatus('API key saved.', 'ok');
        refreshHealth().catch(() => {});
        return true;
    }
    setStatus(json.error || 'Could not save API key.', 'warn');
    return false;
}

export async function loadSession(): Promise<void> {
    const json = await fetch('/api/session').then(r => r.json()).catch(() => ({}));
    applySession(json.session);
}

export async function addSegment(text: string): Promise<Record<string, unknown>> {
    const res = await fetch('/api/segment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'HTTP ' + res.status);
    return json;
}

export async function addAudio(blob: Blob, mimeType: string): Promise<Record<string, unknown>> {
    const res = await fetch('/api/audio', {
        method: 'POST',
        headers: { 'Content-Type': mimeType },
        body: blob
    });
    const json = await res.json();
    if (!res.ok && !json.session) throw new Error(json.error || 'HTTP ' + res.status);
    return json;
}

export async function updateSegment(id: number, text: string): Promise<void> {
    try {
        const json = await fetch('/api/segment/' + id, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, recompile: false })
        }).then(r => r.json());
        if (json.session) applySession(json.session);
        if (json.session?.status) setStatus(json.session.status, 'ok');
    } catch {
        setStatus('Could not save segment edit.', 'warn');
    }
}

export async function revertFix(id: number, heard: string, corrected: string): Promise<void> {
    try {
        const json = await fetch('/api/segment/' + id + '/fix', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ heard, corrected, action: 'revert' })
        }).then(r => r.json());
        if (json.session) applySession(json.session);
        if (json.session?.status) setStatus(json.session.status, 'ok');
    } catch {
        setStatus('Could not revert correction.', 'warn');
    }
}

export async function recompileBrief(): Promise<void> {
    const json = await fetch('/api/compile', { method: 'POST' }).then(r => r.json());
    if (json.session) applySession(json.session);
    const err = json.session?.compileError;
    setStatus(
        err ? 'Compile failed: ' + err : 'Brief refreshed.',
        err ? 'warn' : 'ok'
    );
}

export async function sendToAgent(source: string, version?: number): Promise<void> {
    setStatus('Sending…');
    const json = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, briefVersion: version })
    }).then(r => r.json());
    setStatus(json.message || (json.ok ? 'Sent.' : 'Send failed.'), json.ok ? 'ok' : 'warn');
}

export async function clearSession(): Promise<void> {
    const json = await fetch('/api/reset', { method: 'POST' }).then(r => r.json());
    applySession(json.session);
    briefMarkdown.value = '';
}

export async function fetchHandoff(): Promise<string> {
    const json = await fetch('/api/handoff').then(r => r.json()).catch(() => ({}));
    return ((json.handoff as string) || '').trim();
}

export async function getSttAudit(): Promise<string> {
    const json = await fetch('/api/stt-audit').then(r => r.json()).catch(() => ({}));
    return ((json.audit as string) || '').trim();
}

export async function loadCodewords(): Promise<void> {
    const json = await fetch('/api/codewords').then(r => r.json()).catch(() => ({}));
    if (json.path) codewordsPath.value = json.path;
    if (json.ok && Array.isArray(json.terms)) {
        codewordsTerms.value = json.terms;
    } else if (json.message) {
        setStatus(json.message, 'warn');
    }
}

export async function saveCodewords(terms: string[]): Promise<void> {
    const json = await fetch('/api/codewords', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ terms })
    }).then(r => r.json());
    if (json.ok && Array.isArray(json.terms)) {
        codewordsTerms.value = json.terms;
        setStatus(json.message || 'Glossary saved.', 'ok');
        refreshHealth().catch(() => {});
    } else {
        setStatus(json.message || json.error || 'Could not save glossary.', 'warn');
    }
}

export async function pickWhisperPath(target: string): Promise<void> {
    const json = await fetch('/api/whisper/pick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target })
    }).then(r => r.json());
    if (json.settings) appSettings.value = json.settings;
    if (json.cancelled) return;
    if (json.ok) {
        setStatus('Saved ' + target + ' path.', 'ok');
        refreshHealth().catch(() => {});
    } else {
        setStatus(json.error || 'Could not pick file.', 'warn');
    }
}

export async function discoverWhisperPaths(): Promise<void> {
    const json = await fetch('/api/whisper/discover', { method: 'POST' }).then(r => r.json());
    if (json.settings) appSettings.value = json.settings;
    setStatus(json.message || (json.ok ? 'Discovery finished.' : json.error), json.ok ? 'ok' : 'warn');
    refreshHealth().catch(() => {});
}

export async function testWhisperSetup(): Promise<void> {
    const json = await fetch('/api/whisper/test', { method: 'POST' }).then(r => r.json());
    if (json.settings) appSettings.value = json.settings;
    setStatus(json.message || json.error || 'Whisper test finished.', json.ok ? 'ok' : 'warn');
    refreshHealth().catch(() => {});
}

export async function refreshHealth(): Promise<void> {
    const h = await fetch('/health').then(r => r.json()) as HealthInfo;
    healthSignal.value = h;
    let msg = 'Ready. Tap mic to speak';
    if (h.compileReady) msg += ' · brief compiler ready';
    else msg += ' · compiler not ready (API key or Ollama)';
    setStatus(msg, h.compileReady ? 'ok' : 'warn');
    loadSettings().catch(() => {});
}

export async function applyInferencePreset(presetId: string): Promise<void> {
    const s = appSettings.peek();
    if (!s) return;

    const isCustom = !presetId || presetId === 'custom';
    const isOllama = presetId === 'ollama-openai';

    if (isCustom) {
        setStatus('Custom — set URL, model, and key below.', 'ok');
        return;
    }

    const preset = s.inferencePresets.find(p => p.id === presetId);
    if (!preset?.baseUrl) return;

    await patchSetting('teacher.inference.llm.baseUrl', preset.baseUrl);
    await patchSetting('teacher.inference.llm.model', preset.model);

    if (isOllama) {
        await patchSetting('teacher.compile.provider', 'auto');
        setStatus('Ollama — no API key needed.', 'ok');
    } else {
        const preferCloud = presetId !== 'openai';
        if (preferCloud) {
            await patchSetting('teacher.compile.provider', 'cloud');
            setStatus(preset.label + ' · compile set to Cloud only.', 'ok');
        } else {
            setStatus('Provider: ' + preset.label, 'ok');
        }
    }
    refreshHealth().catch(() => {});
}

export async function copyBrief(): Promise<void> {
    const handoff = await fetchHandoff();
    if (handoff) {
        await navigator.clipboard.writeText(handoff);
        setStatus('Agent handoff copied (with header).', 'ok');
        return;
    }
    const versions = Object.keys(briefByVersion.peek()).map(Number).sort((a, b) => b - a);
    if (versions[0]) {
        await copyBriefVersion(versions[0]);
        return;
    }
    const json = await fetch('/api/session').then(r => r.json()).catch(() => ({}));
    const text = ((json.session?.compiled as string) || briefMarkdown.peek() || '').trim();
    if (!text || text.startsWith('Speak')) {
        setStatus('Nothing to copy yet.', 'warn');
        return;
    }
    await navigator.clipboard.writeText(text);
    setStatus('Agent prompt copied.', 'ok');
}

export async function copyBriefVersion(version: number): Promise<void> {
    const handoff = await fetchHandoff();
    if (handoff) {
        await navigator.clipboard.writeText(handoff);
        setStatus('Agent handoff copied (with header).', 'ok');
        return;
    }
    const text = (briefByVersion.peek()[version] || briefMarkdown.peek() || '').trim();
    if (!text || text.startsWith('Speak')) {
        setStatus('Nothing to copy yet.', 'warn');
        return;
    }
    await navigator.clipboard.writeText(text);
    setStatus('Agent prompt copied.', 'ok');
}

export async function copySttAudit(): Promise<void> {
    const text = await getSttAudit();
    if (!text || text.startsWith('No segments')) {
        setStatus('No STT audit yet. Speak first.', 'warn');
        return;
    }
    await navigator.clipboard.writeText(text);
    setStatus('STT audit copied. Paste to report correction deltas.', 'ok');
}

export async function copyText(text: string, okMsg: string): Promise<void> {
    try {
        await navigator.clipboard.writeText(text);
        setStatus(okMsg, 'ok');
    } catch {
        setStatus('Could not copy to clipboard.', 'warn');
    }
}
