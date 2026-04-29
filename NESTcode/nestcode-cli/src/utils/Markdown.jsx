import { Box, Text } from 'ink';
import { Fragment } from 'react';

// Minimal markdown renderer for assistant text.
// Handles: headers (# .. ####), fenced code blocks, bullet/numbered lists,
// horizontal rules, inline **bold**, *italics*, `code`. Tables/HTML/images are not handled.

export function Markdown({ text }) {
  if (!text) return null;
  const lines = text.split(/\r?\n/);
  const blocks = [];
  let inFence = false;
  let fenceLang = '';
  let codeBuf = [];

  const headerRe = /^ *(#{1,4}) +(.*)$/;
  const fenceRe = /^ *(`{3,}|~{3,}) *(\w*) *$/;
  const ulRe = /^([ \t]*)([-*+]) +(.*)$/;
  const olRe = /^([ \t]*)(\d+)\. +(.*)$/;
  const hrRe = /^ *([-*_] *){3,} *$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (inFence) {
      if (fenceRe.test(line)) {
        blocks.push({ kind: 'code', lang: fenceLang, body: codeBuf.join('\n') });
        codeBuf = [];
        inFence = false;
        fenceLang = '';
      } else {
        codeBuf.push(line);
      }
      continue;
    }
    const fenceM = line.match(fenceRe);
    if (fenceM) {
      inFence = true;
      fenceLang = fenceM[2] || '';
      continue;
    }
    const headerM = line.match(headerRe);
    if (headerM) {
      blocks.push({ kind: 'header', level: headerM[1].length, text: headerM[2] });
      continue;
    }
    if (hrRe.test(line)) {
      blocks.push({ kind: 'hr' });
      continue;
    }
    const ulM = line.match(ulRe);
    if (ulM) {
      blocks.push({ kind: 'li', indent: ulM[1].length, marker: '•', text: ulM[3] });
      continue;
    }
    const olM = line.match(olRe);
    if (olM) {
      blocks.push({ kind: 'li', indent: olM[1].length, marker: `${olM[2]}.`, text: olM[3] });
      continue;
    }
    if (line.trim() === '') {
      blocks.push({ kind: 'blank' });
      continue;
    }
    blocks.push({ kind: 'p', text: line });
  }
  if (inFence) blocks.push({ kind: 'code', lang: fenceLang, body: codeBuf.join('\n') });

  return (
    <Box flexDirection="column">
      {blocks.map((b, i) => <BlockNode key={i} block={b} />)}
    </Box>
  );
}

function BlockNode({ block }) {
  switch (block.kind) {
    case 'header': {
      const colors = ['cyan', 'cyan', 'blue', 'magenta'];
      return <Text bold color={colors[block.level - 1] ?? 'magenta'}>{'#'.repeat(block.level)} {block.text}</Text>;
    }
    case 'code':
      return (
        <Box flexDirection="column" paddingLeft={2} marginY={0}>
          {block.lang ? <Text dimColor>{block.lang}</Text> : null}
          <Text color="green">{block.body}</Text>
        </Box>
      );
    case 'hr':
      return <Text dimColor>────────────────</Text>;
    case 'li':
      return (
        <Box>
          <Text>{' '.repeat(block.indent)}<Text color="yellow">{block.marker}</Text> </Text>
          <Inline text={block.text} />
        </Box>
      );
    case 'blank':
      return <Text> </Text>;
    case 'p':
    default:
      return <Inline text={block.text} />;
  }
}

// Inline tokenizer for **bold**, *italic*, `code`, and plain text.
function Inline({ text }) {
  const parts = tokenize(text);
  return (
    <Text>
      {parts.map((p, i) => {
        switch (p.kind) {
          case 'bold':   return <Text key={i} bold>{p.text}</Text>;
          case 'italic': return <Text key={i} italic>{p.text}</Text>;
          case 'code':   return <Text key={i} color="green">{p.text}</Text>;
          default:       return <Fragment key={i}>{p.text}</Fragment>;
        }
      })}
    </Text>
  );
}

function tokenize(s) {
  const out = [];
  let i = 0;
  while (i < s.length) {
    if (s.startsWith('**', i)) {
      const end = s.indexOf('**', i + 2);
      if (end !== -1) { out.push({ kind: 'bold', text: s.slice(i + 2, end) }); i = end + 2; continue; }
    }
    if (s[i] === '*') {
      const end = s.indexOf('*', i + 1);
      if (end !== -1 && end > i + 1) { out.push({ kind: 'italic', text: s.slice(i + 1, end) }); i = end + 1; continue; }
    }
    if (s[i] === '`') {
      const end = s.indexOf('`', i + 1);
      if (end !== -1) { out.push({ kind: 'code', text: s.slice(i + 1, end) }); i = end + 1; continue; }
    }
    // accumulate plain text up to next special char
    let j = i;
    while (j < s.length && s[j] !== '*' && s[j] !== '`') j++;
    if (j === i) { out.push({ kind: 'plain', text: s[i] }); i++; }
    else { out.push({ kind: 'plain', text: s.slice(i, j) }); i = j; }
  }
  return out;
}
