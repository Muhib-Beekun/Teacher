export interface SttFix {
    heard: string;
    corrected: string;
    /** Mic phrase when pipeline intermediate differs (e.g. Croc API key vs Grok API key). */
    heardOriginal?: string;
    /** Which pipeline stage produced this fix (for audit). */
    source?: 'lexicon' | 'dictionary' | 'polish';
}

export interface SttSegmentAudit {
    sttHeard: string;
    afterLexicon: string;
    afterDictionary: string;
    afterPolish: string;
}

export interface RawSegment {
    text: string;
    textRaw: string;
    fixes: SttFix[];
    audit?: SttSegmentAudit;
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
    /** Verbatim session segments with [included]/[correction] roles — sent to the agent. */
    sessionLog: string[];
    superseded: string[];
}
