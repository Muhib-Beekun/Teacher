import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/**
 * Open a URL in the OS default browser (not Cursor/VS Code Simple Browser).
 * Returns true when the OS launch command succeeded.
 */
export async function openSystemBrowser(url: string): Promise<boolean> {
    try {
        if (process.platform === 'win32') {
            // Empty title arg is required so `start` treats the URL as the target.
            await execFileAsync('cmd', ['/c', 'start', '', url], {
                windowsHide: true
            });
            return true;
        }
        if (process.platform === 'darwin') {
            await execFileAsync('open', [url]);
            return true;
        }
        await execFileAsync('xdg-open', [url]);
        return true;
    } catch {
        return false;
    }
}
