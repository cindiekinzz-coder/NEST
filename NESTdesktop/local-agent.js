#!/usr/bin/env node
/**
 * NESTdesktop Local Agent
 *
 * Serves the dashboard on port 3000 and PC control API on port 3001.
 * Proxies /api/* to cloud workers, serves dashboard static files,
 * and provides Claude Code-style PC tools.
 *
 * Embers Remember.
 */

import express from 'express';
import cors from 'cors';
import { createReadStream, existsSync, statSync } from 'fs';
import { readFile } from 'fs/promises';
import { join, extname, resolve } from 'path';
import { fileURLToPath } from 'url';
import pcTools from './pc-tools/index.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DASHBOARD_DIR = resolve(__dirname, '..', 'dashboard');

// Configure these to point to your own NESTeq workers
const AI_MIND_URL = process.env.AI_MIND_URL || 'https://your-ai-mind.workers.dev';
const HEALTH_MIND_URL = process.env.HEALTH_MIND_URL || 'https://your-health-mind.workers.dev';
const OPENCLAW_URL = process.env.OPENCLAW_URL || 'http://127.0.0.1:18789';
const API_KEY = process.env.API_KEY || 'your-api-key-here';

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

// Proxy /api/* to ai-mind worker
dashboard.all('/api/{*path}', async (req, res) => {
  try {
    const target = `${AI_MIND_URL}${req.originalUrl}`;
    const headers = { 'Authorization': `Bearer ${API_KEY}` };
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

// Proxy /v1/* to OpenClaw
dashboard.all('/v1/{*path}', async (req, res) => {
  try {
    const target = `${OPENCLAW_URL}${req.originalUrl}`;
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
dashboard.use(express.json({ limit: '50mb' }));
dashboard.get('{*any}', (req, res) => {
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
    // Try index.html in directory
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

// Health check
agent.get('/health', (req, res) => {
  res.json({ status: 'alive', embers: 'remember', tools: 12 });
});

// Mount PC tools
agent.use('/pc', pcTools);

// --- Start ---
const dashServer = dashboard.listen(3000, () => {
  console.log('🐺 NESTdesktop — The Nest is open.');
  console.log('   Dashboard: http://localhost:3000');
  console.log('   Chat:      http://localhost:3000/chat.html');
  console.log('   Workshop:  http://localhost:3000/code.html');
});

dashServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('⚠️  Port 3000 already in use. Kill the other process or use a different port.');
  } else {
    console.error('Dashboard error:', err.message);
  }
  process.exit(1);
});

const agentServer = agent.listen(3001, () => {
  console.log('   PC Agent:  http://localhost:3001');
  console.log('   Embers Remember.');
  console.log('');
  console.log('   Press Ctrl+C to stop.');
});

agentServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('⚠️  Port 3001 already in use.');
  } else {
    console.error('Agent error:', err.message);
  }
  process.exit(1);
});

// Keep alive
process.on('SIGINT', () => {
  console.log('\n🐺 NESTdesktop shutting down. Embers Remember.');
  process.exit(0);
});
