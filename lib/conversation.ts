// lib/conversation.ts — Threading, pagination, search (server-only)
//
// FIXES vs. source material:
// 1. The original built an unused `whereClause` string via raw
//    interpolation of `conversationId` and `cursor` into SQL text
//    (`m.conversation_id = ${conversationId}`, `id = '${cursor}'`).
//    It was never actually executed — the real query used a safe
//    parameterized tagged template — but leaving an injectable string
//    assembled from user input sitting in the file is a landmine for
//    whoever copies it into a real query later. Removed entirely.
// 2. The message SELECT aliased `u.id as sender_id`, colliding with the
//    already-selected `m.sender_id` column. Harmless here since the two
//    are always equal (given the JOIN condition), but ambiguous.
//    Removed the duplicate.
// 3. Added authorization: every exported function that touches a
//    specific conversation now takes and checks the requesting user via
//    lib/authz.ts, rather than trusting the caller.
import 'server-only';
import { sql } from '@vercel/postgres';
import { assertParticipant } from './authz';

export interface ThreadNode {
  id: string;
  conversationId: string;
  senderId: string;
  parentMessageId: string | null;
  content: string;
  contentType: string;
  replyCount: number;
  reactions: Record<string, string[]>;
  attachments: unknown[];
  isDeleted: boolean;
  isPinned: boolean;
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
  sender: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  readBy: string[];
  children?: ThreadNode[];
}

export interface PaginatedMessages {
  messages: ThreadNode[];
  nextCursor: string | null;
  hasMore: boolean;
  totalCount: number;
}

function rowToNode(row: Record<string, any>, readBy: string[] = []): ThreadNode {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    parentMessageId: row.parent_message_id,
    content: row.is_deleted ? '[deleted]' : row.content,
    contentType: row.content_type,
    replyCount: row.reply_count,
    reactions: row.reactions || {},
    attachments: row.attachments || [],
    isDeleted: row.is_deleted,
    isPinned: row.is_pinned,
    isEdited: Array.isArray(row.edit_history) && row.edit_history.length > 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sender: {
      id: row.sender_id,
      username: row.username,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
    },
    readBy,
  };
}

/**
 * Fetch messages with cursor-based pagination + optional thread expansion.
 * Caller must be a participant in the conversation.
 */
export async function fetchConversationMessages(
  conversationId: string,
  requestingUserId: string,
  options: {
    cursor?: string;
    limit?: number;
    expandThreads?: boolean;
    threadDepth?: number;
  } = {}
): Promise<PaginatedMessages> {
  await assertParticipant(conversationId, requestingUserId);

  const { cursor, limit = 50, expandThreads = true, threadDepth = 2 } = options;

  const messagesQuery = cursor
    ? await sql`
        SELECT
          m.id, m.conversation_id, m.sender_id, m.parent_message_id,
          m.content, m.content_type, m.reply_count, m.reactions,
          m.attachments, m.is_deleted, m.is_pinned, m.edit_history, m.created_at, m.updated_at,
          u.username, u.display_name, u.avatar_url
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.conversation_id = ${conversationId}
          AND m.created_at < (SELECT created_at FROM messages WHERE id = ${cursor})
        ORDER BY m.created_at DESC
        LIMIT ${limit + 1}
      `
    : await sql`
        SELECT
          m.id, m.conversation_id, m.sender_id, m.parent_message_id,
          m.content, m.content_type, m.reply_count, m.reactions,
          m.attachments, m.is_deleted, m.is_pinned, m.edit_history, m.created_at, m.updated_at,
          u.username, u.display_name, u.avatar_url
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.conversation_id = ${conversationId}
        ORDER BY m.created_at DESC
        LIMIT ${limit + 1}
      `;

  const rows = messagesQuery.rows;
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? pageRows[pageRows.length - 1].id : null;

  const messageIds: string[] = pageRows.map((m) => m.id);
  const readReceipts = messageIds.length > 0
    ? await sql.query(
        `SELECT message_id, user_id FROM message_read_receipts WHERE message_id = ANY($1)`,
        [messageIds]
      )
    : { rows: [] as { message_id: string; user_id: string }[] };

  const readMap = new Map<string, string[]>();
  for (const r of readReceipts.rows) {
    if (!readMap.has(r.message_id)) readMap.set(r.message_id, []);
    readMap.get(r.message_id)!.push(r.user_id);
  }

  const messageMap = new Map<string, ThreadNode>();
  const rootMessages: ThreadNode[] = [];

  for (const row of pageRows) {
    const node = rowToNode(row, readMap.get(row.id) || []);
    node.children = [];
    messageMap.set(row.id, node);
  }

  for (const node of messageMap.values()) {
    if (node.parentMessageId && messageMap.has(node.parentMessageId)) {
      const parent = messageMap.get(node.parentMessageId)!;
      parent.children!.push(node);
    } else if (!node.parentMessageId) {
      rootMessages.push(node);
    }
  }

  if (expandThreads && threadDepth > 0 && rootMessages.length > 0) {
    await expandThreadReplies(rootMessages, threadDepth, conversationId);
  }

  const countResult = await sql`
    SELECT COUNT(*) as total FROM messages
    WHERE conversation_id = ${conversationId} AND is_deleted = false
  `;

  return {
    messages: rootMessages.reverse(), // chronological order
    nextCursor,
    hasMore,
    totalCount: parseInt(countResult.rows[0].total, 10),
  };
}

/** Recursive CTE thread expansion, up to `depth` levels. */
async function expandThreadReplies(
  nodes: ThreadNode[],
  depth: number,
  conversationId: string
): Promise<void> {
  if (depth <= 0 || nodes.length === 0) return;

  const parentIds = nodes.map((n) => n.id);

  const repliesQuery = await sql.query(
    `WITH RECURSIVE thread_tree AS (
      SELECT
        m.id, m.conversation_id, m.sender_id, m.parent_message_id,
        m.content, m.content_type, m.reply_count, m.reactions,
        m.attachments, m.is_deleted, m.is_pinned, m.edit_history, m.created_at, m.updated_at,
        u.username, u.display_name, u.avatar_url,
        1 as depth
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.parent_message_id = ANY($1)
        AND m.conversation_id = $2
        AND m.is_deleted = false

      UNION ALL

      SELECT
        m.id, m.conversation_id, m.sender_id, m.parent_message_id,
        m.content, m.content_type, m.reply_count, m.reactions,
        m.attachments, m.is_deleted, m.is_pinned, m.edit_history, m.created_at, m.updated_at,
        u.username, u.display_name, u.avatar_url,
        tt.depth + 1
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      JOIN thread_tree tt ON m.parent_message_id = tt.id
      WHERE tt.depth < $3
        AND m.conversation_id = $2
        AND m.is_deleted = false
    )
    SELECT * FROM thread_tree ORDER BY created_at ASC`,
    [parentIds, conversationId, depth]
  );

  const replyMap = new Map<string, ThreadNode>();
  for (const row of repliesQuery.rows) {
    const node = rowToNode(row);
    node.children = [];
    replyMap.set(row.id, node);
  }

  const nodeIndex = new Map<string, ThreadNode>(nodes.map((n) => [n.id, n]));
  for (const reply of replyMap.values()) {
    const parent =
      (reply.parentMessageId && replyMap.get(reply.parentMessageId)) ||
      (reply.parentMessageId && nodeIndex.get(reply.parentMessageId));
    if (parent) {
      parent.children = parent.children || [];
      parent.children.push(reply);
    }
  }
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string,
  options: {
    parentMessageId?: string;
    contentType?: string;
    attachments?: unknown[];
    encryptedContent?: string;
  } = {}
): Promise<ThreadNode> {
  await assertParticipant(conversationId, senderId);

  const { parentMessageId, contentType = 'text', attachments = [], encryptedContent } = options;

  const result = await sql`
    INSERT INTO messages (
      conversation_id, sender_id, parent_message_id, content,
      content_type, encrypted_content, attachments
    ) VALUES (
      ${conversationId}, ${senderId}, ${parentMessageId || null},
      ${content}, ${contentType}, ${encryptedContent || null},
      ${JSON.stringify(attachments)}
    )
    RETURNING id
  `;

  if (parentMessageId) {
    await sql`
      UPDATE messages
      SET reply_count = reply_count + 1, updated_at = NOW()
      WHERE id = ${parentMessageId}
    `;
  }

  await sql`
    UPDATE conversations
    SET last_message_at = NOW(), updated_at = NOW()
    WHERE id = ${conversationId}
  `;

  const messageId = result.rows[0].id;

  const fullMessage = await sql`
    SELECT m.*, u.username, u.display_name, u.avatar_url
    FROM messages m
    JOIN users u ON m.sender_id = u.id
    WHERE m.id = ${messageId}
  `;

  return rowToNode(fullMessage.rows[0]);
}

export async function markMessagesAsRead(
  conversationId: string,
  messageIds: string[],
  userId: string
): Promise<void> {
  if (messageIds.length === 0) return;
  await assertParticipant(conversationId, userId);

  await sql.query(
    `INSERT INTO message_read_receipts (message_id, user_id)
     SELECT unnest($1::uuid[]), $2::uuid
     ON CONFLICT (message_id, user_id) DO NOTHING`,
    [messageIds, userId]
  );

  await sql`
    UPDATE conversation_participants
    SET last_read_message_id = ${messageIds[messageIds.length - 1]}
    WHERE conversation_id = ${conversationId} AND user_id = ${userId}
  `;
}

export async function getUnreadCount(conversationId: string, userId: string): Promise<number> {
  await assertParticipant(conversationId, userId);

  const result = await sql`
    SELECT COUNT(*) as count
    FROM messages m
    LEFT JOIN message_read_receipts mr
      ON m.id = mr.message_id AND mr.user_id = ${userId}
    WHERE m.conversation_id = ${conversationId}
      AND m.sender_id != ${userId}
      AND mr.message_id IS NULL
      AND m.is_deleted = false
  `;
  return parseInt(result.rows[0].count, 10);
}

/** Full-text search within a conversation. Caller must be a participant. */
export async function searchMessages(
  conversationId: string,
  requestingUserId: string,
  query: string,
  options: { limit?: number } = {}
): Promise<ThreadNode[]> {
  await assertParticipant(conversationId, requestingUserId);

  const { limit = 20 } = options;

  const searchResult = await sql`
    SELECT
      m.id, m.conversation_id, m.sender_id, m.parent_message_id,
      m.content, m.content_type, m.reply_count, m.reactions,
      m.attachments, m.is_deleted, m.is_pinned, m.edit_history, m.created_at, m.updated_at,
      u.username, u.display_name, u.avatar_url,
      ts_rank(to_tsvector('english', m.content), plainto_tsquery('english', ${query})) as rank
    FROM messages m
    JOIN users u ON m.sender_id = u.id
    WHERE m.conversation_id = ${conversationId}
      AND m.is_deleted = false
      AND to_tsvector('english', m.content) @@ plainto_tsquery('english', ${query})
    ORDER BY rank DESC, m.created_at DESC
    LIMIT ${limit}
  `;

  return searchResult.rows.map((row) => rowToNode(row));
}
