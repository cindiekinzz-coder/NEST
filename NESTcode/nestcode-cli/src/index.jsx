import { render } from 'ink';
import { App } from './App.jsx';
import { loadConfig } from './config.js';
import { argv, exit } from 'node:process';

const args = argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

if (args.includes('-h') || args.includes('--help')) {
  console.log(`nestcode (TUI) — Ink-based terminal client for the NESTcode Workshop

usage:
  nestcode-tui                          connect with config from ~/.nestcode/config.json
  nestcode-tui --workspace <path>       override workspace root
  nestcode-tui --model <id>             override model
  nestcode-tui --gateway <wss://...>    override gateway URL

once running:
  Enter            send
  Shift+Enter      newline in current draft
  Up / Down        recall prompt history
  Esc              clear current draft
  Ctrl+C           stop running turn (or quit if idle)
`);
  exit(0);
}

const cfg = await loadConfig();
if (flag('--workspace')) cfg.workspace = flag('--workspace');
if (flag('--model'))     cfg.model     = flag('--model');
if (flag('--gateway'))   cfg.gatewayUrl = flag('--gateway');

render(<App config={cfg} />);
