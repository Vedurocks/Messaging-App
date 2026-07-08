import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { sql } from '@/lib/db';
import { assertParticipant, ForbiddenError } from '@/lib/authz';
import { updateParticipantRole, removeParticipant } from '@/lib/conversations';

async function requireManagerRole(conversationId: string, userId: string) {
  await assertParticipant(conversationId, userId);
  const result = await sql`
    SELECT role FROM conversation_participants
    WHERE conversation_id = ${conversationId} AND user_id = ${userId} AND left_at IS NULL
  `;
  const role = result.rows[0]?.role;
  if (role !== 'owner' && role !== 'admin') {
    throw new ForbiddenError('Only group owners/admins can manage members');
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; userId: string } }
) {
  try {
    const token = request.cookies.get('session_token')?.value;
    const payload = await verifySession(token || '');
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await requireManagerRole(params.id, payload.userId);

    const { role } = await request.json();
    if (role !== 'admin' && role !== 'member') {
      return NextResponse.json({ error: "role must be 'admin' or 'member'" }, { status: 400 });
    }

    await updateParticipantRole(params.id, params.userId, role);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : 'Failed to update role';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; userId: string } }
) {
  try {
    const token = request.cookies.get('session_token')?.value;
    const payload = await verifySession(token || '');
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // A participant may always remove themselves (leave); removing someone
    // else requires owner/admin.
    if (params.userId !== payload.userId) {
      await requireManagerRole(params.id, payload.userId);
    } else {
      await assertParticipant(params.id, payload.userId);
    }

    await removeParticipant(params.id, params.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : 'Failed to remove participant';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
