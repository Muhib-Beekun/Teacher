import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
    findExtensionsJsonPath,
    parsePinStateFromExtensionsJson,
    readExtensionPinState,
    tryClearExtensionPin
} from '../../src/update/extensionProfileState';

describe('extensionProfileState', () => {
    let tempDir: string;

    afterEach(() => {
        if (tempDir && fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    it('finds extensions.json beside extension folders', () => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teacher-pin-'));
        const extensionsRoot = path.join(tempDir, 'extensions');
        const extDir = path.join(extensionsRoot, 'muhib-beekun.teacher-0.1.2');
        fs.mkdirSync(extDir, { recursive: true });
        fs.writeFileSync(path.join(extensionsRoot, 'extensions.json'), '[]', 'utf8');

        expect(findExtensionsJsonPath(extDir)).toBe(path.join(extensionsRoot, 'extensions.json'));
    });

    it('parses pinned and unpinned metadata', () => {
        const payload = [
            {
                identifier: { id: 'muhib-beekun.teacher' },
                metadata: { pinned: true, source: 'vsix' }
            }
        ];
        expect(parsePinStateFromExtensionsJson(payload, 'muhib-beekun.teacher')).toBe('pinned');
        expect(parsePinStateFromExtensionsJson(payload, 'other.ext')).toBe('unknown');
        expect(
            parsePinStateFromExtensionsJson(
                [{ identifier: { id: 'muhib-beekun.teacher' }, metadata: { pinned: false } }],
                'muhib-beekun.teacher'
            )
        ).toBe('unpinned');
    });

    it('reads and clears pin state on disk', () => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teacher-pin-'));
        const extensionsRoot = path.join(tempDir, 'extensions');
        const extDir = path.join(extensionsRoot, 'muhib-beekun.teacher-0.1.2');
        fs.mkdirSync(extDir, { recursive: true });
        const jsonPath = path.join(extensionsRoot, 'extensions.json');
        fs.writeFileSync(
            jsonPath,
            JSON.stringify([
                {
                    identifier: { id: 'muhib-beekun.teacher' },
                    version: '0.1.1',
                    metadata: { pinned: true, source: 'vsix' }
                }
            ]),
            'utf8'
        );

        expect(readExtensionPinState(extDir, 'muhib-beekun.teacher')).toBe('pinned');
        expect(tryClearExtensionPin(extDir, 'muhib-beekun.teacher')).toBe(true);
        expect(readExtensionPinState(extDir, 'muhib-beekun.teacher')).toBe('unpinned');
        const written = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as { metadata: { pinned: boolean } }[];
        expect(written[0].metadata.pinned).toBe(false);
    });
});
