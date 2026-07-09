'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User, UserStatus } from '@/lib/types';
import { UserAvatar } from '@/components/UserAvatar';
import { formatRelativeTime } from '@/lib/format';

interface SessionRow {
  id: string;
  device_info: { browser: string; os: string; device: string } | null;
  ip_address: string | null;
  created_at: string;
  last_active_at: string;
}

const STATUS_OPTIONS: { value: UserStatus; label: string }[] = [
  { value: 'online', label: 'Online' },
  { value: 'away', label: 'Away' },
  { value: 'dnd', label: 'Do not disturb' },
  { value: 'offline', label: 'Appear offline' },
];

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [status, setStatus] = useState<UserStatus>('online');
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [meRes, sessionsRes] = await Promise.all([fetch('/api/auth/me'), fetch('/api/auth/sessions')]);
      if (meRes.status === 401) {
        router.push('/login');
        return;
      }
      const me = await meRes.json();
      const sess = await sessionsRes.json();
      setUser(me.user);
      setDisplayName(me.user.displayName || '');
      setAvatarUrl(me.user.avatarUrl || '');
      setStatus(me.user.status);
      setSessions(sess.sessions || []);
    })();
  }, [router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSaveMessage(null);
    try {
      const res = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, avatarUrl, status }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to save');
        return;
      }
      setUser(data.user);
      setSaveMessage('Saved.');
      setTimeout(() => setSaveMessage(null), 2000);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRevokeSession(sessionId: string) {
    const res = await fetch('/api/auth/sessions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
    if (res.ok) {
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    router.push('/login');
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-content-secondary">Loading…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-lg">
        <div className="mb-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="text-sm text-content-secondary hover:text-content-primary"
          >
            ← Back to chats
          </button>
          <button type="button" onClick={handleLogout} className="text-sm text-danger hover:underline">
            Log out
          </button>
        </div>

        <h1 className="mb-6 text-xl font-semibold text-content-primary">Settings</h1>

        <section className="mb-8 rounded-2xl border border-border bg-background-elevated p-6">
          <h2 className="mb-4 text-sm font-semibold text-content-primary">Profile</h2>

          <div className="mb-4 flex items-center gap-3">
            <UserAvatar user={{ ...user, displayName, avatarUrl, status }} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-sm text-content-primary">@{user.username}</p>
              <p className="truncate text-xs text-content-secondary">{user.email}</p>
            </div>
          </div>

          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="displayName" className="text-xs font-medium text-content-secondary">
                Display name
              </label>
              <input
                id="displayName"
                type="text"
                maxLength={64}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="rounded-lg border border-border-strong bg-background-surface px-3 py-2 text-sm text-content-primary outline-none focus:border-primary"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="avatarUrl" className="text-xs font-medium text-content-secondary">
                Avatar URL
              </label>
              <input
                id="avatarUrl"
                type="url"
                placeholder="https://…"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                className="rounded-lg border border-border-strong bg-background-surface px-3 py-2 text-sm text-content-primary outline-none focus:border-primary"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="status" className="text-xs font-medium text-content-secondary">
                Status
              </label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as UserStatus)}
                className="rounded-lg border border-border-strong bg-background-surface px-3 py-2 text-sm text-content-primary outline-none focus:border-primary"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}
            {saveMessage && <p className="text-sm text-secondary">{saveMessage}</p>}

            <button
              type="submit"
              disabled={isSaving}
              className="self-start rounded-xl bg-primary px-4 py-2 text-sm font-medium text-background transition hover:bg-primary-hover disabled:opacity-50"
            >
              {isSaving ? 'Saving…' : 'Save changes'}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-border bg-background-elevated p-6">
          <h2 className="mb-4 text-sm font-semibold text-content-primary">Active sessions</h2>
          <div className="flex flex-col gap-2">
            {sessions.length === 0 && <p className="text-xs text-content-secondary">No other active sessions.</p>}
            {sessions.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs text-content-primary">
                    {s.device_info?.browser || 'Unknown browser'} · {s.device_info?.os || 'Unknown OS'}
                  </p>
                  <p className="truncate text-xs text-content-secondary">
                    Last active {formatRelativeTime(s.last_active_at)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRevokeSession(s.id)}
                  className="shrink-0 text-xs text-danger hover:underline"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
