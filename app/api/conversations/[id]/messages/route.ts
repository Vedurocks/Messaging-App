import { NextRequest, NextResponse } from 'next/server';
import { fetchConversationMessages, sendMessage, markMessagesAsRead } from '@/lib/conversation';
import { verifySession } from '@/lib/session';

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

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50');
    const expandThreads = searchParams.get('expandThreads') !== 'false';
    const threadDepth = parseInt(searchParams.get('threadDepth') || '2');

    const result = await fetchConversationMessages(params.id, {
      cursor,
      limit,
      expandThreads,
      threadDepth,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Fetch messages error:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

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

    const body = await request.json();
    const { content, parentMessageId, contentType, attachments, encryptedContent } = body;

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const message = await sendMessage(params.id, payload.userId, content, {
      parentMessageId,
      contentType,
      attachments,
      encryptedContent,
    });

    return NextResponse.json({ success: true, message });
  } catch (error) {
    console.error('Send message error:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}

// ============================================================
