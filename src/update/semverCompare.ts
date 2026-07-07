export interface ParsedSemver {
    major: number;
    minor: number;
    patch: number;
    prerelease: string;
}

/** Parse `major.minor.patch` with optional `-prerelease` suffix. Returns null if invalid. */
export function parseSemver(version: string): ParsedSemver | null {
    const trimmed = version.trim().replace(/^v/i, '');
    const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(trimmed);
    if (!match) {
        return null;
    }
    return {
        major: Number(match[1]),
        minor: Number(match[2]),
        patch: Number(match[3]),
        prerelease: match[4] ?? ''
    };
}

/** Compare semver strings. Returns negative if a < b, 0 if equal, positive if a > b. */
export function compareSemver(a: string, b: string): number {
    const pa = parseSemver(a);
    const pb = parseSemver(b);
    if (!pa || !pb) {
        return a.localeCompare(b);
    }
    if (pa.major !== pb.major) {
        return pa.major - pb.major;
    }
    if (pa.minor !== pb.minor) {
        return pa.minor - pb.minor;
    }
    if (pa.patch !== pb.patch) {
        return pa.patch - pb.patch;
    }
    if (!pa.prerelease && pb.prerelease) {
        return 1;
    }
    if (pa.prerelease && !pb.prerelease) {
        return -1;
    }
    return pa.prerelease.localeCompare(pb.prerelease);
}

export function isNewerVersion(latest: string, installed: string): boolean {
    return compareSemver(latest, installed) > 0;
}

export function formatUpdateCompareMessage(installed: string, latest: string): string {
    return isNewerVersion(latest, installed)
        ? `Update available: v${latest} (installed v${installed}).`
        : `Teacher v${installed} is up to date (Open VSX v${latest}).`;
}
