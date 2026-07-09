import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { assertAdmin } from '@/lib/admin';
import { ForbiddenError } from '@/lib/authz';
import { sql } from '@/lib/db';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.cookies.get('session_token')?.value;
    const payload = await verifySession(token || '');
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await assertAdmin(payload.userId);

    if (params.id === payload.userId) {
      return NextResponse.json({ error: "You can't modify your own admin/active status" }, { status: 400 });
    }

    const { isActive, isAdmin: makeAdmin } = await request.json();

    if (isActive === undefined && makeAdmin === undefined) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const result = await sql`
      UPDATE users
      SET
        is_active = COALESCE(${isActive ?? null}, is_active),
        is_admin = COALESCE(${makeAdmin ?? null}, is_admin),
        updated_at = NOW()
      WHERE id = ${params.id}
      RETURNING id, username, is_active, is_admin
    `;

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        id: result.rows[0].id,
        username: result.rows[0].username,
        isActive: result.rows[0].is_active,
        isAdmin: result.rows[0].is_admin,
      },
    });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Admin update user error:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}
