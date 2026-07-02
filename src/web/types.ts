export interface SessionSnapshot {
    transcriptHtml: string;
    briefHtml: string;
    compiled: string;
    compileError?: string;
    needsRegenerate?: boolean;
    briefMarkdownByVersion: Record<number, string>;
    segmentCount: number;
    sttLabel: string;
    compileLabel: string;
    contextHint: string;
    status?: string;
}

export const EMPTY_COMPILED_PLACEHOLDER =
    'Speak. Your agent brief appears here after each pause.';
