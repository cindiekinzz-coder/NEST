import { Box } from 'ink';
import { TodoTray } from './TodoTray.jsx';
import { SimpleInput } from './SimpleInput.jsx';
import { Footer } from './Footer.jsx';

export function Composer({ model }) {
  return (
    <Box flexDirection="column" flexShrink={0}>
      <TodoTray />
      <Box marginTop={1}>
        <SimpleInput />
      </Box>
      <Footer model={model} />
    </Box>
  );
}
