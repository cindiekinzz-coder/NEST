import { useEffect, useRef, useState, useCallback } from 'react';
import { StreamingState } from '../types.js';

export function useWebSocketStream({ url, model, workspace, dispatch }) {
  const wsRef = useRef(null);
  const [ready, setReady] = useState(false);
  const send = useCallback((obj) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
  }, []);

  useEffect(() => {
    const ws = new WebSocket(url);
    wsRef.current = ws;
    let pingTimer = null;

    ws.addEventListener('open', () => {
      setReady(true);
      ws.send(JSON.stringify({ type: 'command', command: 'set_model', args: { model } }));
      ws.send(JSON.stringify({ type: 'command', command: 'workspace_set', args: { root: workspace } }));
      ws.send(JSON.stringify({ type: 'command', command: 'workspace_get' }));
      pingTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
      }, 30_000);
    });

    ws.addEventListener('message', (ev) => {
      let m;
      try { m = JSON.parse(ev.data); } catch { return; }
      handleEvent(m, dispatch);
    });

    ws.addEventListener('close', (ev) => {
      setReady(false);
      dispatch({ type: 'status', value: 'closed' });
      dispatch({
        type: 'append',
        item: { kind: 'status', status: 'closed', message: `socket closed (${ev.code})${ev.reason ? `: ${ev.reason}` : ''}`, timestamp: nowTs() },
      });
      if (pingTimer) clearInterval(pingTimer);
    });

    ws.addEventListener('error', () => {
      dispatch({ type: 'status', value: 'error' });
    });

    return () => {
      if (pingTimer) clearInterval(pingTimer);
      try { ws.close(); } catch {}
    };
  }, [url, model, workspace, dispatch]);

  return { send, ready };
}

function handleEvent(m, dispatch) {
  switch (m.type) {
    case 'status':
      dispatch({ type: 'status', value: m.status });
      dispatch({ type: 'append', item: { kind: 'status', status: m.status, message: m.message, timestamp: nowTs() } });
      if (m.status === 'connected') dispatch({ type: 'streaming', value: StreamingState.Idle });
      break;
    case 'boot':
      dispatch({ type: 'append', item: { kind: 'boot', fox: m.fox, ember: m.ember, ground: m.ground, boot: m.boot, timestamp: m.timestamp } });
      if (m.fox) dispatch({ type: 'fox', value: m.fox });
      break;
    case 'tool_call':
      dispatch({ type: 'streaming', value: StreamingState.Responding });
      dispatch({ type: 'append', item: { kind: 'tool_call', name: m.name, arguments: m.arguments, timestamp: m.timestamp } });
      break;
    case 'tool_result':
      dispatch({ type: 'merge_last_tool', item: { kind: 'tool_call', name: m.name, result: m.result, timestamp: m.timestamp } });
      break;
    case 'thinking':
      dispatch({ type: 'streaming', value: StreamingState.Responding });
      dispatch({ type: 'append', item: { kind: 'thinking', content: m.content } });
      break;
    case 'activity':
      // Skip activity events that just echo a tool_call we already rendered.
      // Daemon emits "↘ tool_name" style traces alongside the structured tool_call event.
      if (typeof m.content === 'string' && /^[↘→\\]\s*\w+\s*$/.test(m.content.trim())) break;
      dispatch({ type: 'append', item: { kind: 'activity', content: m.content, status: m.status, timestamp: m.timestamp } });
      break;
    case 'todos':
      dispatch({ type: 'todos', items: m.items ?? [] });
      break;
    case 'heartbeat':
      if (m.changed) {
        dispatch({ type: 'fox', value: m.fox });
        dispatch({ type: 'append', item: { kind: 'heartbeat', foxBrief: m.foxBrief, timestamp: m.timestamp } });
      }
      break;
    case 'chat':
      dispatch({ type: 'append', item: { kind: 'chat', content: m.content, speaker: m.speaker, timestamp: m.timestamp } });
      dispatch({ type: 'streaming', value: StreamingState.Idle });
      break;
    case 'run_output':
      dispatch({ type: 'append', item: { kind: 'run_output', output: m.output, error: m.error, language: m.language } });
      break;
    case 'workspace_config':
      if (m.config?.root) dispatch({ type: 'workspace', value: m.config.root });
      break;
    case 'pong':
      break;
    case 'error':
      dispatch({ type: 'append', item: { kind: 'error', message: m.message } });
      dispatch({ type: 'streaming', value: StreamingState.Idle });
      break;
    default:
      dispatch({ type: 'append', item: { kind: 'unknown', raw: m } });
  }
}

const nowTs = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
