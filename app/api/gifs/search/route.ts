import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('session_token')?.value;
    const payload = await verifySession(token || '');
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiKey = process.env.GIPHY_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GIF search is not configured. Set GIPHY_API_KEY in your environment.' },
        { status: 501 }
      );
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

    const endpoint = q && q.trim()
      ? `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(q.trim())}&limit=${limit}&rating=pg-13`
      : `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=${limit}&rating=pg-13`;

    const res = await fetch(endpoint);
    if (!res.ok) {
      return NextResponse.json({ error: 'GIF search failed' }, { status: 502 });
    }
    const data = await res.json();

    const gifs = (data.data || []).map((gif: any) => ({
      id: gif.id,
      title: gif.title,
      previewUrl: gif.images?.fixed_height_small?.url || gif.images?.fixed_height?.url,
      url: gif.images?.original?.url,
    }));

    return NextResponse.json({ gifs });
  } catch (error) {
    console.error('GIF search error:', error);
    return NextResponse.json({ error: 'GIF search failed' }, { status: 500 });
  }
}
