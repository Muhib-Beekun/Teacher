interface MicButtonProps {
    active: boolean;
    processing: boolean;
    onClick: () => void;
}

export function MicButton({ active, processing, onClick }: MicButtonProps) {
    const classes = ['mic-btn'];
    if (active) classes.push('active');
    if (processing) classes.push('processing');

    return (
        <div class="mic-wrap">
            <button
                type="button"
                class={classes.join(' ')}
                title="Start / pause recording"
                aria-label={active ? 'Pause recording' : 'Start recording'}
                disabled={processing}
                onClick={onClick}
            >
                <svg class="icon-mic" viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="9" y="3" width="6" height="11" rx="3" />
                    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
                </svg>
                <span class="mic-spinner" aria-hidden="true" />
            </button>
        </div>
    );
}
