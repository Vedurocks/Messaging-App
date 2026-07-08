import { NextRequest, NextResponse } from 'next/server';
import { refreshSession } from '@/lib/session';

export async function POST(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get('refresh_token')?.value;

    if (!refreshToken) {
      return NextResponse.json({ error: 'No refresh token' }, { status: 401 });
    }

    const result = await refreshSession(refreshToken);

    if (!result) {
      const response = NextResponse.json({ error: 'Invalid refresh token' }, { status: 401 });
      response.cookies.delete('refresh_token');
      return response;
    }

    const response = NextResponse.json({ success: true });

    response.cookies.set('session_token', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60,
      path: '/',
    });

    response.cookies.set('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60,
      path: '/api/auth/refresh',
    });

    return response;
  } catch (error) {
    return NextResponse.json({ error: 'Refresh failed' }, { status: 500 });
  }
}

