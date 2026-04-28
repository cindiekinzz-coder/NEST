import { Router } from 'express';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { normalize, isAbsolute } from 'path';

const execFileAsync = promisify(execFile);
const router = Router();

function assertSafeSearchPath(p) {
  if (p === undefined || p === null || p === '' || p === '.') return null;
  if (typeof p !== 'string') {
    const e = new Error('path must be a string');
    e.status = 400;
    throw e;
  }
  if (p.includes('\0')) {
    const e = new Error('path contains null bytes');
    e.status = 400;
    throw e;
  }
  const n = normalize(p);
  if (n.split(/[\\/]/).some((seg) => seg === '..')) {
    const e = new Error('path traversal segments are not allowed');
    e.status = 403;
    throw e;
  }
  if (!isAbsolute(n)) {
    const e = new Error('path must be absolute');
    e.status = 400;
    throw e;
  }
  return n;
}

// Try to find ripgrep binary
async function findRg() {
  const candidates = [
    'rg',
    'C:\\Users\\YourName\\.cargo\\bin\\rg.exe',
    'C:\\Program Files\\ripgrep\\rg.exe',
  ];
  for (const c of candidates) {
    try {
      await execFileAsync(c, ['--version'], { timeout: 3000, windowsHide: true });
      return c;
    } catch {}
  }
  return null;
}

let rgPath = null;

/**
 * Content search using ripgrep — same approach as Claude Code.
 * Falls back to PowerShell Select-String if rg not found.
 */
router.post('/grep', async (req, res) => {
  try {
    const {
      pattern,
      path: searchPathRaw,
      glob: globFilter,
      type,
      output_mode = 'files_with_matches',
      context,
      case_insensitive = false,
      multiline = false,
      head_limit = 250,
    } = req.body;

    if (!pattern || typeof pattern !== 'string') {
      return res.status(400).json({ error: 'pattern is required and must be a string' });
    }
    if (pattern.includes('\0')) {
      return res.status(400).json({ error: 'pattern contains null bytes' });
    }
    if (typeof type !== 'undefined' && (typeof type !== 'string' || !/^[a-zA-Z0-9_+-]+$/.test(type))) {
      return res.status(400).json({ error: 'type contains disallowed characters' });
    }
    if (typeof globFilter !== 'undefined' && (typeof globFilter !== 'string' || globFilter.includes('\0'))) {
      return res.status(400).json({ error: 'glob is invalid' });
    }

    const searchPath = assertSafeSearchPath(searchPathRaw);
    const safeHeadLimit = Number.isFinite(Number(head_limit))
      ? Math.max(1, Math.min(10000, Math.trunc(Number(head_limit))))
      : 250;
    const safeContext = Number.isFinite(Number(context))
      ? Math.max(0, Math.min(100, Math.trunc(Number(context))))
      : null;

    // Find rg once
    if (rgPath === null) rgPath = (await findRg()) || false;

    if (rgPath) {
      // Use ripgrep — execFile with array args, no shell interpretation
      const args = [];
      if (output_mode === 'files_with_matches') args.push('-l');
      else if (output_mode === 'count') args.push('-c');
      else args.push('-n');

      if (case_insensitive) args.push('-i');
      if (multiline) args.push('-U', '--multiline-dotall');
      if (safeContext !== null) args.push('-C', String(safeContext));
      if (globFilter) args.push('--glob', globFilter);
      if (type) args.push('--type', type);
      args.push('--max-count', '1000');
      args.push('--', pattern);
      args.push(searchPath || '.');

      const { stdout } = await execFileAsync(rgPath, args, {
        cwd: searchPath || process.cwd(),
        maxBuffer: 10 * 1024 * 1024,
        timeout: 30000,
      }).catch((err) => {
        if (err.code === 1) return { stdout: '' };
        throw err;
      });

      const lines = stdout.split('\n').filter(Boolean);
      const truncated = lines.length > safeHeadLimit;
      const result = lines.slice(0, safeHeadLimit);
      return res.json({ output: result.join('\n'), matches: result.length, truncated });
    }

    // Fallback: PowerShell Select-String — pass values as PS variables via -ArgumentList
    // instead of interpolating into the command string. Eliminates the injection vector
    // that came from concatenating pattern/cwd/globFilter into a shell-parsed string.
    const cwd = searchPath || process.cwd();
    const psScript = `
      param($Path, $Pattern, $Glob, $CaseSensitive, $Limit)
      $params = @{ Path = $Path; Recurse = $true; File = $true }
      if ($Glob) { $params['Include'] = $Glob }
      Get-ChildItem @params | Select-String -Pattern $Pattern -CaseSensitive:$CaseSensitive |
        Select-Object -First $Limit |
        ForEach-Object { $_.Path + ':' + $_.LineNumber + ':' + $_.Line }
    `;
    const { stdout } = await execFileAsync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        psScript,
        '-Path', cwd,
        '-Pattern', pattern,
        '-Glob', globFilter || '',
        '-CaseSensitive', case_insensitive ? '$false' : '$true',
        '-Limit', String(safeHeadLimit),
      ],
      {
        timeout: 30000,
        maxBuffer: 10 * 1024 * 1024,
        windowsHide: true,
      },
    ).catch(() => ({ stdout: '' }));

    const lines = stdout.split('\n').filter(Boolean);
    res.json({ output: lines.join('\n'), matches: lines.length, truncated: false, engine: 'powershell' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('[pc-tools/grep] error:', err);
    res.status(500).json({ error: 'grep failed' });
  }
});

export default router;
