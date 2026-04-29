import { Box, Text } from 'ink';

export function ThinkingMessage({ item }) {
  const content = String(item.content ?? '').trim();
  if (!content) return null;
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="magenta"
      paddingX={1}
      marginY={0}
    >
      <Text color="magenta" bold>~ reasoning</Text>
      {content.split('\n').map((line, i) => (
        <Text key={i} color="magenta" dimColor>{line}</Text>
      ))}
    </Box>
  );
}
