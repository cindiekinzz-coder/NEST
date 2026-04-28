import { Router } from 'express';
import { readFile, writeFile } from 'fs/promises';
import { normalize, isAbsolute } from 'path';

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

/**
 * Precise string replacement — modeled after Claude Code's FileEditTool.
 * Finds old_string in the file and replaces with new_string.
 * Fails if old_string is not found or not unique (unless replace_all is true).
 */
router.post('/edit', async (req, res) => {
  try {
    const { path, old_string, new_string, replace_all = false } = req.body;
    if (!path) return res.status(400).json({ error: 'path is required' });
    if (typeof old_string !== 'string') return res.status(400).json({ error: 'old_string is required and must be a string' });
    if (typeof new_string !== 'string') return res.status(400).json({ error: 'new_string is required and must be a string' });
    if (old_string === new_string) return res.status(400).json({ error: 'old_string and new_string must be different' });

    const safePath = assertSafePath(path);

    const content = await readFile(safePath, 'utf-8');

    // Count occurrences
    const occurrences = content.split(old_string).length - 1;

    if (occurrences === 0) {
      return res.status(400).json({
        error: 'old_string not found in file',
        hint: 'Make sure the string matches exactly, including whitespace and indentation',
      });
    }

    if (occurrences > 1 && !replace_all) {
      return res.status(400).json({
        error: `old_string found ${occurrences} times — not unique`,
        hint: 'Provide more surrounding context to make it unique, or set replace_all: true',
      });
    }

    // Perform replacement
    let newContent;
    if (replace_all) {
      newContent = content.replaceAll(old_string, new_string);
    } else {
      newContent = content.replace(old_string, new_string);
    }

    await writeFile(safePath, newContent, 'utf-8');

    res.json({
      success: true,
      path: safePath,
      replacements: replace_all ? occurrences : 1,
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    res.status(err.code === 'ENOENT' ? 404 : 500).json({ error: err.message });
  }
});

export default router;
