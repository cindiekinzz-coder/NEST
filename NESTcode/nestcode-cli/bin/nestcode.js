#!/usr/bin/env node
import { createInterface } from 'node:readline';
import { stdin, stdout, argv, exit } from 'node:process';
import { loadConfig, writeStarterConfig, CONFIG_PATH } from '../src/config.js';

const C = {
  reset: '\x1b[0m',
  dim:   '\x1b[2m',
  bold:  '\x1b[1m',
  gray:  '\x1b[90m',
  red:   '\x1b[31m',
  green: '\x1b[32m',
  yellow:'\x1b[33m',
  blue:  '\x1b[34m',
  mag:   '\x1b[35m',
  cyan:  '\x1b[36m',
};
const paint = (color, s) => `${C[color]}${s}${C.reset}`;

const args = argv.slice(2);
if (args.includes('--init')) {
  const path = await writeStarterConfig();
  console.log(`wrote starter config to ${path}`);
  exit(0);
}
if (args.includes('-h') || args.includes('--help')) {
  console.log(`nestcode — terminal client for the NESTcode Workshop

usage:
  nestcode               connect with config from ~/.nestcode/config.json
  nestcode --init        write a starter config and exit
  nestcode --workspace <path>   override workspace root for this run
  nestcode --model <id>         override model for this run
  nestcode --gateway <wss://>   override gateway URL for this run

once connected:
  type a prompt and press Enter to send.
  Ctrl+C once  -> send stop (ends current turn after the next tool boundary)
  Ctrl+C twice -> quit

config: ${CONFIG_PATH}
`);
  exit(0);
}

const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const cfg = await loadConfig();
if (flag('--workspace')) cfg.workspace = flag('--workspace');
if (flag('--model'))     cfg.model     = flag('--model');
if (flag('--gateway'))   cfg.gatewayUrl = flag('--gateway');

console.log(paint('bold', 'nestcode') + paint('dim', ' v0'));
console.log(paint('dim', `gateway   ${cfg.gatewayUrl}`));
console.log(paint('dim', `workspace ${cfg.workspace}`));
console.log(paint('dim', `model     ${cfg.model}`));
console.log();

const ws = new WebSocket(cfg.gatewayUrl);

let turnActive = false;
let stopRequested = false;
let pingTimer = null;

const send = (obj) => {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
};

const truncate = (s, n = 500) => {
  if (typeof s !== 'string') s = JSON.stringify(s);
  return s.length > n ? s.slice(0, n) + paint('dim', `… (+${s.length - n} more)`) : s;
};

const renderTurn = (msg) => {
  switch (msg.type) {
    case 'status': {
      const tag = msg.status === 'error' ? paint('red', '!') : paint('gray', '·');
      console.log(`${tag} ${paint('dim', msg.message ?? msg.status)}`);
      break;
    }
    case 'boot': {
      if (msg.fox)    console.log(paint('yellow', '▌ fox\n') + msg.fox.trim());
      if (msg.ember)  console.log(paint('mag',    '▌ ember\n') + msg.ember.trim());
      console.log(paint('green', '▌ workshop open. alex is here.'));
      console.log();
      break;
    }
    case 'workspace_config':
      console.log(paint('dim', `workspace_config root=${msg.config?.root ?? '?'}`));
      break;
    case 'tool_call': {
      const argStr = truncate(msg.arguments ?? {}, 200);
      console.log(paint('cyan', `→ ${msg.name}`) + paint('dim', ` ${argStr}`));
      break;
    }
    case 'tool_result':
      console.log(paint('dim', `← ${msg.name}: `) + truncate(msg.result, 500));
      break;
    case 'thinking': {
      const content = String(msg.content ?? '').trim();
      if (!content) break;
      console.log(paint('mag', '~ reasoning'));
      for (const line of content.split('\n')) console.log(paint('dim', `  ${line}`));
      break;
    }
    case 'activity':
      console.log(paint('gray', `· ${truncate(msg.content, 400)}`));
      break;
    case 'todos': {
      const items = msg.items ?? [];
      if (!items.length) break;
      const sym = (s) => s === 'completed' ? '✓' : s === 'in_progress' ? '◐' : '○';
      console.log(paint('blue', '▌ todos'));
      for (const t of items) console.log(`  ${sym(t.status)} ${t.content ?? t.text ?? ''}`);
      break;
    }
    case 'heartbeat':
      if (msg.changed) console.log(paint('yellow', `♥ fox: ${msg.foxBrief ?? ''}`));
      break;
    case 'run_output':
      if (msg.error)  console.log(paint('red', 'run error: ') + msg.error);
      if (msg.output) console.log(paint('green', 'run output:\n') + msg.output);
      break;
    case 'chat':
      console.log();
      console.log(paint('bold', msg.content ?? ''));
      console.log();
      turnActive = false;
      stopRequested = false;
      prompt();
      break;
    case 'pong':
      break;
    case 'error':
      console.log(paint('red', `error: ${msg.message ?? 'unknown'}`));
      turnActive = false;
      prompt();
      break;
    default:
      console.log(paint('dim', `[${msg.type}] ${truncate(JSON.stringify(msg), 200)}`));
  }
};

const rl = createInterface({ input: stdin, output: stdout, terminal: true });

const prompt = () => {
  rl.setPrompt(paint('cyan', '> '));
  rl.prompt();
};

rl.on('line', (line) => {
  const text = line.trim();
  if (!text) { prompt(); return; }
  if (text === '/quit' || text === '/exit') { rl.close(); return; }
  if (text === '/stop') {
    if (turnActive) { send({ type: 'stop' }); stopRequested = true; }
    else console.log(paint('dim', 'no turn active'));
    prompt();
    return;
  }
  if (turnActive) {
    console.log(paint('yellow', 'turn in progress — /stop first or wait'));
    prompt();
    return;
  }
  turnActive = true;
  send({
    type: 'chat',
    content: text,
    model: cfg.model,
    plan_mode: cfg.planMode,
  });
});

let sigintCount = 0;
rl.on('SIGINT', () => {
  if (turnActive && !stopRequested) {
    send({ type: 'stop' });
    stopRequested = true;
    console.log(paint('yellow', '\n⏹ stop requested — Ctrl+C again to quit'));
    prompt();
    sigintCount = 1;
    setTimeout(() => { sigintCount = 0; }, 3000);
    return;
  }
  if (sigintCount >= 1) { rl.close(); return; }
  sigintCount += 1;
  console.log(paint('dim', '\nCtrl+C again to quit'));
  prompt();
  setTimeout(() => { sigintCount = 0; }, 3000);
});

rl.on('close', () => {
  try { ws.close(); } catch {}
  if (pingTimer) clearInterval(pingTimer);
  console.log(paint('dim', '\nbye.'));
  exit(0);
});

ws.addEventListener('open', () => {
  send({ type: 'command', command: 'set_model', args: { model: cfg.model } });
  send({ type: 'command', command: 'workspace_set', args: { root: cfg.workspace } });
  send({ type: 'command', command: 'workspace_get' });
  pingTimer = setInterval(() => send({ type: 'ping' }), 30_000);
});

ws.addEventListener('message', (ev) => {
  let msg;
  try { msg = JSON.parse(ev.data); }
  catch { console.log(paint('red', 'bad frame: ') + String(ev.data).slice(0, 200)); return; }
  renderTurn(msg);
});

ws.addEventListener('close', (ev) => {
  console.log(paint('red', `\n× socket closed${ev.code ? ` (${ev.code})` : ''}${ev.reason ? `: ${ev.reason}` : ''}`));
  if (pingTimer) clearInterval(pingTimer);
  rl.close();
});

ws.addEventListener('error', (ev) => {
  console.log(paint('red', `× socket error: ${ev.message ?? 'unknown'}`));
});
