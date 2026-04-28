import { Router } from 'express';
import { writeFile, mkdir } from 'fs/promises';
import { dirname, normalize, isAbsolute } from 'path';

const router = Router();

function assertSafePath(p) {
  if (typeof p !== 'string' || p.length === 0) {
    const e = new Error('path must be a non-empty string');
    e.status = 400;
    throw e;
  }
  if (p.includes('\0')) {
    const e = new Error('path contains null bytes');
    e.status = 400;
    throw e;
  }
  const normalized = normalize(p);
  // Reject paths that traverse upwards. Both relative ('../foo') and any normalized
  // form that still contains a '..' segment (e.g. mixed separators on Windows) are blocked.
  if (normalized.split(/[\\/]/).some((seg) => seg === '..')) {
    const e = new Error('path traversal segments are not allowed');
    e.status = 403;
    throw e;
  }
  // Require absolute paths so callers can't drift off the agent's working directory unexpectedly.
  if (!isAbsolute(normalized)) {
    const e = new Error('path must be absolute');
    e.status = 400;
    throw e;
  }
  return normalized;
}

router.post('/write', async (req, res) => {
  try {
    const { path, content } = req.body;
    if (!path) return res.status(400).json({ error: 'path is required' });
    if (content === undefined) return res.status(400).json({ error: 'content is required' });

    const safePath = assertSafePath(path);

    // Create parent directories if needed
    await mkdir(dirname(safePath), { recursive: true });
    await writeFile(safePath, content, 'utf-8');

    res.json({ success: true, path: safePath, bytes: Buffer.byteLength(content, 'utf-8') });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('[pc-tools/file-write] error:', err);
    res.status(500).json({ error: 'write failed' });
  }
});

export default router;
