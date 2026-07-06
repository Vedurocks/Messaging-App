import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { sseManager } from '@/lib/realtime';
import { assertParticipant, ForbiddenError } from '@/lib/authz';

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('session_token')?.value;
    const payload = await verifySession(token || '');

    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { clientId, conversationId } = await request.json();

    if (!clientId || !conversationId) {
      return NextResponse.json({ error: 'clientId and conversationId required' }, { status: 400 });
    }

    // GAP FIX: this route talked to sseManager directly and never checked
    // conversation membership — any authenticated user could subscribe to
    // any conversationId's live event stream. Same class of bug already
    // fixed in lib/conversation.ts, but this route bypassed it entirely.
    await assertParticipant(conversationId, payload.userId);

    sseManager.subscribeToConversation(clientId, conversationId);

    return NextResponse.json({ success: true, subscribed: conversationId });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Subscription failed' }, { status: 500 });
  }
}
