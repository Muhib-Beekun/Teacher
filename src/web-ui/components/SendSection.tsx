import { appSettings } from '../state';
import { handleChange } from '../api';

export function SendSection() {
    const s = appSettings.value;

    return (
        <details class="settings-section">
            <summary>
                <span>
                    Send
                    <span class="section-hint">Paste into Composer / chat</span>
                </span>
            </summary>
            <div class="settings-section-body">
                <div class="setting-row">
                    <label for="setAutoPaste">Auto-paste into Composer</label>
                    <input
                        type="checkbox"
                        id="setAutoPaste"
                        checked={s?.sendAutoPaste ?? true}
                        onChange={handleChange('teacher.send.autoPaste')}
                    />
                </div>

                <div class="setting-row">
                    <label for="setAutoSubmit">
                        Auto-submit prompt
                        <span class="hint">Best-effort; may need Enter on some Cursor builds.</span>
                    </label>
                    <input
                        type="checkbox"
                        id="setAutoSubmit"
                        checked={s?.sendAutoSubmit ?? true}
                        onChange={handleChange('teacher.send.autoSubmit')}
                    />
                </div>
            </div>
        </details>
    );
}
