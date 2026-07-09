'use client';

import { useEffect, useState } from 'react';
import type { User } from '@/lib/types';
import { UserAvatar } from './UserAvatar';

interface NewChatDialogProps {
  onClose: () => void;
  onConversationCreated: (conversationId: string) => void;
}

export function NewChatDialog({ onClose, onConversationCreated }: NewChatDialogProps) {
  const [mode, setMode] = useState<'direct' | 'group'>('direct');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [selected, setSelected] = useState<User[]>([]);
  const [groupTitle, setGroupTitle] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (query.trim().length < 1) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        setResults(data.users || []);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 250);
    return () => clearTimeout(timeout);
  }, [query]);

  async function handleSelectUser(user: User) {
    if (mode === 'direct') {
      setIsSubmitting(true);
      setError(null);
      try {
        const res = await fetch('/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'direct', userId: user.id }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Failed to start conversation');
          return;
        }
        onConversationCreated(data.conversation.id);
      } catch {
        setError('Something went wrong.');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      if (!selected.find((u) => u.id === user.id)) {
        setSelected((s) => [...s, user]);
      }
      setQuery('');
      setResults([]);
    }
  }

  async function handleCreateGroup() {
    if (!groupTitle.trim() || selected.length === 0) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'group',
          title: groupTitle.trim(),
          memberIds: selected.map((u) => u.id),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create group');
        return;
      }
      onConversationCreated(data.conversation.id);
    } catch {
      setError('Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl border border-border bg-background-elevated p-5 shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-content-primary">New conversation</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-content-secondary hover:text-content-primary"
          >
            ✕
          </button>
        </div>

        <div className="mb-3 flex gap-1 rounded-lg bg-background-surface p-1">
          <button
            type="button"
            onClick={() => setMode('direct')}
            className={`flex-1 rounded-md py-1.5 text-xs font-medium transition ${
              mode === 'direct' ? 'bg-primary text-background' : 'text-content-secondary'
            }`}
          >
            Direct message
          </button>
          <button
            type="button"
            onClick={() => setMode('group')}
            className={`flex-1 rounded-md py-1.5 text-xs font-medium transition ${
              mode === 'group' ? 'bg-primary text-background' : 'text-content-secondary'
            }`}
          >
            Group
          </button>
        </div>

        {mode === 'group' && (
          <>
            <input
              type="text"
              placeholder="Group name"
              value={groupTitle}
              onChange={(e) => setGroupTitle(e.target.value)}
              className="mb-2 w-full rounded-lg border border-border-strong bg-background-surface px-3 py-2 text-sm text-content-primary outline-none focus:border-primary"
            />
            {selected.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {selected.map((u) => (
                  <span
                    key={u.id}
                    className="flex items-center gap-1 rounded-full bg-primary-muted px-2 py-1 text-xs text-primary"
                  >
                    {u.displayName || u.username}
                    <button
                      type="button"
                      onClick={() => setSelected((s) => s.filter((x) => x.id !== u.id))}
                      className="hover:text-content-primary"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </>
        )}

        <input
          type="text"
          placeholder="Search by username…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="mb-2 w-full rounded-lg border border-border-strong bg-background-surface px-3 py-2 text-sm text-content-primary outline-none focus:border-primary"
        />

        {error && <p className="mb-2 text-xs text-danger">{error}</p>}

        <div className="max-h-52 overflow-y-auto">
          {isSearching && <p className="py-2 text-center text-xs text-content-secondary">Searching…</p>}

          {!isSearching && query.trim() && results.length === 0 && (
            <p className="py-2 text-center text-xs text-content-secondary">No users found.</p>
          )}

          {results.map((user) => (
            <button
              key={user.id}
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSelectUser(user)}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-background-surface disabled:opacity-50"
            >
              <UserAvatar user={user} size="sm" showStatus={false} />
              <div className="min-w-0">
                <p className="truncate text-sm text-content-primary">{user.displayName || user.username}</p>
                <p className="truncate text-xs text-content-secondary">@{user.username}</p>
              </div>
            </button>
          ))}
        </div>

        {mode === 'group' && (
          <button
            type="button"
            onClick={handleCreateGroup}
            disabled={isSubmitting || !groupTitle.trim() || selected.length === 0}
            className="mt-3 w-full rounded-xl bg-primary px-4 py-2 text-sm font-medium text-background transition hover:bg-primary-hover disabled:opacity-40"
          >
            {isSubmitting ? 'Creating…' : `Create group${selected.length ? ` (${selected.length})` : ''}`}
          </button>
        )}
      </div>
    </div>
  );
}
