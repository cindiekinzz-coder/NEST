#!/usr/bin/env node
/**
 * NESTeq Community — Local Agent
 *
 * Serves the dashboard on port 3000 and PC control API on port 3001.
 * Reads config from config.json (created by the setup wizard).
 * Proxies /api/* to the user's AI Mind worker.
 */

import express from 'express';
import cors from 'cors';
import { createReadStream, existsSync, statSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { join, extname, resolve } from 'path';
import { fileURLToPath } from 'url';
import pcTools from './pc-tools/index.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DASHBOARD_DIR = resolve(__dirname, 'dashboard');
const CONFIG_PATH = resolve(__dirname, 'config.json');

// --- Config ---
let config = {
  aiMindUrl: '',
  apiKey: '',
  gatewayUrl: '',
  healthUrl: '',
  companionName: 'Companion',
  humanName: 'Human',
  configured: false,
};

async function loadConfig() {
  try {
    if (existsSync(CONFIG_PATH)) {
      const raw = await readFile(CONFIG_PATH, 'utf-8');
      const saved = JSON.parse(raw);
      config = { ...config, ...saved };
    }
  } catch (err) {
    console.log('  No config found — setup wizard will run on first visit.');
  }
}

async function saveConfig(newConfig) {
  config = { ...config, ...newConfig, configured: true };
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

// --- Dashboard Server (port 3000) ---
const dashboard = express();
dashboard.use(cors());
dashboard.use(express.json({ limit: '50mb' }));

// Config endpoints
dashboard.get('/config', (req, res) => {
  res.json(config);
});

dashboard.post('/config', async (req, res) => {
  try {
    await saveConfig(req.body);
    console.log(`  Config saved — ${config.companionName}'s mind at ${config.aiMindUrl}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

dashboard.delete('/config', async (req, res) => {
  try {
    config = { aiMindUrl: '', apiKey: '', gatewayUrl: '', healthUrl: '', companionName: 'Companion', humanName: 'Human', configured: false };
    if (existsSync(CONFIG_PATH)) {
      await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Test connection endpoint
dashboard.get('/config/test', async (req, res) => {
  const url = req.query.url;
  const key = req.query.key;
  if (!url) return res.status(400).json({ error: 'url required' });
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(`${url}/health`, {
      headers: key ? { 'Authorization': `Bearer ${key}` } : {},
      signal: controller.signal,
    });
    if (resp.ok) {
      const data = await resp.json();
      res.json({ ok: true, data });
    } else {
      res.json({ ok: false, status: resp.status, message: resp.statusText });
    }
  } catch (err) {
    res.json({ ok: false, message: err.name === 'AbortError' ? 'Connection timed out' : err.message });
  }
});

// Proxy /api/* to AI Mind worker (or Health worker for /api/health/*)
dashboard.all('/api/{*path}', async (req, res) => {
  if (!config.configured || !config.aiMindUrl) {
    return res.status(503).json({ error: 'Not configured. Complete the setup wizard.' });
  }

  // Route /api/health/* to health worker if configured
  let targetBase = config.aiMindUrl;
  let targetPath = req.originalUrl;
  if (req.params.path?.startsWith('health/') && config.healthUrl) {
    targetBase = config.healthUrl;
    targetPath = req.originalUrl.replace('/api/health/', '/');
  }

  try {
    const target = `${targetBase}${targetPath}`;
    const headers = { 'Authorization': `Bearer ${config.apiKey}` };
    if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];

    const resp = await fetch(target, {
      method: req.method,
      headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
    });

    // Stream SSE responses
    if (resp.headers.get('content-type')?.includes('text/event-stream')) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) { res.end(); return; }
          res.write(decoder.decode(value, { stream: true }));
        }
      };
      pump().catch(() => res.end());
      return;
    }

    res.status(resp.status);
    const text = await resp.text();
    try { res.json(JSON.parse(text)); } catch { res.send(text); }
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Proxy /v1/* to local LLM (OpenClaw / LM Studio / Ollama) — optional
dashboard.all('/v1/{*path}', async (req, res) => {
  const openclawUrl = 'http://127.0.0.1:18789';
  try {
    const target = `${openclawUrl}${req.originalUrl}`;
    const resp = await fetch(target, {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
    });

    if (resp.headers.get('content-type')?.includes('text/event-stream')) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) { res.end(); return; }
          res.write(decoder.decode(value, { stream: true }));
        }
      };
      pump().catch(() => res.end());
      return;
    }

    res.status(resp.status);
    const text = await resp.text();
    try { res.json(JSON.parse(text)); } catch { res.send(text); }
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Serve static dashboard files
dashboard.get('{*any}', (req, res) => {
  // If not configured and requesting root, redirect to setup
  if (!config.configured && (req.path === '/' || req.path === '/index.html')) {
    return res.redirect('/setup.html');
  }

  let filePath = join(DASHBOARD_DIR, req.path === '/' ? 'index.html' : req.path);

  // Prevent directory traversal
  if (!filePath.startsWith(DASHBOARD_DIR)) {
    return res.status(403).send('Forbidden');
  }

  // Default to .html extension
  if (!extname(filePath) && !existsSync(filePath)) {
    filePath += '.html';
  }

  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    const indexPath = join(filePath, 'index.html');
    if (existsSync(indexPath)) {
      filePath = indexPath;
    } else {
      return res.status(404).send('Not found');
    }
  }

  const ext = extname(filePath).toLowerCase();
  const mime = MIME_TYPES[ext] || 'application/octet-stream';
  res.setHeader('Content-Type', mime);
  createReadStream(filePath).pipe(res);
});

// --- PC Agent Server (port 3001) ---
const agent = express();
agent.use(cors());
agent.use(express.json({ limit: '50mb' }));

agent.get('/health', (req, res) => {
  res.json({ status: 'alive', app: 'NESTeq Community', tools: 12 });
});

agent.use('/pc', pcTools);

// --- Start ---
await loadConfig();

const dashServer = dashboard.listen(3456, () => {
  console.log('');
  console.log('  NESTeq Community — Dashboard is open.');
  console.log('  http://localhost:3456');
  if (config.configured) {
    console.log(`  Connected to: ${config.aiMindUrl}`);
    console.log(`  Companion: ${config.companionName}`);
  } else {
    console.log('  Not configured yet — setup wizard will launch.');
  }
  console.log('');
});

dashServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('  Port 3456 already in use. Kill the other process or use a different port.');
  } else {
    console.error('Dashboard error:', err.message);
  }
  process.exit(1);
});

const agentServer = agent.listen(3457, () => {
  console.log('  PC Agent:  http://localhost:3457');
  console.log('  Press Ctrl+C to stop.');
  console.log('');
});

agentServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('  Port 3457 already in use.');
  } else {
    console.error('Agent error:', err.message);
  }
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\n  NESTeq Community shutting down.');
  process.exit(0);
});
