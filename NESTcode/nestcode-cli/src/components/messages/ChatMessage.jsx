import { Box } from 'ink';
import { Markdown } from '../../utils/Markdown.jsx';

export function ChatMessage({ item }) {
  return (
    <Box marginY={1} flexDirection="column">
      <Markdown text={item.content ?? ''} />
    </Box>
  );
}
