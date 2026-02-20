import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { platform } from 'node:os';

const exec = promisify(execFile);

/** Copy text to the system clipboard. Returns true on success. */
export async function copyToClipboard(text: string): Promise<boolean> {
  const os = platform();
  try {
    if (os === 'darwin') {
      await exec('pbcopy', [], { input: text, timeout: 3000 } as any);
      return true;
    }
    if (os === 'linux') {
      // Try xclip first, then xsel
      try {
        await exec('xclip', ['-selection', 'clipboard'], { input: text, timeout: 3000 } as any);
        return true;
      } catch {
        await exec('xsel', ['--clipboard', '--input'], { input: text, timeout: 3000 } as any);
        return true;
      }
    }
    if (os === 'win32') {
      await exec('clip', [], { input: text, timeout: 3000 } as any);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
