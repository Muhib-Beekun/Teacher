import { appSettings, runtime, micRuntime } from '../state';

export function StatusBlock() {
    const s = appSettings.value;
    const rt = runtime.value;
    const d = s?.diagnostics;

    const version = s?.extensionVersion ? 'Teacher v' + s.extensionVersion : 'Teacher v…';
    const installed = d?.installedVersion ? `Installed: v${d.installedVersion}` : null;
    const latest =
        d?.latestVersion && d.updateStatus === 'available'
            ? `Latest: v${d.latestVersion}`
            : d?.latestVersion && d.updateStatus === 'current'
              ? `Latest: v${d.latestVersion} (current)`
              : null;
    const update =
        d?.updateStatus === 'available' && d.latestVersion
            ? `Update: v${d.latestVersion} available`
            : d?.updateStatus === 'current'
              ? 'Update: up to date'
              : d?.updateStatus === 'error'
                ? 'Update: check failed'
                : 'Update: —';
    const host =
        d?.extensionHost === 'remote'
            ? `Host: remote${d.remoteName ? ` (${d.remoteName})` : ''}`
            : d
              ? 'Host: local'
              : 'Host: …';
    const compile = s
        ? (s.compilerReady
            ? 'Compile: ' + (s.activeCompileLabel || s.compileLabel || 'ready')
            : 'Compile: not configured')
        : 'Compile: …';
    const inference = 'Inference: ' + (s?.cloudInferenceLabel || '…');
    const mic = 'Mic: ' + micRuntime.value;
    const segments = 'Segments: ' + (rt?.segmentCount ?? 0);
    const brief = rt?.needsRegenerate
        ? 'Brief: stale (edit or refresh to recompile)'
        : 'Brief: current';
    const context = 'Context: ' + (rt?.contextTermCount ?? 0) + ' terms';

    return (
        <div class="settings-status" role="status" aria-label="System status">
            <span>{version}</span>
            {installed ? <span>{installed}</span> : null}
            {latest ? <span>{latest}</span> : null}
            <span>{update}</span>
            <span>{host}</span>
            <span>{compile}</span>
            <span>{inference}</span>
            <span>{mic}</span>
            <span>{segments}</span>
            <span>{brief}</span>
            <span>{context}</span>
        </div>
    );
}
