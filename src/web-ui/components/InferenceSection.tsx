import { useState, useRef, useEffect } from 'preact/hooks';
import { appSettings, setStatus } from '../state';
import { patchSetting, saveLlmKey, applyInferencePreset, handleChange, testInference } from '../api';

export function InferenceSection() {
    const s = appSettings.value;
    const [customModelVisible, setCustomModelVisible] = useState(false);
    const [testing, setTesting] = useState(false);
    const baseUrlRef = useRef<HTMLInputElement>(null);
    const customModelRef = useRef<HTMLInputElement>(null);
    const keyRef = useRef<HTMLInputElement>(null);

    const presetId = s?.inferencePresetId || 'custom';
    const isCustom = presetId === 'custom';
    const isOllama = presetId === 'ollama-openai';
    const needsKey = !isOllama;
    const envLocked = s?.llmBaseUrlSource === 'env' || s?.llmModelSource === 'env';

    const presets = s?.inferencePresets || [];
    const allModels = s?.inferenceModels || [];
    const filteredModels = isCustom
        ? allModels
        : allModels.filter(m => m.provider === presetId);
    const currentModel = s?.llmModel || '';
    const modelInList = filteredModels.some(m => m.id === currentModel);

    useEffect(() => {
        if (baseUrlRef.current && document.activeElement !== baseUrlRef.current && isCustom) {
            baseUrlRef.current.value = s?.llmBaseUrl || '';
        }
    }, [s?.llmBaseUrl, isCustom]);

    const handlePresetChange = (e: Event) => {
        const val = (e.currentTarget as HTMLSelectElement).value;
        setCustomModelVisible(false);
        applyInferencePreset(val).catch(() => setStatus('Could not apply preset.', 'warn'));
    };

    const handleModelChange = (e: Event) => {
        const val = (e.currentTarget as HTMLSelectElement).value;
        if (val === '__custom__') {
            setCustomModelVisible(true);
            customModelRef.current?.focus();
            return;
        }
        setCustomModelVisible(false);
        if (val) patchSetting('teacher.inference.llm.model', val).catch(() => setStatus('Could not save model.', 'warn'));
    };

    const handleCustomModelBlur = () => {
        const val = customModelRef.current?.value?.trim();
        if (val) patchSetting('teacher.inference.llm.model', val).catch(() => setStatus('Could not save model.', 'warn'));
    };

    const handleBaseUrlBlur = () => {
        const val = baseUrlRef.current?.value?.trim();
        if (val) patchSetting('teacher.inference.llm.baseUrl', val).catch(() => setStatus('Could not save URL.', 'warn'));
    };

    const handleKeySubmit = () => {
        const key = keyRef.current?.value?.trim() || '';
        saveLlmKey(key).then(ok => { if (ok && keyRef.current) keyRef.current.value = ''; });
    };

    const keyPlaceholder = (() => {
        if (!needsKey) return '';
        if (s?.llmKeySource === 'env') return '•••••••• (from .env)';
        if (s?.llmKeySet) return '•••••••• (saved)';
        const preset = presets.find(p => p.id === presetId);
        return preset?.keyHint || 'sk-…';
    })();

    return (
        <details class="settings-section" open>
            <summary>
                <span>
                    Inference
                    <span class="section-hint">Provider, model, API key, compile routing</span>
                </span>
            </summary>
            <div class="settings-section-body">
                <div class="setting-row stack">
                    <label for="setInferencePreset">Provider</label>
                    <select
                        id="setInferencePreset"
                        value={presetId}
                        disabled={envLocked}
                        onChange={handlePresetChange}
                    >
                        {presets.map(p => (
                            <option key={p.id} value={p.id}>{p.label}</option>
                        ))}
                        <option value="custom">Custom</option>
                    </select>
                </div>

                <div class="setting-row stack">
                    <label for="setLlmModel">Model</label>
                    <select
                        id="setLlmModel"
                        value={customModelVisible ? '__custom__' : (modelInList ? currentModel : currentModel)}
                        onChange={handleModelChange}
                    >
                        {!modelInList && currentModel && (
                            <option value={currentModel}>{currentModel} (current)</option>
                        )}
                        {filteredModels.map(m => (
                            <option key={m.id} value={m.id}>{m.label}</option>
                        ))}
                        <option value="__custom__">Custom model…</option>
                    </select>
                </div>

                {customModelVisible && (
                    <div class="setting-row stack">
                        <label for="setLlmModelCustom">Custom model id</label>
                        <input
                            ref={customModelRef}
                            type="text"
                            id="setLlmModelCustom"
                            placeholder="your-model-id"
                            spellcheck={false}
                            autocomplete="off"
                            onBlur={handleCustomModelBlur}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.currentTarget as HTMLInputElement).blur(); } }}
                        />
                    </div>
                )}

                {isCustom && (
                    <div class="setting-row stack">
                        <label for="setLlmBaseUrl">API base URL</label>
                        <input
                            ref={baseUrlRef}
                            type="text"
                            id="setLlmBaseUrl"
                            placeholder="https://api.openai.com/v1"
                            spellcheck={false}
                            onBlur={handleBaseUrlBlur}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.currentTarget as HTMLInputElement).blur(); } }}
                        />
                    </div>
                )}

                {needsKey && (
                    <div class="setting-row stack">
                        <label for="setLlmKey">
                            API key
                            <span class="hint">Saved to VS Code secrets.</span>
                        </label>
                        <div class="setting-control">
                            <input
                                ref={keyRef}
                                type="password"
                                id="setLlmKey"
                                placeholder={keyPlaceholder}
                                autocomplete="off"
                                spellcheck={false}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleKeySubmit(); } }}
                            />
                            <button type="button" class="inline-save" onClick={handleKeySubmit}>
                                Save
                            </button>
                        </div>
                    </div>
                )}

                <div class="setting-row stack">
                    <label for="setCompileProvider">
                        Compile routing
                        <span class="hint">How briefs are generated.</span>
                    </label>
                    <select
                        id="setCompileProvider"
                        value={s?.compileProvider || 'auto'}
                        onChange={handleChange('teacher.compile.provider')}
                    >
                        <option value="auto">Auto</option>
                        <option value="cloud">Cloud only</option>
                        <option value="ollama">Local Ollama only</option>
                        <option value="vscode-lm">VS Code LM (Copilot)</option>
                    </select>
                    <span class="hint">Auto tries Ollama first, then cloud, then Copilot.</span>
                </div>

                <p class="hint">{isOllama ? '' : (s?.cloudInferenceLabel || '')}</p>

                <div class="setting-row">
                    <button
                        type="button"
                        class="inline-save"
                        disabled={testing}
                        onClick={() => {
                            setTesting(true);
                            testInference().finally(() => setTesting(false));
                        }}
                    >
                        {testing ? 'Testing…' : 'Test connection'}
                    </button>
                    <span class="hint" style={{ marginLeft: '8px' }}>
                        Send a test prompt to verify your inference setup.
                    </span>
                </div>

                {envLocked && (
                    <p class="hint">
                        Locked by <code>INFERENCE_BASE_URL</code> / <code>INFERENCE_MODEL</code> in
                        workspace <code>.env</code>. Remove those lines to unlock.
                    </p>
                )}
            </div>
        </details>
    );
}
