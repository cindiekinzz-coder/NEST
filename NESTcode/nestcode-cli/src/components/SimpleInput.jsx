import { useState, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import { useUIState } from '../contexts/UIStateContext.jsx';
import { StreamingState } from '../types.js';

export function SimpleInput() {
  const { state, submit, stop } = useUIState();
  const [value, setValue] = useState('');
  const historyRef = useRef([]);
  const cursorRef = useRef(-1);
  const responding = state.streamingState === StreamingState.Responding;

  useInput((input, key) => {
    // Always allow Ctrl+C to stop a turn or quit
    if (key.ctrl && input === 'c') {
      if (responding) { stop(); return; }
      process.exit(0);
    }

    if (responding) return; // ignore typing while turn is in flight

    if (key.return) {
      if (key.shift) {
        setValue((v) => v + '\n');
        return;
      }
      const text = value.trim();
      if (!text) return;
      historyRef.current.unshift(text);
      cursorRef.current = -1;
      setValue('');
      submit(text);
      return;
    }

    if (key.upArrow) {
      const next = Math.min(cursorRef.current + 1, historyRef.current.length - 1);
      if (next >= 0) { cursorRef.current = next; setValue(historyRef.current[next]); }
      return;
    }

    if (key.downArrow) {
      const next = cursorRef.current - 1;
      if (next < 0) { cursorRef.current = -1; setValue(''); }
      else { cursorRef.current = next; setValue(historyRef.current[next]); }
      return;
    }

    if (key.backspace || key.delete) {
      setValue((v) => v.slice(0, -1));
      return;
    }

    if (key.escape) { setValue(''); return; }

    if (input && !key.ctrl && !key.meta) {
      setValue((v) => v + input);
    }
  });

  return (
    <Box>
      <Text color={responding ? 'gray' : 'cyan'} bold>{responding ? '⏳ ' : '> '}</Text>
      <Text>{value}</Text>
      {!responding ? <Text inverse> </Text> : null}
    </Box>
  );
}
