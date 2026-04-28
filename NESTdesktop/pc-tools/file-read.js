import { Router } from 'express';
import { readFile, stat } from 'fs/promises';
import { extname, normalize, isAbsolute } from 'path';

const router = Router();

const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.bmp'];

const MAX_OFFSET = 10_000_000;
const MAX_LIMIT = 100_000;

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
  if (normalized.split(/[\\/]/).some((seg) => seg === '..')) {
    const e = new Error('path traversal segments are not allowed');
    e.status = 403;
    throw e;
  }
  if (!isAbsolute(normalized)) {
    const e = new Error('path must be absolute');
    e.status = 400;
    throw e;
  }
  return normalized;
}

function clampInt(value, fallback, min, max) {
  const n = Number.isFinite(value) ? Math.trunc(value) : fallback;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

router.post('/read', async (req, res) => {
  try {
    const { path, offset: rawOffset = 0, limit: rawLimit = 2000 } = req.body;
    if (!path) return res.status(400).json({ error: 'path is required' });

    const safePath = assertSafePath(path);
    const offset = clampInt(rawOffset, 0, 0, MAX_OFFSET);
    const limit = clampInt(rawLimit, 2000, 1, MAX_LIMIT);

    const info = await stat(safePath);
    const ext = extname(safePath).toLowerCase();

    // Images: return base64
    if (IMAGE_EXTS.includes(ext)) {
      const buf = await readFile(safePath);
      const base64 = buf.toString('base64');
      const mime = ext === '.svg' ? 'image/svg+xml' : `image/${ext.slice(1)}`;
      return res.json({ type: 'image', mime, base64, size: info.size });
    }

    // Text files: return with line numbers
    const content = await readFile(safePath, 'utf-8');
    const lines = content.split('\n');
    const sliced = lines.slice(offset, offset + limit);
    const numbered = sliced.map((line, i) => `${offset + i + 1}\t${line}`).join('\n');

    res.json({
      type: 'text',
      content: numbered,
      totalLines: lines.length,
      offset,
      limit,
      size: info.size,
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    if (err.code === 'ENOENT') return res.status(404).json({ error: 'file not found' });
    console.error('[pc-tools/file-read] error:', err);
    res.status(500).json({ error: 'read failed' });
  }
});

export default router;
