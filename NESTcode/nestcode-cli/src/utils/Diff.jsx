import { Box, Text } from 'ink';
import { diffLines } from 'diff';

// Renders a unified-diff-ish view of two strings, or a pre-formatted unified diff.
// If `unified` is provided as a string starting with @@/---/+++, parse line-by-line.
// Otherwise diff `before` and `after`.

export function DiffView({ before, after, unified, filename }) {
  const lines = unified ? parseUnified(unified) : diffStrings(before ?? '', after ?? '');
  return (
    <Box flexDirection="column">
      {filename ? <Text color="cyan">▌ {filename}</Text> : null}
      {lines.map((l, i) => {
        const color = l.kind === 'add' ? 'green' : l.kind === 'del' ? 'red' : undefined;
        const prefix = l.kind === 'add' ? '+' : l.kind === 'del' ? '-' : ' ';
        return (
          <Text key={i} color={color}>
            {prefix} {l.text}
          </Text>
        );
      })}
    </Box>
  );
}

function diffStrings(a, b) {
  const parts = diffLines(a, b);
  const lines = [];
  for (const part of parts) {
    const kind = part.added ? 'add' : part.removed ? 'del' : 'ctx';
    const split = part.value.replace(/\n$/, '').split('\n');
    for (const t of split) lines.push({ kind, text: t });
  }
  return lines;
}

function parseUnified(text) {
  const out = [];
  for (const line of text.split('\n')) {
    if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@')) continue;
    if (line.startsWith('+')) out.push({ kind: 'add', text: line.slice(1) });
    else if (line.startsWith('-')) out.push({ kind: 'del', text: line.slice(1) });
    else out.push({ kind: 'ctx', text: line.startsWith(' ') ? line.slice(1) : line });
  }
  return out;
}
