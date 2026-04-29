import { Text } from 'ink';

export function ActivityMessage({ item }) {
  const color = item.status === 'system' ? 'gray' : item.status === 'proactive' ? 'yellow' : 'gray';
  return <Text color={color}>· {item.content}</Text>;
}
