import { Box } from 'ink';
import { MainContent } from './MainContent.jsx';
import { Composer } from './Composer.jsx';

export function DefaultAppLayout({ model }) {
  return (
    <Box flexDirection="column">
      <MainContent />
      <Composer model={model} />
    </Box>
  );
}
