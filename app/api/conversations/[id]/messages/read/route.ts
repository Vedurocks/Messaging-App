import { NextRequest, NextResponse } from 'next/server';
import { markMessagesAsRead } from '@/lib/conversation';
import { verifySession } from '@/lib/session';
import { ForbiddenError } from '@/lib/authz';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.cookies.get('session_token')?.value;
    const payload = await verifySession(token || '');

    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { messageIds } = await request.json();

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return NextResponse.json({ error: 'messageIds array required' }, { status: 400 });
    }

    await markMessagesAsRead(params.id, messageIds, payload.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to mark as read' }, { status: 500 });
  }
}
