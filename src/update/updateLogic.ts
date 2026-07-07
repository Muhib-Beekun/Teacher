import type { UpdateCheckResult } from '../shared/types';
import type { OpenVsxLatestRelease } from './openVsxClient';
import { formatUpdateCompareMessage, isNewerVersion } from './semverCompare';

export function buildUpdateCheckResult(installedVersion: string, latest: OpenVsxLatestRelease): UpdateCheckResult {
    const newer = isNewerVersion(latest.version, installedVersion);
    return {
        status: newer ? 'available' : 'current',
        installedVersion,
        latestVersion: latest.version,
        downloadUrl: latest.downloadUrl,
        message: formatUpdateCompareMessage(installedVersion, latest.version),
        checkedAt: Date.now()
    };
}

export function buildUpdateCheckError(installedVersion: string, err: unknown): UpdateCheckResult {
    const msg = err instanceof Error ? err.message : String(err);
    return {
        status: 'error',
        installedVersion,
        message: `Could not check Open VSX: ${msg}. Install manually from GitHub Releases or retry later.`,
        checkedAt: Date.now()
    };
}

export function pickAvailableUpdateCheck(
    cached: UpdateCheckResult | null | undefined,
    fresh: UpdateCheckResult
): UpdateCheckResult {
    if (cached?.status === 'available' && cached.downloadUrl && cached.latestVersion) {
        return cached;
    }
    return fresh;
}

export function canInstallUpdate(check: UpdateCheckResult): check is UpdateCheckResult & {
    status: 'available';
    latestVersion: string;
    downloadUrl: string;
} {
    return check.status === 'available' && Boolean(check.latestVersion && check.downloadUrl);
}
