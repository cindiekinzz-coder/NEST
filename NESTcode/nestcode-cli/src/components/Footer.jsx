import { Box, Text } from 'ink';
import { useUIState } from '../contexts/UIStateContext.jsx';
import { StreamingState } from '../types.js';

export function Footer({ model, gateway }) {
  const { state } = useUIState();
  const dot = state.status === 'connected' ? <Text color="green">●</Text>
            : state.status === 'error' || state.status === 'closed' ? <Text color="red">●</Text>
            : <Text color="yellow">●</Text>;
  const turnTag = state.streamingState === StreamingState.Responding
    ? <Text color="yellow"> ⏳ turn in progress · Ctrl+C to stop</Text>
    : null;

  return (
    <Box>
      {dot}
      <Text dimColor> {state.status}</Text>
      {model ? <Text dimColor>  ·  model {model}</Text> : null}
      {state.workspace ? <Text dimColor>  ·  ws {short(state.workspace)}</Text> : null}
      {turnTag}
    </Box>
  );
}

function short(p) {
  if (!p) return '';
  return p.length > 40 ? '…' + p.slice(-39) : p;
}
