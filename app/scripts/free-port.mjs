import { execSync } from 'node:child_process';

const PORT = 1435;
// The app hides to the system tray on close, so a previous dev instance keeps running
// and locks target/debug/nothingx-desktop.exe ("Access is denied" when cargo rebuilds).
const APP_EXE = 'nothingx-desktop.exe';

if (process.platform === 'win32') {
  try {
    execSync(`taskkill /F /IM ${APP_EXE} /T`, { stdio: 'ignore' });
  } catch {
    // No running instance
  }

  try {
    const out = execSync(`netstat -ano | findstr :${PORT}`, { encoding: 'utf8' });
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 5 && parts[1]?.endsWith(`:${PORT}`) && parts[3] === 'LISTENING') {
        const pid = Number(parts[4]);
        if (pid > 0 && pid !== process.pid) pids.add(pid);
      }
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
      } catch {
        // ignore
      }
    }
  } catch {
    // Port is already free
  }
}
