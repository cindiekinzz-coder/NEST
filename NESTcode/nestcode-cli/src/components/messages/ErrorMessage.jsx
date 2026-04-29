import { Text } from 'ink';

export function ErrorMessage({ item }) {
  return <Text color="red" bold>× {item.message}</Text>;
}
