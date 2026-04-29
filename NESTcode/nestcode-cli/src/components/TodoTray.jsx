import { Box, Text } from 'ink';
import { useUIState } from '../contexts/UIStateContext.jsx';

export function TodoTray() {
  const { state } = useUIState();
  if (!state.todos || state.todos.length === 0) return null;
  const done = state.todos.filter((t) => t.status === 'completed').length;
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="blue" paddingX={1}>
      <Text color="blue" bold>todos {done}/{state.todos.length}</Text>
      {state.todos.map((t, i) => {
        const sym = t.status === 'completed' ? '✓' : t.status === 'in_progress' ? '◐' : '○';
        const color = t.status === 'completed' ? 'green' : t.status === 'in_progress' ? 'yellow' : 'gray';
        return (
          <Text key={i} color={color}>
            {sym} {t.content ?? t.text ?? ''}
          </Text>
        );
      })}
    </Box>
  );
}
