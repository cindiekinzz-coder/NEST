import { Box, Text } from 'ink';
import { Spinner } from '@inkjs/ui';
import { DiffView } from '../../utils/Diff.jsx';

const FILE_EDIT_TOOLS = new Set(['pc_file_edit', 'pc_file_write']);
// Fields that commonly carry long-form prose worth showing under the call line.
const PROSE_FIELDS = ['content', 'text', 'body', 'message', 'note', 'observation', 'observations'];

export function ToolMessage({ item }) {
  const args = item.arguments ?? {};
  const summary = summarizeArgs(item.name, args);
  const proseBody = extractProse(args);
  const pending = item.result === undefined;

  return (
    <Box flexDirection="column" marginY={0}>
      <Box>
        {pending ? <Spinner /> : <Text color="cyan">→</Text>}
        <Text> </Text>
        <Text color="cyan" bold>{item.name}</Text>
        {summary ? <Text dimColor> {summary}</Text> : null}
      </Box>
      {proseBody ? <ProseBody body={proseBody} /> : null}
      {!pending ? <ToolResult name={item.name} args={args} result={item.result} /> : null}
    </Box>
  );
}

function ProseBody({ body }) {
  const lines = body.split('\n');
  const shown = lines.slice(0, 14);
  const overflow = lines.length - shown.length;
  return (
    <Box paddingLeft={2} flexDirection="column" marginTop={0} marginBottom={0}>
      {shown.map((l, i) => <Text key={i}>{l}</Text>)}
      {overflow > 0 ? <Text dimColor>… (+{overflow} more lines)</Text> : null}
    </Box>
  );
}

function ToolResult({ name, args, result }) {
  if (FILE_EDIT_TOOLS.has(name) && typeof result === 'string' && /diff/i.test(result)) {
    return (
      <Box paddingLeft={2} flexDirection="column">
        <DiffView unified={result} filename={args.path} />
      </Box>
    );
  }
  const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
  const lines = text.split('\n');
  const shown = lines.slice(0, 12);
  const overflow = lines.length - shown.length;
  return (
    <Box paddingLeft={2} flexDirection="column">
      {shown.map((l, i) => <Text key={i} dimColor>{l}</Text>)}
      {overflow > 0 ? <Text dimColor>… (+{overflow} more lines)</Text> : null}
    </Box>
  );
}

function summarizeArgs(name, args) {
  if (!args || typeof args !== 'object') return '';
  if (args.path) return args.path;
  if (args.command) return String(args.command).slice(0, 100);
  if (args.query) return `"${String(args.query).slice(0, 80)}"`;
  if (args.title) return `"${args.title}"${args.type ? ` · ${args.type}` : ''}${args.writing_type ? ` · ${args.writing_type}` : ''}`;
  if (args.entity_name) return args.entity_name;
  if (args.from_entity && args.to_entity) return `${args.from_entity} → ${args.to_entity}`;
  if (args.emotion && args.content) return `${args.emotion}: "${String(args.content).slice(0, 60)}"`;
  if (args.tool && args.label) return `${args.tool} (${args.label})`;
  // No prominent field — fall back to compact key list
  const keys = Object.keys(args).filter((k) => !PROSE_FIELDS.includes(k));
  if (keys.length === 0) return '';
  return `{${keys.slice(0, 4).join(', ')}}`;
}

function extractProse(args) {
  if (!args || typeof args !== 'object') return null;
  for (const key of PROSE_FIELDS) {
    const val = args[key];
    if (typeof val === 'string' && val.length > 80) return val;
    if (Array.isArray(val) && val.length > 0 && val.every((v) => typeof v === 'string')) {
      const joined = val.join('\n');
      if (joined.length > 80) return joined;
    }
  }
  return null;
}
