import { Router } from 'express';
import fg from 'fast-glob';
import { stat } from 'fs/promises';
import { normalize, isAbsolute } from 'path';

const router = Router();

function assertSafeCwd(p) {
  if (p === undefined || p === null || p === '') return null;
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

router.post('/glob', async (req, res) => {
  try {
    const { pattern, path } = req.body;
    if (!pattern || typeof pattern !== 'string') {
      return res.status(400).json({ error: 'pattern is required and must be a string' });
    }
    if (pattern.includes('\0')) {
      return res.status(400).json({ error: 'pattern contains null bytes' });
    }

    const safeCwd = assertSafeCwd(path);
    const cwd = safeCwd || process.cwd();

    const files = await fg(pattern, {
      cwd,
      absolute: true,
      dot: false,
      onlyFiles: true,
      suppressErrors: true,
    });

    // Sort by modification time (newest first) like Claude Code
    const withStats = await Promise.all(
      files.slice(0, 500).map(async (f) => {
        try {
          const s = await stat(f);
          return { path: f, mtime: s.mtimeMs };
        } catch {
          return { path: f, mtime: 0 };
        }
      })
    );
    withStats.sort((a, b) => b.mtime - a.mtime);

    res.json({
      files: withStats.map((f) => f.path),
      total: files.length,
      truncated: files.length > 500,
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    // Log internally; return generic to caller (don't leak filesystem details).
    console.error('[pc-tools/glob] error:', err);
    res.status(500).json({ error: 'glob operation failed' });
  }
});

export default router;
