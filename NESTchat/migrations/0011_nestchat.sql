-- NESTchat — Chat Persistence & Search
-- Add to your existing NESTeq D1 database

-- Chat sessions track conversations across rooms
CREATE TABLE IF NOT EXISTS chat_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME,
    summary TEXT,
    summary_vectorized BOOLEAN DEFAULT 0,
    message_count INTEGER DEFAULT 0,
    last_message_at DATETIME,
    room TEXT DEFAULT 'chat',        -- chat, workshop, porch, etc.
    metadata TEXT                     -- session key for deduplication
);

-- Individual messages within a session
CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    tool_calls TEXT,                  -- JSON string of tool calls if any
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES chat_sessions(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_room ON chat_sessions(room);
