import { Text } from 'ink';

export function HeartbeatMessage({ item }) {
  return <Text color="yellow">♥ fox: {item.foxBrief ?? ''}</Text>;
}
