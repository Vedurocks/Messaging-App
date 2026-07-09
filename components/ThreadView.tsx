// components/ThreadView.tsx
import type { ThreadNode } from '@/lib/types';
import { MessageBubble } from './MessageBubble';

interface ThreadViewProps {
  /** Parent message with its replies populated in `.children` (see fetchConversationMessages/expandThreads). */
  thread: ThreadNode;
  currentUserId: string;
  otherParticipantCount?: number;
  onClose?: () => void;
}

export function ThreadView({ thread, currentUserId, otherParticipantCount = 1, onClose }: ThreadViewProps) {
  const replies = thread.children ?? [];

  return (
    <aside className="flex h-full w-full max-w-sm flex-col border-l border-border bg-background-elevated">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-content-primary">Thread</h2>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close thread"
            className="text-content-secondary hover:text-content-primary"
          >
            ✕
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mb-4 border-b border-border pb-4">
          <MessageBubble
            message={thread}
            isOwnMessage={thread.senderId === currentUserId}
            otherParticipantCount={otherParticipantCount}
          />
        </div>

        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-content-secondary">
          {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
        </p>

        <div className="flex flex-col gap-4">
          {replies.map((reply) => (
            <MessageBubble
              key={reply.id}
              message={reply}
              isOwnMessage={reply.senderId === currentUserId}
              otherParticipantCount={otherParticipantCount}
            />
          ))}

          {replies.length === 0 && (
            <p className="text-sm text-content-secondary">No replies yet — start the thread.</p>
          )}
        </div>
      </div>
    </aside>
  );
}
