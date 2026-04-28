import { Router } from 'express';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const router = Router();

// Process names: alphanumeric, dots, underscores, hyphens, asterisks for wildcards.
// Reject anything else to prevent PowerShell injection via the -Name argument.
const PROCESS_NAME_RE = /^[A-Za-z0-9._\-*?]+$/;

function safeProcessName(n) {
  if (n === undefined || n === null || n === '') return null;
  if (typeof n !== 'string' || !PROCESS_NAME_RE.test(n) || n.length > 256) {
    const e = new Error('name contains disallowed characters');
    e.status = 400;
    throw e;
  }
  return n;
}

function safePid(p) {
  const n = Number(p);
  if (!Number.isInteger(n) || n <= 0 || n > 0xffffffff) {
    const e = new Error('pid must be a positive integer');
    e.status = 400;
    throw e;
  }
  return n;
}

function safeLimit(v, fallback = 30) {
  const n = Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : fallback;
  if (n <= 0) return 1;
  if (n > 1000) return 1000;
  return n;
}

router.get('/list', async (req, res) => {
  try {
    const { sort_by = 'memory', name } = req.query;
    const limit = safeLimit(req.query.limit);
    const safeName = safeProcessName(name);

    // Build PowerShell pipeline as a single -Command string. All interpolated values are
    // validated above, but we still pass via -Command instead of -File to keep argument
    // parsing predictable.
    const sortCol = sort_by === 'cpu' ? 'CPU' : 'WorkingSet64';
    const nameFilter = safeName ? ` -Name '${safeName}'` : '';
    const cmd =
      `Get-Process${nameFilter} | ` +
      `Select-Object Id, ProcessName, WorkingSet64, CPU | ` +
      `Sort-Object ${sortCol} -Descending | ` +
      `Select-Object -First ${limit} | ConvertTo-Json`;

    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', cmd], {
      timeout: 10000,
      windowsHide: true,
    });

    const processes = JSON.parse(stdout || '[]');
    const list = (Array.isArray(processes) ? processes : [processes]).map((p) => ({
      pid: p.Id,
      name: p.ProcessName,
      memory_mb: Math.round((p.WorkingSet64 || 0) / 1024 / 1024),
      cpu: p.CPU ? Math.round(p.CPU * 100) / 100 : 0,
    }));

    res.json({ processes: list });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('[pc-tools/process/list] error:', err);
    res.status(500).json({ error: 'process list failed' });
  }
});

router.post('/kill', async (req, res) => {
  try {
    const { pid } = req.body;
    if (pid === undefined || pid === null) return res.status(400).json({ error: 'pid is required' });

    const safe = safePid(pid);

    // Pass pid as a separate, validated integer argument — no string interpolation.
    await execFileAsync('powershell.exe', ['-NoProfile', '-Command', `Stop-Process -Id ${safe} -Force`], {
      timeout: 5000,
      windowsHide: true,
    });

    res.json({ success: true, pid: safe });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('[pc-tools/process/kill] error:', err);
    res.status(500).json({ error: 'process kill failed' });
  }
});

export default router;
