'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
  User,
  ConversationListItemData,
  ConversationParticipantWithUser,
  ParticipantRole,
  MessageContentType,
} from '@/lib/types';
import type { ThreadNode } from '@/lib/conversation';
import { UserAvatar } from '@/components/UserAvatar';
import { ConversationListItem } from '@/components/ConversationListItem';
import { MessageBubble } from '@/components/MessageBubble';
import { MessageComposer } from '@/components/MessageComposer';
import { NewChatDialog } from '@/components/NewChatDialog';
import { GroupSettingsPanel } from '@/components/GroupSettingsPanel';

const POLL_INTERVAL_MS = 4000;

function emptyNodeFields() {
  return { children: [], readBy: [], reactions: {}, attachments: [], isDeleted: false, isPinned: false, isEdited: false, replyCount: 0 };
}

export default function ChatPage() {
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [conversations, setConversations] = useState<ConversationListItemData[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ThreadNode[]>([]);
  const [participants, setParticipants] = useState<ConversationParticipantWithUser[]>([]);
  const [mobileView, setMobileView] = useState<'list' | 'thread'>('list');
  const [showNewChat, setShowNewChat] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ThreadNode[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const clientIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;

  const selected = conversations.find((c) => c.conversation.id === selectedId) || null;

  useEffect(() => {
    (async () => {
      try {
        const [meRes, convRes] = await Promise.all([fetch('/api/auth/me'), fetch('/api/conversations')]);
        if (meRes.status === 401 || convRes.status === 401) {
          router.push('/login');
          return;
        }
        const me = await meRes.json();
        const conv = await convRes.json();
        setCurrentUser(me.user);
        setConversations(conv.conversations || []);
      } catch {
        setLoadError('Could not load your conversations. Try refreshing.');
      }
    })();
  }, [router]);

  const loadMessages = useCallback(async (conversationId: string) => {
    const res = await fetch(`/api/conversations/${conversationId}/messages`);
    if (!res.ok) return;
    const data = await res.json();
    setMessages(data.messages || []);
  }, []);

  const loadConversationList = useCallback(async () => {
    const res = await fetch('/api/conversations');
    if (!res.ok) return;
    const data = await res.json();
    setConversations(data.conversations || []);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    loadMessages(selectedId);
    setParticipants([]);
    setShowGroupSettings(false);
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);

    if (selected?.conversation.type === 'group') {
      fetch(`/api/conversations/${selectedId}/participants`)
        .then((r) => r.json())
        .then((d) => setParticipants(d.participants || []))
        .catch(() => {});
    }

    if (clientIdRef.current) {
      fetch('/api/realtime/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: clientIdRef.current, conversationId: selectedId }),
      }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, loadMessages]);

  // Mark unread messages (from others) as read once they're loaded.
  useEffect(() => {
    if (!selectedId || !currentUser || messages.length === 0) return;
    const unreadIds = messages
      .filter((m) => m.senderId !== currentUser.id && !m.isDeleted)
      .map((m) => m.id);
    if (unreadIds.length === 0) return;

    fetch(`/api/conversations/${selectedId}/messages/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageIds: unreadIds }),
    }).catch(() => {});
  }, [selectedId, messages, currentUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Best-effort SSE (see lib/realtime.ts caveat re: serverless instances).
  useEffect(() => {
    if (!currentUser) return;

    const source = new EventSource('/api/realtime/connect');

    source.addEventListener('connected', (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      clientIdRef.current = data.clientId;
      if (selectedIdRef.current) {
        fetch('/api/realtime/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId: data.clientId, conversationId: selectedIdRef.current }),
        }).catch(() => {});
      }
    });

    source.addEventListener('message', (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      if (data.conversationId === selectedIdRef.current) {
        setMessages((prev) =>
          prev.some((m) => m.id === data.message.id) ? prev : [...prev, { ...data.message, ...emptyNodeFields() }]
        );
      }
      loadConversationList();
    });

    source.onerror = () => {
      // Expected/normal on serverless — polling below is the real fallback.
    };

    return () => source.close();
  }, [currentUser, loadConversationList]);

  // Polling fallback — the reliable path given the SSE caveat.
  useEffect(() => {
    const interval = setInterval(() => {
      if (selectedIdRef.current) loadMessages(selectedIdRef.current);
      loadConversationList();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadMessages, loadConversationList]);

  async function handleSend(content: string, contentType: MessageContentType = 'text') {
    if (!selectedId) return;
    setIsSending(true);
    try {
      const res = await fetch(`/api/conversations/${selectedId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, contentType }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessages((prev) => (prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message]));
        loadConversationList();
      }
    } finally {
      setIsSending(false);
    }
  }

  async function handleSearch(q: string) {
    setSearchQuery(q);
    if (!selectedId || q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const res = await fetch(`/api/conversations/${selectedId}/messages/search?q=${encodeURIComponent(q.trim())}`);
    if (res.ok) {
      const data = await res.json();
      setSearchResults(data.results || []);
    }
  }

  async function handleRoleChange(userId: string, newRole: ParticipantRole) {
    if (!selectedId || newRole === 'owner') return;
    const res = await fetch(`/api/conversations/${selectedId}/participants/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    });
    if (res.ok) {
      setParticipants((prev) => prev.map((p) => (p.userId === userId ? { ...p, role: newRole } : p)));
    }
  }

  async function handleRemoveParticipant(userId: string) {
    if (!selectedId) return;
    const res = await fetch(`/api/conversations/${selectedId}/participants/${userId}`, { method: 'DELETE' });
    if (res.ok) {
      setParticipants((prev) => prev.map((p) => (p.userId === userId ? { ...p, leftAt: new Date().toISOString() } : p)));
    }
  }

  const otherParticipantCount =
    selected?.conversation.type === 'group'
      ? Math.max(participants.filter((p) => !p.leftAt).length - 1, 1)
      : 1;

  if (!currentUser) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-content-secondary">{loadError || 'Loading…'}</p>
      </main>
    );
  }

  return (
    <main className="flex h-screen overflow-hidden bg-background">
      <aside
        className={`flex w-full flex-col border-r border-border bg-background-elevated sm:w-80 sm:shrink-0 ${
          mobileView === 'thread' ? 'hidden sm:flex' : 'flex'
        }`}
      >
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <UserAvatar user={currentUser} size="sm" />
            <span className="text-sm font-medium text-content-primary">
              {currentUser.displayName || currentUser.username}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {currentUser.isAdmin && (
              <button
                type="button"
                onClick={() => router.push('/admin')}
                aria-label="Admin dashboard"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-content-secondary hover:bg-background-surface hover:text-content-primary"
              >
                🛡️
              </button>
            )}
            <button
              type="button"
              onClick={() => router.push('/settings')}
              aria-label="Settings"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-content-secondary hover:bg-background-surface hover:text-content-primary"
            >
              ⚙️
            </button>
            <button
              type="button"
              onClick={() => setShowNewChat(true)}
              aria-label="New conversation"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-content-secondary hover:bg-background-surface hover:text-content-primary"
            >
              ＋
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-2">
          {conversations.length === 0 && (
            <p className="mt-8 text-center text-sm text-content-secondary">
              No conversations yet. Tap ＋ to start one.
            </p>
          )}
          {conversations.map((c) => (
            <ConversationListItem
              key={c.conversation.id}
              data={c}
              isActive={c.conversation.id === selectedId}
              onClick={() => {
                setSelectedId(c.conversation.id);
                setMobileView('thread');
              }}
            />
          ))}
        </div>
      </aside>

      <section className={`flex min-w-0 flex-1 flex-col ${mobileView === 'list' ? 'hidden sm:flex' : 'flex'}`}>
        {!selected ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-content-secondary">Select a conversation to start chatting.</p>
          </div>
        ) : (
          <>
            <header className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMobileView('list')}
                  aria-label="Back"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-content-secondary hover:bg-background-surface sm:hidden"
                >
                  ←
                </button>
                <span className="truncate text-sm font-medium text-content-primary">
                  {selected.conversation.type === 'group'
                    ? selected.conversation.title || 'Unnamed group'
                    : selected.otherParticipant?.displayName || selected.otherParticipant?.username || 'Unknown user'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowSearch((s) => !s)}
                  aria-label="Search messages"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-content-secondary hover:bg-background-surface hover:text-content-primary"
                >
                  🔍
                </button>
                {selected.conversation.type === 'group' && (
                  <button
                    type="button"
                    onClick={() => setShowGroupSettings((s) => !s)}
                    aria-label="Group settings"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-content-secondary hover:bg-background-surface hover:text-content-primary"
                  >
                    ⋯
                  </button>
                )}
              </div>
            </header>

            {showSearch && (
              <div className="border-b border-border bg-background-elevated p-3">
                <input
                  type="text"
                  autoFocus
                  placeholder="Search in this conversation…"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full rounded-lg border border-border-strong bg-background-surface px-3 py-2 text-sm text-content-primary outline-none focus:border-primary"
                />
                {searchResults.length > 0 && (
                  <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-border">
                    {searchResults.map((m) => (
                      <div key={m.id} className="border-b border-border px-3 py-2 text-xs last:border-b-0">
                        <span className="text-content-secondary">
                          {m.sender.displayName || m.sender.username}:{' '}
                        </span>
                        <span className="text-content-primary">{m.content}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-1 overflow-hidden">
              <div className="flex flex-1 flex-col overflow-y-auto px-4 py-4">
                <div className="flex flex-col gap-4">
                  {messages.map((m) => (
                    <MessageBubble
                      key={m.id}
                      message={m}
                      isOwnMessage={m.senderId === currentUser.id}
                      otherParticipantCount={otherParticipantCount}
                    />
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {showGroupSettings && selected.conversation.type === 'group' && (
                <GroupSettingsPanel
                  conversation={selected.conversation}
                  participants={participants}
                  currentUserRole={participants.find((p) => p.userId === currentUser.id)?.role || 'member'}
                  onRoleChange={handleRoleChange}
                  onRemoveParticipant={handleRemoveParticipant}
                />
              )}
            </div>

            <MessageComposer onSend={handleSend} disabled={isSending} />
          </>
        )}
      </section>

      {showNewChat && (
        <NewChatDialog
          onClose={() => setShowNewChat(false)}
          onConversationCreated={(id) => {
            setShowNewChat(false);
            loadConversationList();
            setSelectedId(id);
            setMobileView('thread');
          }}
        />
      )}
    </main>
  );
}
