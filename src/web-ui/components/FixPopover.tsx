import { useEffect, useRef, useCallback } from 'preact/hooks';
import { activeFixTarget } from '../state';
import { revertFix } from '../api';

export function FixPopover() {
    const target = activeFixTarget.value;
    const popoverRef = useRef<HTMLDivElement>(null);

    const hide = useCallback(() => { activeFixTarget.value = null; }, []);

    const handleRevert = useCallback(() => {
        if (!target) return;
        revertFix(target.index, target.heard, target.corrected).catch(() => {});
        hide();
    }, [target, hide]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (!popoverRef.current) return;
            if (!popoverRef.current.contains(e.target as Node) && !(e.target as HTMLElement).closest('.fix-word')) {
                hide();
            }
        };
        document.addEventListener('click', handler);
        return () => document.removeEventListener('click', handler);
    }, [hide]);

    if (!target) return null;

    return (
        <div
            ref={popoverRef}
            class="fix-popover"
            role="dialog"
            aria-label="Correction details"
            style={{
                left: target.rect.left + 'px',
                top: target.rect.bottom + 'px'
            }}
        >
            <p>Heard: <b>{target.heard}</b></p>
            <button type="button" onClick={handleRevert}>Revert</button>
        </div>
    );
}
