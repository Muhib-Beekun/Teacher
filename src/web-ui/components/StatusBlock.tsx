import { appSettings, runtime, micRuntime } from '../state';

export function StatusBlock() {
    const s = appSettings.value;
    const rt = runtime.value;

    const version = s?.extensionVersion ? 'Teacher v' + s.extensionVersion : 'Teacher v…';
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
            <span>{compile}</span>
            <span>{inference}</span>
            <span>{mic}</span>
            <span>{segments}</span>
            <span>{brief}</span>
            <span>{context}</span>
        </div>
    );
}
