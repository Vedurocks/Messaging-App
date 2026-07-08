import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { searchUsers } from '@/lib/conversations';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('session_token')?.value;
    const payload = await verifySession(token || '');
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    if (!q || q.trim().length < 1) {
      return NextResponse.json({ users: [] });
    }

    const users = await searchUsers(q.trim(), payload.userId);
    return NextResponse.json({ users });
  } catch (error) {
    console.error('User search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
