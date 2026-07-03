import { useCallback } from 'preact/hooks';
import { briefHtml, briefVersion, needsRegenerate, compilingBrief, setStatus } from '../state';
import { recompileBrief as recompileApi, copyBrief, copyBriefVersion, sendToAgent } from '../api';

export function BriefPane() {
    const version = briefVersion.value;
    const compiling = compilingBrief.value;
    const stale = needsRegenerate.value;

    const refreshClasses = ['icon-btn'];
    if (compiling) refreshClasses.push('refreshing');
    if (stale && !compiling) refreshClasses.push('pulse-hint');

    const handleRecompile = useCallback(async () => {
        if (compilingBrief.value) return;
        compilingBrief.value = true;
        setStatus('Recompiling brief…');
        try {
            await recompileApi();
        } finally {
            compilingBrief.value = false;
        }
    }, []);

    const handleBriefClick = useCallback((e: MouseEvent) => {
        const copyBtn = (e.target as HTMLElement).closest('.brief-copy') as HTMLElement | null;
        const sendBtn = (e.target as HTMLElement).closest('.brief-send') as HTMLElement | null;
        if (copyBtn) {
            e.preventDefault();
            copyBriefVersion(Number(copyBtn.dataset.briefVersion)).catch(() => {});
            return;
        }
        if (sendBtn) {
            e.preventDefault();
            sendToAgent('brief', Number(sendBtn.dataset.briefVersion)).catch(() => {});
        }
    }, []);

    const title = version ? `Agent Prompt · v${version}` : 'Agent Prompt';

    return (
        <section class="pane" aria-label="Agent prompt">
            <div class="pane-head">
                <h2>{title}</h2>
                <div class="pane-actions">
                    <button
                        type="button"
                        class={refreshClasses.join(' ')}
                        title="Recompile agent prompt"
                        aria-label="Recompile agent prompt"
                        disabled={compiling}
                        onClick={() => handleRecompile().catch(() => {})}
                    >
                        <svg viewBox="0 0 24 24">
                            <path d="M4 12a8 8 0 0 1 13.4-5.9" />
                            <path d="M20 3v6h-6" />
                            <path d="M20 12a8 8 0 0 1-13.4 5.9" />
                            <path d="M4 21v-6h6" />
                        </svg>
                    </button>
                    <button
                        type="button"
                        class="icon-btn"
                        title="Copy agent prompt"
                        aria-label="Copy agent prompt"
                        onClick={() => copyBrief().catch(() => {})}
                    >
                        <svg viewBox="0 0 24 24">
                            <rect x="9" y="9" width="11" height="11" rx="1" />
                            <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                        </svg>
                    </button>
                    <button
                        type="button"
                        class="icon-btn"
                        title="Send agent prompt"
                        aria-label="Send agent prompt"
                        onClick={() => sendToAgent('brief').catch(() => {})}
                    >
                        <svg viewBox="0 0 24 24">
                            <path d="M6 8l8 4-8 4V8z" />
                            <path d="M16 8l4 4-4 4V8z" />
                        </svg>
                    </button>
                </div>
            </div>
            <div class={'pane-body' + (compiling ? ' brief-compiling' : '')}>
                <div
                    class="panel-inner"
                    role="region"
                    aria-label="Compiled brief"
                    dangerouslySetInnerHTML={{ __html: briefHtml.value }}
                    onClick={handleBriefClick}
                />
            </div>
        </section>
    );
}
