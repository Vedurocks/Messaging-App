-- ============================================================
-- Secure Communication Platform - PostgreSQL Schema
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(32) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(64),
    avatar_url TEXT,
    public_key TEXT,                       -- for E2E encryption (client-generated; nullable until enrolled)
    status VARCHAR(20) DEFAULT 'offline',  -- online, offline, away, dnd
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- Sessions table (dual-token: short-lived access + rotating refresh)
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,      -- SHA-256 hash of the issued access token (JWT)
    refresh_token_hash VARCHAR(255),       -- SHA-256 hash of the issued refresh token
    device_info JSONB,                     -- { browser, os, device }
    ip_address INET,
    expires_at TIMESTAMPTZ NOT NULL,
    refresh_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    is_revoked BOOLEAN DEFAULT FALSE
);

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(20) NOT NULL DEFAULT 'direct', -- direct, group
    title VARCHAR(128),
    description TEXT,
    avatar_url TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_message_at TIMESTAMPTZ,
    is_encrypted BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}'
);

-- Conversation participants
CREATE TABLE IF NOT EXISTS conversation_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member',    -- owner, admin, member
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    left_at TIMESTAMPTZ,                  -- null = still a member
    last_read_message_id UUID,
    is_muted BOOLEAN DEFAULT FALSE,
    notification_settings JSONB DEFAULT '{"all": true}',
    UNIQUE(conversation_id, user_id)
);

-- Messages table (with threading support)
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_message_id UUID REFERENCES messages(id) ON DELETE SET NULL, -- threading
    content TEXT NOT NULL,
    content_type VARCHAR(20) DEFAULT 'text', -- text, image, file, system
    encrypted_content TEXT,                  -- E2E encrypted payload
    reply_count INTEGER DEFAULT 0,           -- cached reply count for threads
    reactions JSONB DEFAULT '{}',            -- { "👍": [user_id1, user_id2] }
    attachments JSONB DEFAULT '[]',
    edit_history JSONB DEFAULT '[]',         -- [{ content, edited_at }]
    is_deleted BOOLEAN DEFAULT FALSE,
    is_pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Message read receipts (per-recipient — correct for both DMs and groups)
CREATE TABLE IF NOT EXISTS message_read_receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(message_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_conversations_last_msg ON conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_parent ON messages(parent_message_id) WHERE parent_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(conversation_id, parent_message_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_participants_user ON conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_participants_conv ON conversation_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_read_receipts_message ON message_read_receipts(message_id);

-- GIN indexes for JSONB queries
CREATE INDEX IF NOT EXISTS idx_messages_reactions ON messages USING GIN(reactions);
CREATE INDEX IF NOT EXISTS idx_sessions_device ON sessions USING GIN(device_info);

-- updated_at auto-touch trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_conversations_updated_at ON conversations;
CREATE TRIGGER trg_conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_messages_updated_at ON messages;
CREATE TRIGGER trg_messages_updated_at BEFORE UPDATE ON messages
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Row Level Security (recommended defense-in-depth layer)
-- ============================================================
-- Not yet wired into the app layer (would require setting a session
-- variable like `app.current_user_id` via `SET LOCAL` on every
-- connection, e.g. through Prisma/pg middleware). Left here as a
-- documented next step rather than partially enabled — a half-wired
-- RLS policy is worse than none, since it creates false confidence.
--
-- ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY messages_participant_only ON messages
--   USING (
--     conversation_id IN (
--       SELECT conversation_id FROM conversation_participants
--       WHERE user_id = current_setting('app.current_user_id')::uuid
--         AND left_at IS NULL
--     )
--   );
