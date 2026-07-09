import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { getConversationParticipants } from '@/lib/conversations';
import { assertParticipant, ForbiddenError } from '@/lib/authz';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.cookies.get('session_token')?.value;
    const payload = await verifySession(token || '');
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await assertParticipant(params.id, payload.userId);
    const participants = await getConversationParticipants(params.id);
    return NextResponse.json({ participants });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Get participants error:', error);
    return NextResponse.json({ error: 'Failed to fetch participants' }, { status: 500 });
  }
}
