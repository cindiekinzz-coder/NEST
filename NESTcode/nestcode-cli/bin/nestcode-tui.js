#!/usr/bin/env node
// Thin shim that registers tsx so we can import .jsx files at runtime.
import { register } from 'tsx/esm/api';
const unregister = register();
await import('../src/index.jsx');
// Don't unregister — process keeps Ink rendered until user quits.
