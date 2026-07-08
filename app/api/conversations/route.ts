import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { listUserConversations, createDirectConversation, createGroupConversation } from '@/lib/conversations';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('session_token')?.value;
    const payload = await verifySession(token || '');
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const conversations = await listUserConversations(payload.userId);
    return NextResponse.json({ conversations });
  } catch (error) {
    console.error('List conversations error:', error);
    return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('session_token')?.value;
    const payload = await verifySession(token || '');
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { type, userId, title, memberIds } = body as {
      type: 'direct' | 'group';
      userId?: string;
      title?: string;
      memberIds?: string[];
    };

    if (type === 'direct') {
      if (!userId) {
        return NextResponse.json({ error: 'userId is required for direct conversations' }, { status: 400 });
      }
      const conversation = await createDirectConversation(payload.userId, userId);
      return NextResponse.json({ conversation }, { status: 201 });
    }

    if (type === 'group') {
      if (!title || !Array.isArray(memberIds)) {
        return NextResponse.json({ error: 'title and memberIds are required for group conversations' }, { status: 400 });
      }
      const conversation = await createGroupConversation(payload.userId, title, memberIds);
      return NextResponse.json({ conversation }, { status: 201 });
    }

    return NextResponse.json({ error: "type must be 'direct' or 'group'" }, { status: 400 });
  } catch (error) {
    console.error('Create conversation error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create conversation';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
