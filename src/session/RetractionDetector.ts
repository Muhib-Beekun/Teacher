import { Segment, SegmentTag } from './types';

let segmentCounter = 0;

export function createSegment(index: number, text: string): Segment {
    return {
        id: `seg-${++segmentCounter}`,
        index,
        text: text.trim(),
        tags: [],
        superseded: false
    };
}

export function resetSegmentCounter(): void {
    segmentCounter = 0;
}

/** Apply v1 rule patterns from TEACHER-COMPILER.md */
export function analyzeSegments(rawTexts: string[]): Segment[] {
    resetSegmentCounter();
    const segments = rawTexts.map((text, index) => createSegment(index, text));

    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const lower = seg.text.toLowerCase();
        const tags = detectTags(seg.text, lower);
        seg.tags = tags;

        for (const tag of tags) {
            if (tag.kind === 'retract') {
                if (tag.scope === 'previous_segment' && i > 0) {
                    segments[i - 1].superseded = true;
                }
                if (tag.scope === 'phrase' && tag.phrase) {
                    markPhraseSuperseded(segments.slice(0, i), tag.phrase);
                }
            }
        }

        if (/^(ignore that|disregard that|scratch that|forget that)\b/i.test(seg.text.trim())) {
            seg.superseded = true;
        }
    }

    return segments;
}

function detectTags(text: string, lower: string): SegmentTag[] {
    const tags: SegmentTag[] = [];
    const trimmed = text.trim();

    if (/^(ignore that|disregard that|scratch that|forget that)\b/i.test(trimmed)) {
        tags.push({ kind: 'retract', scope: 'previous_segment' });
    }

    const ignorePart = trimmed.match(/\bignore the (.+?) part\b/i);
    if (ignorePart) {
        tags.push({ kind: 'retract', scope: 'phrase', phrase: ignorePart[1] });
    }

    const dontDo = trimmed.match(/\bdon'?t do the (.+?)(?:\.|$)/i);
    if (dontDo) {
        tags.push({ kind: 'retract', scope: 'phrase', phrase: dontDo[1] });
    }

    const meant = trimmed.match(/^i meant (.+)/i);
    if (meant) {
        tags.push({ kind: 'correct', phrase: meant[1].trim() });
    }

    const really = trimmed.match(/^what i really want is (.+)/i);
    if (really) {
        tags.push({ kind: 'correct', phrase: really[1].trim() });
    }

    const actually = trimmed.match(/^actually[,.]?\s*(.+)/i);
    if (actually && !meant) {
        tags.push({ kind: 'correct', phrase: actually[1].trim() });
    }

    const only = trimmed.match(/\bonly (.+)/i);
    if (only) {
        tags.push({ kind: 'constraint', text: `Only ${only[1].trim()}` });
    }

    if (/\bnot the .+/i.test(trimmed)) {
        const notMatch = trimmed.match(/\bnot the (.+?)(?:\.|,|$)/i);
        if (notMatch) {
            tags.push({ kind: 'constraint', text: `Not the ${notMatch[1].trim()}` });
        }
    }

    if (/\b(make sure|verify that|how do we know|tell me if)\b/i.test(lower)) {
        tags.push({ kind: 'verification', text: trimmed });
    }

    return tags;
}

function markPhraseSuperseded(segments: Segment[], phrase: string): void {
    const needle = phrase.toLowerCase();
    for (const seg of segments) {
        if (seg.text.toLowerCase().includes(needle)) {
            seg.superseded = true;
        }
    }
}

export function formatSegmentLabel(seg: Segment): string {
    if (seg.superseded) {
        return 'superseded';
    }
    if (seg.tags.some((t) => t.kind === 'correct')) {
        return 'correction';
    }
    if (seg.tags.some((t) => t.kind === 'retract')) {
        return 'retraction';
    }
    if (seg.tags.some((t) => t.kind === 'constraint')) {
        return 'constraint';
    }
    return 'included';
}
