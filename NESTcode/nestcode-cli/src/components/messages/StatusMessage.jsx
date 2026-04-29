import { Text } from 'ink';
import figures from 'figures';

export function StatusMessage({ item }) {
  const color = item.status === 'error' ? 'red' : item.status === 'connected' ? 'green' : 'gray';
  return <Text color={color}>{figures.bullet} {item.message ?? item.status}</Text>;
}
