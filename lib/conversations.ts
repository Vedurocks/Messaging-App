// lib/conversations.ts — list/create conversations, user search (server-only)
import 'server-only';
import { sql } from '@/lib/db';
import type { Conversation, ConversationParticipantWithUser, ConversationListItemData, User } from './types';

function rowToUser(row: Record<string, any>): User {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    status: row.status,
    lastSeen: row.last_seen,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isActive: row.is_active,
  };
}

function rowToConversation(row: Record<string, any>): Conversation {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    description: row.description,
    avatarUrl: row.avatar_url,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastMessageAt: row.last_message_at,
    isEncrypted: row.is_encrypted,
  };
}

/**
 * List every conversation the given user is currently a participant in
 * (left_at IS NULL), with last-message preview and unread count — the data
 * a sidebar needs. For direct conversations, also resolves "the other
 * person" so the UI has someone to show a name/avatar for.
 */
export async function listUserConversations(userId: string): Promise<ConversationListItemData[]> {
  const convRows = await sql`
    SELECT c.*
    FROM conversations c
    JOIN conversation_participants cp ON cp.conversation_id = c.id
    WHERE cp.user_id = ${userId} AND cp.left_at IS NULL
    ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC
  `;

  const summaries: ConversationListItemData[] = [];

  for (const row of convRows.rows) {
    const conversation = rowToConversation(row);

    let otherParticipant: User | null = null;
    if (conversation.type === 'direct') {
      const otherRow = await sql`
        SELECT u.*
        FROM conversation_participants cp
        JOIN users u ON u.id = cp.user_id
        WHERE cp.conversation_id = ${conversation.id}
          AND cp.user_id != ${userId}
          AND cp.left_at IS NULL
        LIMIT 1
      `;
      if (otherRow.rows[0]) otherParticipant = rowToUser(otherRow.rows[0]);
    }

    const lastMsgRow = await sql`
      SELECT m.id, m.content, m.content_type, m.sender_id, m.created_at, m.is_deleted,
             u.username AS sender_username, u.display_name AS sender_display_name
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.conversation_id = ${conversation.id}
      ORDER BY m.created_at DESC
      LIMIT 1
    `;
    const lastMessage = lastMsgRow.rows[0]
      ? {
          id: lastMsgRow.rows[0].id,
          content: lastMsgRow.rows[0].content,
          contentType: lastMsgRow.rows[0].content_type,
          senderId: lastMsgRow.rows[0].sender_id,
          createdAt: lastMsgRow.rows[0].created_at,
          isDeleted: lastMsgRow.rows[0].is_deleted,
          sender: {
            username: lastMsgRow.rows[0].sender_username,
            displayName: lastMsgRow.rows[0].sender_display_name,
          },
        }
      : null;

    const myParticipant = await sql`
      SELECT last_read_message_id
      FROM conversation_participants
      WHERE conversation_id = ${conversation.id} AND user_id = ${userId}
    `;
    const lastReadId = myParticipant.rows[0]?.last_read_message_id;

    const unreadRow = lastReadId
      ? await sql`
          SELECT COUNT(*)::int AS count FROM messages
          WHERE conversation_id = ${conversation.id}
            AND created_at > (SELECT created_at FROM messages WHERE id = ${lastReadId})
            AND sender_id != ${userId}
            AND is_deleted = false
        `
      : await sql`
          SELECT COUNT(*)::int AS count FROM messages
          WHERE conversation_id = ${conversation.id}
            AND sender_id != ${userId}
            AND is_deleted = false
        `;

    summaries.push({
      conversation,
      otherParticipant,
      lastMessage,
      unreadCount: unreadRow.rows[0]?.count ?? 0,
    });
  }

  return summaries;
}

/**
 * Finds an existing direct (1:1) conversation between two users, if one
 * exists. Prevents duplicate DM threads from piling up every time someone
 * clicks "message" on the same person.
 */
async function findExistingDirectConversation(userA: string, userB: string): Promise<string | null> {
  const result = await sql`
    SELECT cp1.conversation_id AS id
    FROM conversation_participants cp1
    JOIN conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
    JOIN conversations c ON c.id = cp1.conversation_id
    WHERE c.type = 'direct'
      AND cp1.user_id = ${userA} AND cp1.left_at IS NULL
      AND cp2.user_id = ${userB} AND cp2.left_at IS NULL
    LIMIT 1
  `;
  return result.rows[0]?.id ?? null;
}

/** Creates a direct conversation between two users, reusing an existing one if present. */
export async function createDirectConversation(userId: string, otherUserId: string): Promise<Conversation> {
  if (userId === otherUserId) {
    throw new Error('Cannot start a direct conversation with yourself');
  }

  const existingId = await findExistingDirectConversation(userId, otherUserId);
  if (existingId) {
    const existing = await sql`SELECT * FROM conversations WHERE id = ${existingId}`;
    return rowToConversation(existing.rows[0]);
  }

  const created = await sql`
    INSERT INTO conversations (type, created_by)
    VALUES ('direct', ${userId})
    RETURNING *
  `;
  const conversation = rowToConversation(created.rows[0]);

  await sql`
    INSERT INTO conversation_participants (conversation_id, user_id, role)
    VALUES (${conversation.id}, ${userId}, 'owner'), (${conversation.id}, ${otherUserId}, 'member')
  `;

  return conversation;
}

/** Creates a group conversation with the given title and initial member IDs (creator is auto-added as owner). */
export async function createGroupConversation(
  creatorId: string,
  title: string,
  memberIds: string[]
): Promise<Conversation> {
  if (!title.trim()) {
    throw new Error('Group title is required');
  }

  const created = await sql`
    INSERT INTO conversations (type, title, created_by)
    VALUES ('group', ${title.trim()}, ${creatorId})
    RETURNING *
  `;
  const conversation = rowToConversation(created.rows[0]);

  await sql`
    INSERT INTO conversation_participants (conversation_id, user_id, role)
    VALUES (${conversation.id}, ${creatorId}, 'owner')
  `;

  const uniqueMemberIds = Array.from(new Set(memberIds)).filter((id) => id !== creatorId);
  for (const memberId of uniqueMemberIds) {
    await sql`
      INSERT INTO conversation_participants (conversation_id, user_id, role)
      VALUES (${conversation.id}, ${memberId}, 'member')
      ON CONFLICT (conversation_id, user_id) DO NOTHING
    `;
  }

  return conversation;
}

/** Fetches a single conversation's active participants, hydrated with user info. */
export async function getConversationParticipants(
  conversationId: string
): Promise<ConversationParticipantWithUser[]> {
  const rows = await sql`
    SELECT cp.*, u.id AS u_id, u.username, u.email, u.display_name, u.avatar_url,
           u.status, u.last_seen, u.created_at AS u_created_at, u.updated_at AS u_updated_at,
           u.is_active
    FROM conversation_participants cp
    JOIN users u ON u.id = cp.user_id
    WHERE cp.conversation_id = ${conversationId}
    ORDER BY cp.joined_at ASC
  `;

  return rows.rows.map((row) => ({
    id: row.id,
    conversationId: row.conversation_id,
    userId: row.user_id,
    role: row.role,
    joinedAt: row.joined_at,
    leftAt: row.left_at,
    lastReadMessageId: row.last_read_message_id,
    isMuted: row.is_muted,
    user: {
      id: row.u_id,
      username: row.username,
      email: row.email,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      status: row.status,
      lastSeen: row.last_seen,
      createdAt: row.u_created_at,
      updatedAt: row.u_updated_at,
      isActive: row.is_active,
    },
  }));
}

/** Searches users by username or display name, excluding the requesting user, for starting new conversations. */
export async function searchUsers(query: string, excludeUserId: string, limit = 10): Promise<User[]> {
  const rows = await sql`
    SELECT * FROM users
    WHERE is_active = true
      AND id != ${excludeUserId}
      AND (username ILIKE ${'%' + query + '%'} OR display_name ILIKE ${'%' + query + '%'})
    ORDER BY username ASC
    LIMIT ${limit}
  `;
  return rows.rows.map(rowToUser);
}

/** Changes a participant's role. Only an owner/admin may call this (enforced by the route). Owners can't be demoted here — transfer ownership is a separate, deliberately unbuilt flow. */
export async function updateParticipantRole(
  conversationId: string,
  targetUserId: string,
  newRole: 'admin' | 'member'
): Promise<void> {
  const target = await sql`
    SELECT role FROM conversation_participants
    WHERE conversation_id = ${conversationId} AND user_id = ${targetUserId} AND left_at IS NULL
  `;
  if (!target.rows[0]) {
    throw new Error('Participant not found');
  }
  if (target.rows[0].role === 'owner') {
    throw new Error("Cannot change the owner's role");
  }

  await sql`
    UPDATE conversation_participants
    SET role = ${newRole}
    WHERE conversation_id = ${conversationId} AND user_id = ${targetUserId}
  `;
}

/** Removes a participant from a group (soft — sets left_at, matching the schema's membership-history design). */
export async function removeParticipant(conversationId: string, targetUserId: string): Promise<void> {
  const target = await sql`
    SELECT role FROM conversation_participants
    WHERE conversation_id = ${conversationId} AND user_id = ${targetUserId} AND left_at IS NULL
  `;
  if (!target.rows[0]) {
    throw new Error('Participant not found');
  }
  if (target.rows[0].role === 'owner') {
    throw new Error('Cannot remove the owner');
  }

  await sql`
    UPDATE conversation_participants
    SET left_at = NOW()
    WHERE conversation_id = ${conversationId} AND user_id = ${targetUserId}
  `;
}
