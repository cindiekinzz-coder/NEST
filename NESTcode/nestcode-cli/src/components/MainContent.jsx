import { Box, Static } from 'ink';
import { useUIState } from '../contexts/UIStateContext.jsx';
import { HistoryItemDisplay } from './HistoryItemDisplay.jsx';

// MainContent uses Ink's <Static> for committed history (won't re-render on input changes)
// plus a live tail for the most recent item that may still be mutating (e.g. tool_call awaiting result).
export function MainContent() {
  const { state } = useUIState();
  const history = state.history;
  if (history.length === 0) {
    return <Box flexDirection="column" />;
  }

  // Keep the very last item dynamic (it might be a pending tool_call that gets a result merged in).
  // Everything before it is "committed" — render via <Static> so it scrolls naturally above the input.
  const committed = history.slice(0, -1);
  const tail = history[history.length - 1];

  return (
    <Box flexDirection="column">
      <Static items={committed}>
        {(item) => <HistoryItemDisplay key={item.id} item={item} />}
      </Static>
      <HistoryItemDisplay item={tail} />
    </Box>
  );
}
