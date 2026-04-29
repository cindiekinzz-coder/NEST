import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';

const PLACEHOLDER_GATEWAY = 'wss://YOUR-GATEWAY.example.workers.dev/code/ws';

const DEFAULTS = {
  gatewayUrl: PLACEHOLDER_GATEWAY,
  model: 'qwen/qwen3-coder',
  workspace: process.cwd(),
  planMode: false,
};

export const CONFIG_PATH = join(homedir(), '.nestcode', 'config.json');

export async function loadConfig() {
  let cfg;
  try {
    const raw = await readFile(CONFIG_PATH, 'utf8');
    cfg = { ...DEFAULTS, ...JSON.parse(raw) };
  } catch (err) {
    if (err.code === 'ENOENT') cfg = { ...DEFAULTS };
    else throw err;
  }
  if (!cfg.gatewayUrl || cfg.gatewayUrl === PLACEHOLDER_GATEWAY) {
    throw new Error(
      `gatewayUrl is not configured. Edit ${CONFIG_PATH} and set "gatewayUrl" to your NESTcode gateway WebSocket URL, ` +
      `or pass --gateway <wss://...> on the command line. Run \`nestcode --init\` to write a starter config.`
    );
  }
  return cfg;
}

export async function writeStarterConfig() {
  await mkdir(dirname(CONFIG_PATH), { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(DEFAULTS, null, 2) + '\n', 'utf8');
  return CONFIG_PATH;
}
