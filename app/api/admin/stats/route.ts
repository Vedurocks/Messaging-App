import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { assertAdmin } from '@/lib/admin';
import { ForbiddenError } from '@/lib/authz';
import { sql } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('session_token')?.value;
    const payload = await verifySession(token || '');
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await assertAdmin(payload.userId);

    const [users, activeUsers, conversations, messages, sessions] = await Promise.all([
      sql`SELECT COUNT(*)::int AS count FROM users`,
      sql`SELECT COUNT(*)::int AS count FROM users WHERE is_active = true`,
      sql`SELECT COUNT(*)::int AS count FROM conversations`,
      sql`SELECT COUNT(*)::int AS count FROM messages WHERE is_deleted = false`,
      sql`SELECT COUNT(*)::int AS count FROM sessions WHERE is_revoked = false AND expires_at > NOW()`,
    ]);

    const messagesLast24h = await sql`
      SELECT COUNT(*)::int AS count FROM messages
      WHERE created_at > NOW() - INTERVAL '24 hours' AND is_deleted = false
    `;

    return NextResponse.json({
      totalUsers: users.rows[0].count,
      activeUsers: activeUsers.rows[0].count,
      totalConversations: conversations.rows[0].count,
      totalMessages: messages.rows[0].count,
      messagesLast24h: messagesLast24h.rows[0].count,
      activeSessions: sessions.rows[0].count,
    });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Admin stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
