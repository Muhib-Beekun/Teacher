import { describe, expect, it } from 'vitest';
import {
    buildUpdateCheckError,
    buildUpdateCheckResult,
    canInstallUpdate,
    pickAvailableUpdateCheck
} from '../../src/update/updateLogic';

describe('updateLogic', () => {
    const latest = {
        version: '0.1.3',
        downloadUrl: 'https://open-vsx.org/api/muhib-beekun/teacher/0.1.3/file/muhib-beekun.teacher-0.1.3.vsix'
    };

    it('builds available and current check results', () => {
        const available = buildUpdateCheckResult('0.1.2', latest);
        expect(available.status).toBe('available');
        expect(available.latestVersion).toBe('0.1.3');
        expect(available.message).toContain('Update available');

        const current = buildUpdateCheckResult('0.1.3', latest);
        expect(current.status).toBe('current');
        expect(current.message).toContain('up to date');
    });

    it('builds error results', () => {
        const err = buildUpdateCheckError('0.1.2', new Error('HTTP 404'));
        expect(err.status).toBe('error');
        expect(err.message).toContain('HTTP 404');
    });

    it('prefers cached available check when fresh check is not available', () => {
        const cached = buildUpdateCheckResult('0.1.1', latest);
        const fresh = buildUpdateCheckResult('0.1.1', { ...latest, version: '0.1.1' });
        expect(pickAvailableUpdateCheck(cached, fresh)).toBe(cached);
    });

    it('detects installable updates', () => {
        const check = buildUpdateCheckResult('0.1.1', latest);
        expect(canInstallUpdate(check)).toBe(true);
        expect(canInstallUpdate(buildUpdateCheckResult('0.1.3', latest))).toBe(false);
    });
});
