import { useEffect, useRef } from 'preact/hooks';
import { settingsOpen } from '../state';
import { StatusBlock } from './StatusBlock';
import { InferenceSection } from './InferenceSection';
import { SpeechSection } from './SpeechSection';
import { GlossarySection } from './GlossarySection';
import { WhisperSection } from './WhisperSection';
import { CompileSection } from './CompileSection';
import { SendSection } from './SendSection';
import { AdvancedSection } from './AdvancedSection';
import { DiagnosticsSection } from './DiagnosticsSection';

export function SettingsPanel() {
    const panelRef = useRef<HTMLElement>(null);
    const previousFocusRef = useRef<Element | null>(null);

    useEffect(() => {
        if (!settingsOpen.value) return;
        previousFocusRef.current = document.activeElement;

        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                settingsOpen.value = false;
            }
            if (e.key === 'Tab' && panelRef.current) {
                const focusable = panelRef.current.querySelectorAll<HTMLElement>(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                );
                if (!focusable.length) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };
        document.addEventListener('keydown', handler);
        return () => {
            document.removeEventListener('keydown', handler);
            if (previousFocusRef.current instanceof HTMLElement) {
                previousFocusRef.current.focus();
            }
        };
    }, [settingsOpen.value]);

    if (!settingsOpen.value) return null;

    return (
        <div
            class="settings-backdrop open"
            onClick={(e) => {
                if (e.target === e.currentTarget) settingsOpen.value = false;
            }}
        >
            <aside
                ref={panelRef}
                class="settings-panel"
                role="dialog"
                aria-labelledby="settingsTitle"
                aria-modal="true"
            >
                <h2 id="settingsTitle">Configuration</h2>
                <StatusBlock />
                <DiagnosticsSection />
                <InferenceSection />
                <SpeechSection />
                <GlossarySection />
                <WhisperSection />
                <CompileSection />
                <SendSection />
                <AdvancedSection />
                <div class="settings-footer">
                    <button type="button" onClick={() => { settingsOpen.value = false; }}>
                        Done
                    </button>
                </div>
            </aside>
        </div>
    );
}
