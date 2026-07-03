import { statusText, statusKind, settingsOpen, setStatus } from '../state';
import { loadSettings, loadCodewords, loadSession, clearSession as clearSessionApi } from '../api';

function openSettings(): void {
    settingsOpen.value = true;
    loadSettings().catch(() => {});
    loadCodewords().catch(() => {});
    loadSession().then(() => loadSettings()).catch(() => {});
}

export function TopBar() {
    const kind = statusKind.value;
    const statusClass = 'status' + (kind ? ' ' + kind : '');

    return (
        <header class="topbar">
            <div class="brand">
                <img class="brand-icon" src="/icon.png" width={28} height={28} alt="" />
                <div class="brand-text">
                    <h1>Teacher</h1>
                    <p class="tagline">Lecture your AI</p>
                </div>
            </div>
            <div class={statusClass} aria-live="polite">{statusText.value}</div>
            <button
                type="button"
                class="ghost"
                title="Configuration"
                onClick={openSettings}
            >
                Settings
            </button>
            <button
                type="button"
                class="ghost"
                onClick={() => {
                    if (!confirm('Clear the entire session? This cannot be undone.')) return;
                    clearSessionApi().catch(() => {});
                }}
            >
                Clear session
            </button>
        </header>
    );
}
