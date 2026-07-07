// lib/db.ts
//
// @vercel/postgres's default `sql` export only ever reads
// process.env.POSTGRES_URL, and throws if that string's hostname doesn't
// contain "-pooler." (its sole pooled-vs-direct heuristic). Depending on
// which Vercel/Neon Postgres integration variant is installed, POSTGRES_URL
// may not be set at all, or may point at a direct (non-pooled) connection
// string, while DATABASE_URL — the modern var Neon's integrations set — is
// documented to always be the pooled one. We prefer DATABASE_URL, and fall
// back to POSTGRES_URL for older/manually-configured setups.
//
// Pool creation is deferred to first actual use (mirroring how the
// library's own ambient `sql` export lazily creates its pool via a Proxy)
// rather than validated at module load. Next.js's build step imports route
// modules to statically collect metadata without runtime env vars present,
// so throwing eagerly here would fail the build itself, not just runtime
// requests.
import { createPool, type VercelPool } from '@vercel/postgres';

let pool: VercelPool | undefined;

function getPool(): VercelPool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!connectionString) {
      throw new Error(
        'No database connection string found. Set DATABASE_URL (preferred) or POSTGRES_URL in your environment.'
      );
    }
    pool = createPool({ connectionString });
  }
  return pool;
}

export const sql: VercelPool['sql'] = (...args) => getPool().sql(...args);
export const query: VercelPool['query'] = (...args: any[]) => (getPool().query as any)(...args);
