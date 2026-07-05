// lib/session.ts — Core session logic (server-only)
//
// FIX vs. source material: the original hashed a random `accessToken`
// string for `token_hash`, but returned/issued a *different* value (a
// signed JWT) as the actual access token stored in the cookie. Every
// verifySession() call hashed the JWT and compared it against a hash of
// a token that was never issued anywhere — the DB check would never
// match, silently defeating session revocation. Fixed by hashing the
// actual issued JWT.
import 'server-only';
import { SignJWT, jwtVerify } from 'jose';
import { createHash, randomBytes } from 'crypto';
import { sql } from '@vercel/postgres';

const SESSION_SECRET = new TextEncoder().encode(process.env.SESSION_SECRET!);

export interface SessionPayload {
  userId: string;
  sessionId: string;
  iat: number;
  exp: number;
}

export interface DeviceInfo {
  browser: string;
  os: string;
  device: string;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// Dual-token architecture: short-lived signed access token (JWT) +
// long-lived opaque refresh token. Both are hashed before storage so a
// database read alone can't be replayed as a live session.
export async function createSession(
  userId: string,
  deviceInfo: DeviceInfo,
  ipAddress: string
): Promise<{ accessToken: string; refreshToken: string; sessionId: string }> {
  const sessionId = crypto.randomUUID();
  const refreshToken = randomBytes(48).toString('hex');

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 min
  const refreshExpiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const accessToken = await new SignJWT({ userId, sessionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(SESSION_SECRET);

  const tokenHash = hashToken(accessToken);
  const refreshTokenHash = hashToken(refreshToken);

  await sql`
    INSERT INTO sessions (
      id, user_id, token_hash, refresh_token_hash,
      device_info, ip_address, expires_at, refresh_expires_at
    ) VALUES (
      ${sessionId}, ${userId}, ${tokenHash}, ${refreshTokenHash},
      ${JSON.stringify(deviceInfo)}, ${ipAddress}, ${expiresAt}, ${refreshExpiresAt}
    )
  `;

  return { accessToken, refreshToken, sessionId };
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, SESSION_SECRET, {
      clockTolerance: 60,
    });

    // Stateful double-check: JWT signature alone isn't enough, since a
    // revoked session's JWT would still verify cryptographically until
    // it expires. The DB row is the actual source of truth.
    const tokenHash = hashToken(token);
    const result = await sql`
      SELECT id, user_id, expires_at, is_revoked
      FROM sessions
      WHERE token_hash = ${tokenHash} AND is_revoked = false
    `;

    if (result.rows.length === 0) return null;

    const session = result.rows[0];
    if (new Date(session.expires_at) < new Date()) return null;

    await sql`UPDATE sessions SET last_active_at = NOW() WHERE id = ${session.id}`;

    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function refreshSession(
  refreshToken: string
): Promise<{ accessToken: string; refreshToken: string } | null> {
  const refreshHash = hashToken(refreshToken);

  const result = await sql`
    SELECT id, user_id, refresh_expires_at, is_revoked, device_info, ip_address
    FROM sessions
    WHERE refresh_token_hash = ${refreshHash} AND is_revoked = false
  `;

  if (result.rows.length === 0) return null;

  const session = result.rows[0];
  if (new Date(session.refresh_expires_at) < new Date()) {
    await revokeSession(session.id);
    return null;
  }

  // Rotate on every use so a stolen refresh token has a one-shot window.
  await revokeSession(session.id);

  const newTokens = await createSession(
    session.user_id,
    session.device_info as DeviceInfo,
    session.ip_address
  );

  return { accessToken: newTokens.accessToken, refreshToken: newTokens.refreshToken };
}

export async function revokeSession(sessionId: string): Promise<void> {
  await sql`UPDATE sessions SET is_revoked = true WHERE id = ${sessionId}`;
}

export async function revokeAllUserSessions(userId: string, exceptSessionId?: string): Promise<void> {
  if (exceptSessionId) {
    await sql`
      UPDATE sessions SET is_revoked = true
      WHERE user_id = ${userId} AND id != ${exceptSessionId}
    `;
  } else {
    await sql`UPDATE sessions SET is_revoked = true WHERE user_id = ${userId}`;
  }
}

export async function getUserSessions(userId: string) {
  const result = await sql`
    SELECT id, device_info, ip_address, created_at, last_active_at, is_revoked
    FROM sessions
    WHERE user_id = ${userId} AND is_revoked = false
    ORDER BY last_active_at DESC
  `;
  return result.rows;
}
