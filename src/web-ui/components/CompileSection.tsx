import { appSettings } from '../state';
import { handleChange } from '../api';

export function CompileSection() {
    const s = appSettings.value;

    return (
        <details class="settings-section">
            <summary>
                <span>
                    Compile
                    <span class="section-hint">Brief structure and auto-compile</span>
                </span>
            </summary>
            <div class="settings-section-body">
                <div class="setting-row">
                    <label for="setCompileMode">Mode</label>
                    <select
                        id="setCompileMode"
                        value={s?.compileMode || 'teacher'}
                        onChange={handleChange('teacher.compile.mode')}
                    >
                        <option value="teacher">Structured brief</option>
                        <option value="verbatim">Verbatim join</option>
                        <option value="polish">Polish (deferred)</option>
                    </select>
                </div>

                <div class="setting-row">
                    <label for="setLiveCompile">
                        Auto-compile after each pause
                        <span class="hint">Recompiles the agent prompt after every mic pause. Off = manual Refresh only.</span>
                    </label>
                    <input
                        type="checkbox"
                        id="setLiveCompile"
                        checked={s?.compileLive ?? true}
                        onChange={handleChange('teacher.compile.live')}
                    />
                </div>
            </div>
        </details>
    );
}
