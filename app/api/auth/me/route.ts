import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { sql } from '@/lib/db';

function rowToUser(row: Record<string, any>) {
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
    isAdmin: row.is_admin,
  };
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('session_token')?.value;
    const payload = await verifySession(token || '');
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await sql`
      SELECT id, username, email, display_name, avatar_url, status, last_seen, created_at, updated_at, is_active, is_admin
      FROM users WHERE id = ${payload.userId}
    `;
    const row = result.rows[0];
    if (!row) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user: rowToUser(row) });
  } catch (error) {
    console.error('Get current user error:', error);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}

const VALID_STATUSES = ['online', 'offline', 'away', 'dnd'];

export async function PATCH(request: NextRequest) {
  try {
    const token = request.cookies.get('session_token')?.value;
    const payload = await verifySession(token || '');
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { displayName, avatarUrl, status } = body as {
      displayName?: string;
      avatarUrl?: string;
      status?: string;
    };

    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: `status must be one of ${VALID_STATUSES.join(', ')}` }, { status: 400 });
    }
    if (displayName !== undefined && displayName.length > 64) {
      return NextResponse.json({ error: 'displayName must be 64 characters or fewer' }, { status: 400 });
    }

    const result = await sql`
      UPDATE users
      SET
        display_name = COALESCE(${displayName ?? null}, display_name),
        avatar_url = COALESCE(${avatarUrl ?? null}, avatar_url),
        status = COALESCE(${status ?? null}, status),
        updated_at = NOW()
      WHERE id = ${payload.userId}
      RETURNING id, username, email, display_name, avatar_url, status, last_seen, created_at, updated_at, is_active, is_admin
    `;

    return NextResponse.json({ user: rowToUser(result.rows[0]) });
  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
