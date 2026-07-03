import { useRef, useCallback } from 'preact/hooks';
import { transcriptHtml, activeFixTarget, setStatus } from '../state';
import { updateSegment, copySttAudit, sendToAgent, copyText } from '../api';

export function TranscriptPane() {
    const panelRef = useRef<HTMLDivElement>(null);
    const editSnapshotRef = useRef<{ index: number; text: string } | null>(null);

    const gatherWordsText = useCallback((): string => {
        if (!panelRef.current) return '';
        const parts = [...panelRef.current.querySelectorAll('.seg-text')]
            .map(el => (el as HTMLElement).textContent?.trim() || '')
            .filter(Boolean);
        return parts.join('\n\n');
    }, []);

    const handleFocusIn = useCallback((e: FocusEvent) => {
        const el = (e.target as HTMLElement).closest('.seg-text') as HTMLElement | null;
        if (el) {
            editSnapshotRef.current = {
                index: Number(el.dataset.segmentIndex),
                text: el.innerText.trim()
            };
        }
    }, []);

    const handleFocusOut = useCallback((e: FocusEvent) => {
        const el = (e.target as HTMLElement).closest('.seg-text') as HTMLElement | null;
        if (!el || !editSnapshotRef.current) return;
        const idx = Number(el.dataset.segmentIndex);
        const text = el.innerText.trim();
        const snap = editSnapshotRef.current;
        editSnapshotRef.current = null;
        if (text === snap.text) return;
        updateSegment(idx, text).catch(() => {});
    }, []);

    const handleClick = useCallback((e: MouseEvent) => {
        const word = (e.target as HTMLElement).closest('.fix-word') as HTMLElement | null;
        if (word) {
            e.preventDefault();
            const rect = word.getBoundingClientRect();
            activeFixTarget.value = {
                index: Number(word.dataset.segmentIndex),
                heard: word.dataset.heard || '',
                corrected: word.dataset.corrected || '',
                rect: {
                    left: Math.min(rect.left, window.innerWidth - 180),
                    bottom: rect.bottom + 6
                }
            };
            return;
        }
        const popover = document.querySelector('.fix-popover');
        if (popover && !popover.contains(e.target as Node)) {
            activeFixTarget.value = null;
        }
    }, []);

    const copyWords = useCallback(async () => {
        const text = gatherWordsText();
        if (!text) { setStatus('No words to copy yet.', 'warn'); return; }
        await navigator.clipboard.writeText(text);
        setStatus('Your words copied.', 'ok');
    }, [gatherWordsText]);

    return (
        <section class="pane" aria-label="Transcript">
            <div class="pane-head">
                <h2>Your Words</h2>
                <div class="pane-actions">
                    <button
                        type="button"
                        class="icon-btn"
                        title="Copy STT audit (heard vs corrected pipeline)"
                        aria-label="Copy STT audit"
                        onClick={() => copySttAudit().catch(() => {})}
                    >
                        <svg viewBox="0 0 24 24">
                            <path d="M9 5H5a2 2 0 0 0-2 2v12" />
                            <path d="M9 3h10v18H9" />
                            <path d="M14 8H7" />
                            <path d="M14 12H7" />
                        </svg>
                    </button>
                    <button
                        type="button"
                        class="icon-btn"
                        title="Copy your words"
                        aria-label="Copy your words"
                        onClick={() => copyWords().catch(() => {})}
                    >
                        <svg viewBox="0 0 24 24">
                            <rect x="9" y="9" width="11" height="11" rx="1" />
                            <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                        </svg>
                    </button>
                    <button
                        type="button"
                        class="icon-btn"
                        title="Send your words to agent"
                        aria-label="Send your words"
                        onClick={() => sendToAgent('words').catch(() => {})}
                    >
                        <svg viewBox="0 0 24 24">
                            <path d="M6 8l8 4-8 4V8z" />
                            <path d="M16 8l4 4-4 4V8z" />
                        </svg>
                    </button>
                </div>
            </div>
            <div class="pane-body">
                <div
                    ref={panelRef}
                    class="panel-inner"
                    role="region"
                    aria-label="Transcript segments"
                    dangerouslySetInnerHTML={{ __html: transcriptHtml.value }}
                    onFocusIn={handleFocusIn}
                    onFocusOut={handleFocusOut}
                    onClick={handleClick}
                />
            </div>
        </section>
    );
}
