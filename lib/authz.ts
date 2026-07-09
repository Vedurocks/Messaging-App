// lib/authz.ts — Authorization checks (server-only)
//
// GAP vs. source material: none of the provided API routes verified that
// the requesting user was actually a participant in the conversation
// before reading or writing its messages — any authenticated user could
// read or post into any conversation ID. This is the "missing DAL /
// authorization" risk called out in the security research notes.
// Every conversation-scoped route should call assertParticipant() first.
import 'server-only';
import { sql } from '@/lib/db';

export class ForbiddenError extends Error {
  constructor(message = 'You are not a participant in this conversation') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export async function isConversationParticipant(
  conversationId: string,
  userId: string
): Promise<boolean> {
  const result = await sql`
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = ${conversationId}
      AND user_id = ${userId}
      AND left_at IS NULL
    LIMIT 1
  `;
  return result.rows.length > 0;
}

// Throws ForbiddenError rather than returning a boolean, so route
// handlers can call it as a guard clause without repeating the check.
export async function assertParticipant(conversationId: string, userId: string): Promise<void> {
  const ok = await isConversationParticipant(conversationId, userId);
  if (!ok) throw new ForbiddenError();
}
