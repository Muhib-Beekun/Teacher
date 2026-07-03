import { appSettings } from '../state';
import { handleChange } from '../api';

export function SpeechSection() {
    const s = appSettings.value;

    return (
        <details class="settings-section">
            <summary>
                <span>
                    Speech
                    <span class="section-hint">STT provider and post-corrections</span>
                </span>
            </summary>
            <div class="settings-section-body">
                <div class="setting-row">
                    <label for="setSttProvider">
                        STT provider
                        <span class="hint">Browser speech is default. Hear-time bias needs Whisper or Deepgram.</span>
                    </label>
                    <select
                        id="setSttProvider"
                        value={s?.sttProvider || 'auto'}
                        onChange={handleChange('teacher.stt.provider')}
                    >
                        <option value="auto">Auto</option>
                        <option value="webspeech">Browser speech</option>
                        <option value="whisper">Local whisper</option>
                        <option value="deepgram">Deepgram</option>
                    </select>
                </div>

                <div class="stt-callout">
                    Post-hoc lexicon + homonym pass run on every provider. Recognition-time glossary
                    bias requires Whisper or Deepgram.
                </div>

                <div class="setting-row">
                    <label for="setHomonymPass">
                        Fix misheard words
                        <span class="hint">Matches mishears to workspace symbols and glossary terms.</span>
                    </label>
                    <input
                        type="checkbox"
                        id="setHomonymPass"
                        checked={s?.homonymPass ?? true}
                        onChange={handleChange('teacher.stt.homonymPass')}
                    />
                </div>

                <div class="setting-row">
                    <label for="setPolishStt">
                        AI-powered cleanup
                        <span class="hint">Uses your inference provider to fix remaining STT errors before compile.</span>
                    </label>
                    <input
                        type="checkbox"
                        id="setPolishStt"
                        checked={s?.polishStt ?? true}
                        onChange={handleChange('teacher.compile.polishStt')}
                    />
                </div>

                <div class="setting-row">
                    <label for="setRebuildMode">
                        Index rebuild
                        <span class="hint">When to refresh workspace symbols.</span>
                    </label>
                    <select
                        id="setRebuildMode"
                        value={s?.contextRebuildMode || 'clearSession'}
                        onChange={handleChange('teacher.context.rebuildMode')}
                    >
                        <option value="clearSession">Clear session only</option>
                        <option value="onFileChange">On file change</option>
                        <option value="eachSegment">Each mic pause</option>
                    </select>
                </div>
            </div>
        </details>
    );
}
