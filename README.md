# Secure Comms

Minimalist dark-mode messaging platform. Next.js (App Router) + PostgreSQL (Vercel, raw SQL via `@vercel/postgres`) + Tailwind CSS.

## Stack
- **Framework**: Next.js 14 (App Router)
- **Database**: PostgreSQL via `@vercel/postgres` — `db/schema.sql` is the source of truth
- **Styling**: Tailwind CSS, dark theme only (`#121212` base)
- **Auth**: bcrypt password hashing, dual-token sessions (short-lived JWT access token + rotating opaque refresh token), both hashed before storage
- **Realtime**: Server-Sent Events (see caveat below)

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in Postgres + session secrets
npm run db:migrate           # applies db/schema.sql
npm run dev
```

## Project structure

```
app/
  api/
    auth/{login,logout,refresh,sessions}/route.ts
    conversations/[id]/messages/{,/read,/search}/route.ts
    realtime/{connect,subscribe,unsubscribe}/route.ts
  layout.tsx, globals.css, page.tsx
components/
  UserAvatar.tsx            # avatar + online/away/dnd/offline status dot
  MessageBubble.tsx           # per-content-type rendering, edited badge, read receipts
  ThreadView.tsx                # parent message + nested replies
  ConversationListItem.tsx        # sidebar row, last-message preview, unread badge
  GroupSettingsPanel.tsx            # role management, active + former members
lib/
  session.ts        # session issuance/verification/refresh/revocation
  authz.ts            # conversation-membership authorization guard
  conversation.ts       # message fetch/send/search, thread expansion, read receipts
  realtime.ts              # SSE connection manager
  events.ts                  # broadcast helpers (message/typing/read/presence)
  auth/password.ts             # bcrypt hash/verify
  types.ts                       # UI-facing types, mirrors db/schema.sql
  format.ts                        # relative-time formatting
middleware.ts    # route protection + auto-refresh
db/schema.sql      # source of truth for the database
```

## Design tokens

| Token | Value | Usage |
|---|---|---|
| Background | `#121212` | App base |
| Primary | `#BB86FC` | Primary actions, active states |
| Secondary | `#03DAC6` | Accents, links |
| Status: online/away/dnd/offline | `#22C55E` / `#EAB308` / `#EF4444` / `#9CA3AF` | Presence dot |

Full token set lives in `tailwind.config.ts`.

## Schema overview (`db/schema.sql`)

- `users` — `status`: online/offline/away/dnd, `last_seen`, `public_key` reserved for future E2EE
- `sessions` — hashed access + refresh tokens, device info, revocation
- `conversations` — `type`: direct/group, `title`/`description` for groups, `is_encrypted` flag
- `conversation_participants` — `role`: owner/admin/member, `joined_at`/`left_at`, `is_muted`
- `messages` — threaded via `parent_message_id`, `content_type`: text/image/file/system, `reactions`/`attachments`/`edit_history` as JSONB, soft-delete via `is_deleted`
- `message_read_receipts` — per-recipient read tracking (correct for both DMs and groups, unlike a single timestamp column)

## Fixes made while integrating the adopted schema/API design

- **SQL injection risk removed**: an unused `WHERE` clause built via raw string interpolation was deleted from `lib/conversation.ts`. It was dead code (the real query was already parameterized), but left in place it was a copy-paste trap.
- **Missing authorization**: none of the original routes verified the requester was actually a participant in a conversation before reading/writing its messages. Added `lib/authz.ts` (`assertParticipant`), now called from every conversation-scoped function in `lib/conversation.ts`.
- **Session verification bug**: the original hashed a random token for storage but issued a *different* token (the JWT) to the client — so `verifySession` could never find a matching row, silently breaking session revocation. Fixed by hashing the actual issued JWT.
- **Ambiguous column alias**: the message query aliased `u.id AS sender_id`, shadowing `m.sender_id`. Removed the duplicate.
- **`edit_history`/`isEdited` wasn't wired up**: the schema tracks edit history but the fetch query never selected it, so the "(edited)" badge had no data. Added the column to the query and an `isEdited` derived field.

## Known caveats

- **SSE + serverless**: `lib/realtime.ts` holds connections in an in-memory `Map`. This only works if connect/broadcast requests land on the same long-lived process — not guaranteed on Vercel's default serverless functions. Fine for local dev or a single persistent Node server; needs a shared broker (e.g. Redis pub/sub) before scaling horizontally.
- **Row Level Security**: policies are drafted as comments at the bottom of `db/schema.sql` but not enabled — enabling them requires wiring a `SET LOCAL app.current_user_id` on every connection, which isn't done yet. Left commented out rather than half-enabled.
- **No E2EE yet**: `users.public_key` and `messages.encrypted_content` are reserved schema slots; no client-side crypto is implemented.

## Next steps

Auth UI (login/register pages), wiring components to the API routes with real data fetching, typing indicators, and the RLS/E2EE items above.
