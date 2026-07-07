import * as fs from 'fs';
import * as https from 'https';

export const OPEN_VSX_LATEST_URL = 'https://open-vsx.org/api/muhib-beekun/teacher/latest';
export const OPEN_VSX_PUBLISHER = 'muhib-beekun';
export const OPEN_VSX_EXTENSION_NAME = 'teacher';

const DOWNLOAD_PREFIX = `https://open-vsx.org/api/${OPEN_VSX_PUBLISHER}/${OPEN_VSX_EXTENSION_NAME}/`;

export interface OpenVsxLatestRelease {
    version: string;
    downloadUrl: string;
}

export interface OpenVsxFetchOptions {
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
}

export function parseOpenVsxLatestPayload(json: unknown): OpenVsxLatestRelease | null {
    if (!json || typeof json !== 'object') {
        return null;
    }
    const payload = json as Record<string, unknown>;
    if (payload.namespace !== OPEN_VSX_PUBLISHER || payload.name !== OPEN_VSX_EXTENSION_NAME) {
        return null;
    }
    const version = payload.version;
    if (typeof version !== 'string' || !version.trim()) {
        return null;
    }
    const files = payload.files;
    if (!files || typeof files !== 'object') {
        return null;
    }
    const download = (files as Record<string, unknown>).download;
    if (typeof download !== 'string' || !isAllowedDownloadUrl(download)) {
        return null;
    }
    return { version: version.trim(), downloadUrl: download };
}

export function isAllowedDownloadUrl(url: string): boolean {
    return url.startsWith(DOWNLOAD_PREFIX) && url.includes('/file/') && url.endsWith('.vsix');
}

export async function fetchOpenVsxLatest(options: OpenVsxFetchOptions = {}): Promise<OpenVsxLatestRelease> {
    const timeoutMs = options.timeoutMs ?? 30_000;
    const fetchImpl = options.fetchImpl ?? fetch;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetchImpl(OPEN_VSX_LATEST_URL, {
            signal: controller.signal,
            headers: { Accept: 'application/json' }
        });
        if (!response.ok) {
            throw new Error(`Open VSX returned HTTP ${response.status}`);
        }
        const json: unknown = await response.json();
        const parsed = parseOpenVsxLatestPayload(json);
        if (!parsed) {
            throw new Error('Open VSX response failed validation');
        }
        return parsed;
    } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
            throw new Error(`Open VSX request timed out after ${timeoutMs}ms`);
        }
        throw err;
    } finally {
        clearTimeout(timer);
    }
}

export async function downloadVsixToFile(
    downloadUrl: string,
    targetPath: string,
    timeoutMs = 120_000
): Promise<void> {
    if (!isAllowedDownloadUrl(downloadUrl)) {
        throw new Error('Download URL is not from the Teacher Open VSX namespace');
    }

    await new Promise<void>((resolve, reject) => {
        const request = https.get(downloadUrl, (response) => {
            if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                downloadVsixToFile(response.headers.location, targetPath, timeoutMs).then(resolve).catch(reject);
                return;
            }
            if (response.statusCode !== 200) {
                reject(new Error(`VSIX download failed with HTTP ${response.statusCode ?? 'unknown'}`));
                return;
            }
            const file = fs.createWriteStream(targetPath);
            response.pipe(file);
            file.on('finish', () => {
                file.close(() => resolve());
            });
            file.on('error', reject);
        });
        request.on('error', reject);
        request.setTimeout(timeoutMs, () => {
            request.destroy(new Error(`VSIX download timed out after ${timeoutMs}ms`));
        });
    });
}
