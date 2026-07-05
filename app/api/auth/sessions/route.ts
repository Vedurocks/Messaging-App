import { NextRequest, NextResponse } from 'next/server';
import { verifySession, getUserSessions, revokeSession } from '@/lib/session';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('session_token')?.value;
    const payload = await verifySession(token || '');

    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sessions = await getUserSessions(payload.userId);
    return NextResponse.json({ sessions });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = request.cookies.get('session_token')?.value;
    const payload = await verifySession(token || '');

    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = await request.json();

    // Verify user owns this session
    const sessions = await getUserSessions(payload.userId);
    const ownsSession = sessions.some(s => s.id === sessionId);

    if (!ownsSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    await revokeSession(sessionId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to revoke session' }, { status: 500 });
  }
}

// ============================================================
