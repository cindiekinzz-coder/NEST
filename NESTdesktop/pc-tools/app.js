import { Router } from 'express';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const router = Router();

// Reject inputs containing shell metacharacters or control bytes. Defence in depth — the
// command-injection fix below disables shell:true, but we still validate at the boundary.
const SHELL_META = /[&|;<>$`"'(){}[\]*?!~#\n\r\0]/;

function isValidLaunchName(name) {
  return typeof name === 'string'
    && name.length > 0
    && name.length < 1024
    && !SHELL_META.test(name);
}

function isValidArg(arg) {
  return typeof arg === 'string'
    && arg.length < 4096
    && !/[\n\r\0]/.test(arg);
}

router.post('/launch', async (req, res) => {
  try {
    const { name, args = [] } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    if (!isValidLaunchName(name)) {
      return res.status(400).json({ error: 'name contains disallowed characters' });
    }
    if (!Array.isArray(args)) {
      return res.status(400).json({ error: 'args must be an array' });
    }
    if (!args.every(isValidArg)) {
      return res.status(400).json({ error: 'one or more args contain disallowed characters' });
    }

    // shell:true was a command-injection vector — args were concatenated and re-parsed
    // by the shell. With shell:false (default), spawn passes args directly to CreateProcessW
    // (Windows) / execvp (Unix) without shell interpretation. Callers needing PATH resolution
    // should pass the absolute path or use a known launcher (e.g. 'cmd.exe' with safe args).
    const child = spawn(name, args, {
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
    });
    child.unref();

    res.json({ success: true, name, pid: child.pid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/list', async (req, res) => {
  try {
    const { stdout } = await execAsync(
      'powershell.exe -Command "Get-Process | Where-Object { $_.MainWindowTitle -ne \\"\\" } | Select-Object Id, ProcessName, MainWindowTitle | ConvertTo-Json"',
      { timeout: 10000, windowsHide: true }
    );

    const procs = JSON.parse(stdout || '[]');
    const windows = (Array.isArray(procs) ? procs : [procs]).map((p) => ({
      pid: p.Id,
      name: p.ProcessName,
      title: p.MainWindowTitle,
    }));

    res.json({ windows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
