import { NextRequest, NextResponse } from 'next/server';
import { searchMessages } from '@/lib/conversation';
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
    const query = searchParams.get('q');

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ error: 'Query must be at least 2 characters' }, { status: 400 });
    }

    const limit = parseInt(searchParams.get('limit') || '20');
    const results = await searchMessages(params.id, query, { limit });

    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
