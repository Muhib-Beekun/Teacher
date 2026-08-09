import * as vscode from 'vscode';
import { sendBrief, SendOptions, SendResult } from '../insert/InsertRouter';
import { BrowserSessionBridge } from './BrowserSessionBridge';
import {
    DispatchMeta,
    DispatchMode,
    MAX_DISPATCH_TEXT_BYTES,
    isDispatchMode,
    resolveDispatchPayload
} from './dispatchPacket';

export interface DispatchRequest {
    text?: string;
    mode?: string;
    submit?: boolean;
    meta?: DispatchMeta;
}

export interface DispatchResponse {
    ok: boolean;
    mode?: DispatchMode;
    target?: SendResult['target'];
    pasted?: boolean;
    submitted?: boolean;
    bytes?: number;
    message?: string;
    error?: string;
}

/**
 * Machine wake path: raw/relay never compile; handoff uses existing session packet.
 */
export async function runDispatch(
    bridge: BrowserSessionBridge,
    request: DispatchRequest,
    log?: (line: string) => void
): Promise<DispatchResponse> {
    const configured = vscode.workspace
        .getConfiguration('teacher.send')
        .get<string>('dispatchMode', 'handoff');
    const modeRaw = request.mode ?? configured;
    if (!isDispatchMode(modeRaw)) {
        return { ok: false, error: `Invalid mode: ${String(modeRaw)}` };
    }

    const textBytes = Buffer.byteLength(request.text ?? '', 'utf8');
    if (textBytes > MAX_DISPATCH_TEXT_BYTES) {
        return {
            ok: false,
            error: `text exceeds ${MAX_DISPATCH_TEXT_BYTES} bytes (got ${textBytes})`
        };
    }

    const sendOpts: SendOptions = {};
    if (typeof request.submit === 'boolean') {
        sendOpts.autoSubmit = request.submit;
    }

    if (modeRaw === 'handoff') {
        if ((request.text ?? '').trim()) {
            await bridge.appendSegment(request.text!.trim());
            await bridge.forceCompile();
        }
        if (bridge.isEmpty()) {
            return { ok: false, mode: 'handoff', error: 'Session is empty. Provide text or speak first.' };
        }
        const handoff = bridge.getAgentHandoff();
        if (!handoff.trim()) {
            return { ok: false, mode: 'handoff', error: 'Handoff packet is empty.' };
        }
        const result = await sendBrief(handoff, sendOpts);
        log?.(
            `[dispatch] mode=handoff bytes=${Buffer.byteLength(handoff, 'utf8')} submitted=${result.submitted}`
        );
        return {
            ok: true,
            mode: 'handoff',
            target: result.target,
            pasted: result.pasted,
            submitted: result.submitted,
            bytes: Buffer.byteLength(handoff, 'utf8'),
            message: formatSendMessage(result)
        };
    }

    const payload = resolveDispatchPayload({
        mode: modeRaw,
        text: request.text,
        meta: request.meta
    });
    if (!payload.text.trim()) {
        return { ok: false, mode: modeRaw, error: 'text is required for raw/relay dispatch' };
    }

    const result = await sendBrief(payload.text, sendOpts);
    log?.(
        `[dispatch] mode=${payload.mode} bytes=${Buffer.byteLength(payload.text, 'utf8')} submitted=${result.submitted}`
    );
    return {
        ok: true,
        mode: payload.mode,
        target: result.target,
        pasted: result.pasted,
        submitted: result.submitted,
        bytes: Buffer.byteLength(payload.text, 'utf8'),
        message: formatSendMessage(result)
    };
}

function formatSendMessage(result: SendResult): string {
    if (result.submitted) {
        return 'Sent to Cursor agent.';
    }
    if (result.pasted) {
        return 'Pasted into Composer. Press Enter if needed.';
    }
    return 'Copied to clipboard.';
}
