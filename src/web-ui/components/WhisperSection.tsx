import { useRef, useEffect } from 'preact/hooks';
import { appSettings, setStatus } from '../state';
import { patchSetting, pickWhisperPath, discoverWhisperPaths, testWhisperSetup } from '../api';

export function WhisperSection() {
    const s = appSettings.value;
    const w = s?.whisper;
    const binaryRef = useRef<HTMLInputElement>(null);
    const modelRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (binaryRef.current && document.activeElement !== binaryRef.current) {
            binaryRef.current.value = w?.binaryPath || '';
        }
        if (modelRef.current && document.activeElement !== modelRef.current) {
            modelRef.current.value = w?.modelPath || '';
        }
    }, [w?.binaryPath, w?.modelPath]);

    const savePath = (key: string, ref: { current: HTMLInputElement | null }) => {
        const val = ref.current?.value || '';
        patchSetting(key, val).catch(() => setStatus('Could not save setting.', 'warn'));
    };

    return (
        <details class="settings-section">
            <summary>
                <span>
                    Local Whisper
                    <span class="section-hint">Optional · offline hear-time bias</span>
                </span>
            </summary>
            <div class="settings-section-body">
                <div class="stt-callout">
                    <strong>Overhead:</strong> typically <strong>1–5+ s</strong> per pause on CPU.
                    Browser speech is near-instant with no local compute.
                </div>

                <span class={'whisper-status ' + (w?.ready ? 'ready' : 'warn')}>
                    Status: {w?.statusLabel || 'not configured'}
                </span>

                <ol class="whisper-steps">
                    <li>
                        Download <strong>whisper.cpp</strong> from{' '}
                        <a
                            href={s?.whisperReleasesUrl || 'https://github.com/ggml-org/whisper.cpp/releases'}
                            target="_blank"
                            rel="noopener"
                        >
                            releases
                        </a>{' '}
                        (<code>whisper-cli</code> / <code>main.exe</code>).
                    </li>
                    <li>
                        Download a model such as <code>ggml-small.en.bin</code> from{' '}
                        <a
                            href={s?.whisperModelsUrl || 'https://huggingface.co/ggerganov/whisper.cpp/tree/main'}
                            target="_blank"
                            rel="noopener"
                        >
                            Hugging Face
                        </a>.
                    </li>
                    <li>Browse paths below, or <strong>Find on disk</strong>, then <strong>Test setup</strong>.</li>
                    <li>Set STT provider to <strong>Auto</strong> or <strong>Local whisper</strong>.</li>
                </ol>

                <div class="setting-row">
                    <label for="setWhisperBinary">CLI binary</label>
                    <input
                        ref={binaryRef}
                        type="text"
                        id="setWhisperBinary"
                        placeholder="C:\tools\whisper-cli.exe"
                        spellcheck={false}
                        onChange={() => savePath('teacher.stt.whisper.binaryPath', binaryRef)}
                        onBlur={() => savePath('teacher.stt.whisper.binaryPath', binaryRef)}
                    />
                </div>

                <div class="copy-row" style={{ margin: '-4px 0 8px' }}>
                    <button
                        type="button"
                        onClick={() => pickWhisperPath('binary').catch(() => setStatus('Browse failed.', 'warn'))}
                    >
                        Browse binary…
                    </button>
                    <button
                        type="button"
                        onClick={() => pickWhisperPath('model').catch(() => setStatus('Browse failed.', 'warn'))}
                    >
                        Browse model…
                    </button>
                </div>

                <div class="setting-row">
                    <label for="setWhisperModel">Model file</label>
                    <input
                        ref={modelRef}
                        type="text"
                        id="setWhisperModel"
                        placeholder="C:\models\ggml-small.en.bin"
                        spellcheck={false}
                        onChange={() => savePath('teacher.stt.whisper.modelPath', modelRef)}
                        onBlur={() => savePath('teacher.stt.whisper.modelPath', modelRef)}
                    />
                </div>

                <div class="whisper-actions">
                    <button
                        type="button"
                        onClick={() => discoverWhisperPaths().catch(() => setStatus('Discovery failed.', 'warn'))}
                    >
                        Find on disk
                    </button>
                    <button
                        type="button"
                        onClick={() => testWhisperSetup().catch(() => setStatus('Whisper test failed.', 'warn'))}
                    >
                        Test setup
                    </button>
                </div>
            </div>
        </details>
    );
}
