import { Box, Text } from 'ink';

export function UserMessage({ item }) {
  return (
    <Box marginY={0}>
      <Text color="cyan" bold>{'> '}</Text>
      <Text>{item.content}</Text>
    </Box>
  );
}
