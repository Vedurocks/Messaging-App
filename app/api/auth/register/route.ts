// app/api/auth/register/route.ts
//
// GAP FIX: middleware.ts already listed '/api/auth/register' as a public
// path, but no such route existed — login was a dead end with no way to
// ever create an account. Mirrors login/route.ts's session-issuing flow.
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { UAParser } from 'ua-parser-js';
import { hashPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/session';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,32}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    const { username, email, password, displayName } = await request.json();

    if (!username || !email || !password) {
      return NextResponse.json({ error: 'Username, email, and password are required' }, { status: 400 });
    }
    if (!USERNAME_RE.test(username)) {
      return NextResponse.json(
        { error: 'Username must be 3-32 characters (letters, numbers, underscore)' },
        { status: 400 }
      );
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const existing = await sql`
      SELECT id FROM users WHERE email = ${email} OR username = ${username} LIMIT 1
    `;
    if (existing.rows.length > 0) {
      // Deliberately generic — doesn't reveal whether it was the email or
      // username that collided, to avoid leaking account existence.
      return NextResponse.json({ error: 'An account with these details already exists' }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);

    const inserted = await sql`
      INSERT INTO users (username, email, password_hash, display_name)
      VALUES (${username}, ${email}, ${passwordHash}, ${displayName || username})
      RETURNING id
    `;
    const userId = inserted.rows[0].id;

    const ua = request.headers.get('user-agent') || '';
    const parser = new UAParser(ua);
    const deviceInfo = {
      browser: parser.getBrowser().name || 'Unknown',
      os: parser.getOS().name || 'Unknown',
      device: parser.getDevice().type || 'desktop',
    };
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

    const { accessToken, refreshToken } = await createSession(userId, deviceInfo, ip);

    const response = NextResponse.json({ success: true, user: { id: userId } }, { status: 201 });

    response.cookies.set('session_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60,
      path: '/',
    });

    response.cookies.set('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60,
      path: '/api/auth/refresh',
    });

    return response;
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
