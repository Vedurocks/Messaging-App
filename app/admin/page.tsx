'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatRelativeTime } from '@/lib/format';

interface Stats {
  totalUsers: number;
  activeUsers: number;
  totalConversations: number;
  totalMessages: number;
  messagesLast24h: number;
  activeSessions: number;
}

interface AdminUserRow {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  status: string;
  isActive: boolean;
  isAdmin: boolean;
  createdAt: string;
  lastSeen: string | null;
}

const STAT_LABELS: { key: keyof Stats; label: string }[] = [
  { key: 'totalUsers', label: 'Total users' },
  { key: 'activeUsers', label: 'Active users' },
  { key: 'totalConversations', label: 'Conversations' },
  { key: 'totalMessages', label: 'Messages' },
  { key: 'messagesLast24h', label: 'Messages (24h)' },
  { key: 'activeSessions', label: 'Active sessions' },
];

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function loadUsers(p: number, q: string) {
    const res = await fetch(`/api/admin/users?page=${p}&q=${encodeURIComponent(q)}`);
    if (res.status === 403) {
      setError('Admin access required.');
      return;
    }
    const data = await res.json();
    setUsers(data.users || []);
    setTotalCount(data.totalCount || 0);
  }

  useEffect(() => {
    (async () => {
      const [statsRes] = await Promise.all([fetch('/api/admin/stats'), loadUsers(1, '')]);
      if (statsRes.status === 403) {
        setError('Admin access required.');
        setIsLoading(false);
        return;
      }
      if (statsRes.status === 401) {
        router.push('/login');
        return;
      }
      const s = await statsRes.json();
      setStats(s);
      setIsLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => loadUsers(1, query), 300);
    setPage(1);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    loadUsers(page, query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  async function toggleActive(user: AdminUserRow) {
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !user.isActive }),
    });
    if (res.ok) {
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, isActive: !u.isActive } : u)));
    }
  }

  async function toggleAdmin(user: AdminUserRow) {
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isAdmin: !user.isAdmin }),
    });
    if (res.ok) {
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, isAdmin: !u.isAdmin } : u)));
    }
  }

  const totalPages = Math.max(Math.ceil(totalCount / 25), 1);

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <p className="text-sm text-content-secondary">{error}</p>
        <button
          type="button"
          onClick={() => router.push('/')}
          className="text-sm text-secondary hover:underline"
        >
          Back to chats
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-content-primary">Admin dashboard</h1>
          <button
            type="button"
            onClick={() => router.push('/')}
            className="text-sm text-content-secondary hover:text-content-primary"
          >
            ← Back to chats
          </button>
        </div>

        {isLoading ? (
          <p className="text-sm text-content-secondary">Loading…</p>
        ) : (
          <>
            <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {stats &&
                STAT_LABELS.map(({ key, label }) => (
                  <div key={key} className="rounded-xl border border-border bg-background-elevated p-4">
                    <p className="text-xs text-content-secondary">{label}</p>
                    <p className="mt-1 text-2xl font-semibold text-content-primary">{stats[key]}</p>
                  </div>
                ))}
            </div>

            <div className="rounded-2xl border border-border bg-background-elevated">
              <div className="border-b border-border p-4">
                <input
                  type="text"
                  placeholder="Search users by username or email…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full rounded-lg border border-border-strong bg-background-surface px-3 py-2 text-sm text-content-primary outline-none focus:border-primary"
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-content-secondary">
                      <th className="px-4 py-2 font-medium">User</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                      <th className="px-4 py-2 font-medium">Joined</th>
                      <th className="px-4 py-2 font-medium">Active</th>
                      <th className="px-4 py-2 font-medium">Admin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-b border-border last:border-b-0">
                        <td className="px-4 py-2">
                          <p className="text-content-primary">{u.displayName || u.username}</p>
                          <p className="text-xs text-content-secondary">@{u.username} · {u.email}</p>
                        </td>
                        <td className="px-4 py-2 text-xs text-content-secondary">{u.status}</td>
                        <td className="px-4 py-2 text-xs text-content-secondary">
                          {formatRelativeTime(u.createdAt)}
                        </td>
                        <td className="px-4 py-2">
                          <button
                            type="button"
                            onClick={() => toggleActive(u)}
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                              u.isActive ? 'bg-secondary-muted text-secondary' : 'bg-background-overlay text-content-secondary'
                            }`}
                          >
                            {u.isActive ? 'Active' : 'Deactivated'}
                          </button>
                        </td>
                        <td className="px-4 py-2">
                          <button
                            type="button"
                            onClick={() => toggleAdmin(u)}
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                              u.isAdmin ? 'bg-primary-muted text-primary' : 'bg-background-overlay text-content-secondary'
                            }`}
                          >
                            {u.isAdmin ? 'Admin' : 'Member'}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-xs text-content-secondary">
                          No users found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-border p-3">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(p - 1, 1))}
                    className="text-xs text-content-secondary hover:text-content-primary disabled:opacity-30"
                  >
                    ← Previous
                  </button>
                  <span className="text-xs text-content-secondary">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                    className="text-xs text-content-secondary hover:text-content-primary disabled:opacity-30"
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
