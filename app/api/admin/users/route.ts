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

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim() || '';
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1);
    const pageSize = 25;
    const offset = (page - 1) * pageSize;

    const rows = q
      ? await sql`
          SELECT id, username, email, display_name, status, is_active, is_admin, created_at, last_seen
          FROM users
          WHERE username ILIKE ${'%' + q + '%'} OR email ILIKE ${'%' + q + '%'}
          ORDER BY created_at DESC
          LIMIT ${pageSize} OFFSET ${offset}
        `
      : await sql`
          SELECT id, username, email, display_name, status, is_active, is_admin, created_at, last_seen
          FROM users
          ORDER BY created_at DESC
          LIMIT ${pageSize} OFFSET ${offset}
        `;

    const countRow = q
      ? await sql`SELECT COUNT(*)::int AS count FROM users WHERE username ILIKE ${'%' + q + '%'} OR email ILIKE ${'%' + q + '%'}`
      : await sql`SELECT COUNT(*)::int AS count FROM users`;

    return NextResponse.json({
      users: rows.rows.map((r) => ({
        id: r.id,
        username: r.username,
        email: r.email,
        displayName: r.display_name,
        status: r.status,
        isActive: r.is_active,
        isAdmin: r.is_admin,
        createdAt: r.created_at,
        lastSeen: r.last_seen,
      })),
      totalCount: countRow.rows[0].count,
      page,
      pageSize,
    });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Admin users list error:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}
