import { describe, expect, it } from 'vitest';
import { formatUpdateCompareMessage } from '../../src/update/semverCompare';

describe('update compare messages', () => {
    it('formats available and current messages', () => {
        expect(formatUpdateCompareMessage('0.1.1', '0.1.2')).toContain('Update available');
        expect(formatUpdateCompareMessage('0.1.2', '0.1.2')).toContain('up to date');
    });
});
