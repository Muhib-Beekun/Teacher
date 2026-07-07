import { describe, expect, it } from 'vitest';
import { compareSemver, isNewerVersion, parseSemver } from '../../src/update/semverCompare';

describe('semverCompare', () => {
    it('parses semver versions', () => {
        expect(parseSemver('0.1.1')).toEqual({ major: 0, minor: 1, patch: 1, prerelease: '' });
        expect(parseSemver('v1.2.3-beta.1')).toEqual({ major: 1, minor: 2, patch: 3, prerelease: 'beta.1' });
        expect(parseSemver('bad')).toBeNull();
    });

    it('compares semver ordering', () => {
        expect(compareSemver('0.1.2', '0.1.1')).toBeGreaterThan(0);
        expect(compareSemver('0.1.1', '0.1.1')).toBe(0);
        expect(compareSemver('0.1.0', '0.2.0')).toBeLessThan(0);
    });

    it('detects newer versions', () => {
        expect(isNewerVersion('0.1.2', '0.1.1')).toBe(true);
        expect(isNewerVersion('0.1.1', '0.1.1')).toBe(false);
        expect(isNewerVersion('0.1.0', '0.1.1')).toBe(false);
    });
});
