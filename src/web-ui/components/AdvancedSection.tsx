import { useRef, useEffect } from 'preact/hooks';
import { appSettings } from '../state';
import { handleChange, copyText } from '../api';

export function AdvancedSection() {
    const s = appSettings.value;
    const portRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (portRef.current && document.activeElement !== portRef.current) {
            portRef.current.value = String(s?.sidecarPort || 3721);
        }
    }, [s?.sidecarPort]);

    const filter = s?.vscodeSettingsFilter || '@ext:muhib-beekun.teacher';

    return (
        <details class="settings-section">
            <summary>
                <span>
                    Advanced
                    <span class="section-hint">Port, VS Code settings</span>
                </span>
            </summary>
            <div class="settings-section-body">
                <div class="setting-row">
                    <label for="setSidecarPort">
                        Web UI port
                        <span class="hint">Restart extension after change.</span>
                    </label>
                    <input
                        ref={portRef}
                        type="number"
                        id="setSidecarPort"
                        min={1024}
                        max={65535}
                        onChange={handleChange('teacher.capture.sidecarPort')}
                    />
                </div>

                <p class="hint">Deepgram, Ollama, and other flags live in VS Code Settings:</p>
                <div class="copy-row">
                    <code>{filter}</code>
                    <button
                        type="button"
                        title="Copy settings filter"
                        onClick={() => copyText(filter, 'Copied settings filter. Press Ctrl+, and paste.')}
                    >
                        Copy
                    </button>
                </div>
            </div>
        </details>
    );
}
