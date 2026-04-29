import { Box, Text } from 'ink';

export function RunOutputMessage({ item }) {
  if (item.error) {
    return (
      <Box flexDirection="column">
        <Text color="red" bold>run error</Text>
        <Text color="red">{item.error}</Text>
      </Box>
    );
  }
  return (
    <Box flexDirection="column">
      <Text color="green" bold>run output{item.language ? ` (${item.language})` : ''}</Text>
      <Text>{item.output}</Text>
    </Box>
  );
}
