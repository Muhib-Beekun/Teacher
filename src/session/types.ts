export interface SttFix {
    heard: string;
    corrected: string;
}

export interface RawSegment {
    text: string;
    textRaw: string;
    fixes: SttFix[];
}

export type SegmentTag =
    | { kind: 'retract'; scope: 'previous_segment' | 'phrase'; phrase?: string }
    | { kind: 'correct'; phrase: string }
    | { kind: 'constraint'; text: string }
    | { kind: 'verification'; text: string };

export interface Segment {
    id: string;
    index: number;
    text: string;
    tags: SegmentTag[];
    superseded: boolean;
}

export interface CompiledBrief {
    markdown: string;
    goal: string;
    target: string[];
    constraints: string[];
    verification: string[];
    superseded: string[];
}
