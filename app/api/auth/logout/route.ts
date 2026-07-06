import { NextRequest, NextResponse } from 'next/server';
import { verifySession, revokeSession } from '@/lib/session';

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('session_token')?.value;

    if (token) {
      const payload = await verifySession(token);
      if (payload) {
        await revokeSession(payload.sessionId);
      }
    }

    const response = NextResponse.json({ success: true });
    response.cookies.delete('session_token');
    response.cookies.delete('refresh_token');

    return response;
  } catch (error) {
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 });
  }
}

