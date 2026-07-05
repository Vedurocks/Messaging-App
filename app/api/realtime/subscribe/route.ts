import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { sseManager } from '@/lib/realtime';

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

    sseManager.subscribeToConversation(clientId, conversationId);

    // Send conversation history snapshot
    return NextResponse.json({ success: true, subscribed: conversationId });
  } catch (error) {
    return NextResponse.json({ error: 'Subscription failed' }, { status: 500 });
  }
}

// ============================================================
