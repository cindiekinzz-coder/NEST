import { Text } from 'ink';
import { StatusMessage } from './messages/StatusMessage.jsx';
import { BootMessage } from './messages/BootMessage.jsx';
import { ThinkingMessage } from './messages/ThinkingMessage.jsx';
import { ToolMessage } from './messages/ToolMessage.jsx';
import { ActivityMessage } from './messages/ActivityMessage.jsx';
import { ChatMessage } from './messages/ChatMessage.jsx';
import { UserMessage } from './messages/UserMessage.jsx';
import { HeartbeatMessage } from './messages/HeartbeatMessage.jsx';
import { RunOutputMessage } from './messages/RunOutputMessage.jsx';
import { ErrorMessage } from './messages/ErrorMessage.jsx';

export function HistoryItemDisplay({ item }) {
  switch (item.kind) {
    case 'status':     return <StatusMessage item={item} />;
    case 'boot':       return <BootMessage item={item} />;
    case 'thinking':   return <ThinkingMessage item={item} />;
    case 'tool_call':  return <ToolMessage item={item} />;
    case 'activity':   return <ActivityMessage item={item} />;
    case 'chat':       return <ChatMessage item={item} />;
    case 'user':       return <UserMessage item={item} />;
    case 'heartbeat':  return <HeartbeatMessage item={item} />;
    case 'run_output': return <RunOutputMessage item={item} />;
    case 'error':      return <ErrorMessage item={item} />;
    case 'unknown':    return <Text dimColor>[{item.raw?.type ?? 'unknown'}]</Text>;
    default:           return null;
  }
}
