import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { sql } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('session_token')?.value;
    const payload = await verifySession(token || '');
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { endpoint } = await request.json();
    if (!endpoint) {
      return NextResponse.json({ error: 'endpoint is required' }, { status: 400 });
    }

    await sql`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint} AND user_id = ${payload.userId}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Push unsubscribe error:', error);
    return NextResponse.json({ error: 'Failed to remove subscription' }, { status: 500 });
  }
}
