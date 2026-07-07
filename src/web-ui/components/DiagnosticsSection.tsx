import { appSettings } from '../state';
import { runSettingsAction } from '../api';
import { setStatus } from '../state';

export function DiagnosticsSection() {
    const d = appSettings.value?.diagnostics;
    if (!d) {
        return null;
    }

    const hostLabel =
        d.extensionHost === 'remote'
            ? `remote${d.remoteName ? ` (${d.remoteName})` : ''}`
            : 'local';

    const updateLabel =
        d.updateStatus === 'available' && d.latestVersion
            ? `update available (installed v${d.installedVersion}, latest v${d.latestVersion})`
            : d.updateStatus === 'current' && d.latestVersion
              ? `up to date (v${d.installedVersion})`
              : d.updateStatus === 'error'
                ? 'check failed'
                : `not checked yet (installed v${d.installedVersion})`;

    return (
        <details class="settings-section" open>
            <summary>
                <span>
                    Host &amp; updates
                    <span class="section-hint">Extension host, update channel, diagnostics</span>
                </span>
            </summary>
            <div class="settings-section-body">
                <div class="diagnostics-grid" role="status" aria-label="Extension diagnostics">
                    <span>Extension host: {hostLabel}</span>
                    <span>Install: {d.installChannelHint}</span>
                    <span>
                        Env override: {d.envOverrideDetected ? d.envOverrideHint || 'yes' : 'no'}
                    </span>
                    <span>Updates (Open VSX): {updateLabel}</span>
                    <span>Pin state: {d.pinStateHint}</span>
                </div>

                {d.pinState === 'pinned' ? (
                    <p class="hint warn">
                        Teacher is pinned in your profile. Updates may not apply until you unpin in the Extensions
                        view or reinstall. The update command tries to clear the pin flag automatically.
                    </p>
                ) : null}

                {d.vscodeLmRemoteWarning ? (
                    <p class="hint warn">
                        Remote host: GitHub Copilot via vscode.lm may return empty compile output here.
                        Use cloud inference or Ollama on the remote side, or set compile provider to cloud/ollama.
                    </p>
                ) : null}

                {d.updateMessage && d.updateStatus === 'error' ? (
                    <p class="hint warn">{d.updateMessage}</p>
                ) : null}

                <div class="copy-row">
                    <button
                        type="button"
                        onClick={() => {
                            runSettingsAction('checkForUpdates').catch(() => {
                                setStatus('Update check failed.', 'warn');
                            });
                        }}
                    >
                        Check updates
                    </button>
                    <button
                        type="button"
                        disabled={d.updateStatus !== 'available'}
                        title="Download and install the latest VSIX from Open VSX"
                        onClick={() => {
                            runSettingsAction('updateFromOpenVsx').catch(() => {
                                setStatus('Update failed.', 'warn');
                            });
                        }}
                    >
                        Install update
                    </button>
                    <button
                        type="button"
                        class="ghost"
                        onClick={() => {
                            runSettingsAction('openGitHubReleases').catch(() => {});
                        }}
                    >
                        Releases
                    </button>
                </div>
                <p class="hint">
                    Open VSX and VSIX installs do not auto-update. After updating, reload the window. On SSH/WSL/dev
                    containers, install where the extension host runs.
                </p>
            </div>
        </details>
    );
}
