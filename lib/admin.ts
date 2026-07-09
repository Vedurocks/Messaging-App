// lib/admin.ts
import 'server-only';
import { sql } from '@/lib/db';
import { ForbiddenError } from './authz';

export async function isAdmin(userId: string): Promise<boolean> {
  const result = await sql`SELECT is_admin FROM users WHERE id = ${userId}`;
  return result.rows[0]?.is_admin === true;
}

export async function assertAdmin(userId: string): Promise<void> {
  if (!(await isAdmin(userId))) {
    throw new ForbiddenError('Admin access required');
  }
}
