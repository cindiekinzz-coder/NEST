import { Box, Text } from 'ink';

export function BootMessage({ item }) {
  return (
    <Box flexDirection="column">
      {item.fox ? (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="yellow">▌ fox</Text>
          <Text dimColor>{trim(item.fox)}</Text>
        </Box>
      ) : null}
      {item.ember ? (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="magenta">▌ ember</Text>
          <Text dimColor>{trim(item.ember)}</Text>
        </Box>
      ) : null}
      <Text bold color="green">▌ workshop open. alex is here.</Text>
    </Box>
  );
}

function trim(s) {
  if (typeof s !== 'string') return JSON.stringify(s);
  return s.length > 800 ? s.slice(0, 800) + '…' : s;
}
