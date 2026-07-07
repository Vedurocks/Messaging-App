// lib/db.ts
//
// Talks to @neondatabase/serverless directly rather than through
// @vercel/postgres. That wrapper's default `sql` export only ever reads
// POSTGRES_URL, and both its createPool()/createClient() factories reject
// any connection string whose hostname doesn't contain "-pooler." (its only
// heuristic for pooled-vs-direct) — even when a connection string is passed
// explicitly. Depending on which Vercel/Neon Postgres integration variant is
// installed, neither POSTGRES_URL nor DATABASE_URL may satisfy that check,
// which is what caused repeated 'invalid_connection_string' failures here.
// The underlying neon() function has no such restriction — it works with
// whatever valid Postgres connection string it's given.
//
// Pool/client creation is deferred to first actual use rather than
// validated at module load, since Next.js's build step imports route
// modules to statically collect metadata without runtime env vars present;
// throwing eagerly here would fail the build itself, not just runtime
// requests.
import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

let client: NeonQueryFunction<false, true> | undefined;

function getClient(): NeonQueryFunction<false, true> {
  if (!client) {
    // This project's Neon integration is named "NeonDB" (database:
    // neon-coral-book), and Vercel prefixes every var from a named
    // integration to avoid collisions when multiple storage integrations
    // are connected to the same project. Check the prefixed names first,
    // then fall back to the unprefixed convention for portability.
    const connectionString =
      process.env.NeonDB_DATABASE_URL ||
      process.env.NeonDB_POSTGRES_URL ||
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL;

    if (!connectionString) {
      throw new Error(
        'No database connection string found. Checked NeonDB_DATABASE_URL, NeonDB_POSTGRES_URL, DATABASE_URL, POSTGRES_URL.'
      );
    }
    // fullResults: true gives back { rows, rowCount, fields } (like `pg`),
    // matching the shape the rest of this codebase already expects.
    client = neon(connectionString, { fullResults: true });
  }
  return client;
}

// Works both as a tagged template (sql`SELECT ...`) and as an ordinary call
// (query('SELECT ... $1', [param])) — neon()'s returned function supports
// both forms natively, so `sql` and `query` are the same underlying call.
export const sql = ((...args: Parameters<NeonQueryFunction<false, true>>) =>
  getClient()(...args)) as NeonQueryFunction<false, true>;
export const query = sql;
