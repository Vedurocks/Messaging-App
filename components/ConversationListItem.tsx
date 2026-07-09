// components/ConversationListItem.tsx
import type { ConversationListItemData, MessagePreview } from '@/lib/types';
import { UserAvatar } from './UserAvatar';
import { formatRelativeTime } from '@/lib/format';

interface ConversationListItemProps {
  data: ConversationListItemData;
  isActive?: boolean;
  onClick?: () => void;
}

function previewText(message: MessagePreview | null): string {
  if (!message) return 'No messages yet';
  if (message.isDeleted) return 'This message was deleted';

  const senderPrefix = message.sender ? `${message.sender.displayName || message.sender.username}: ` : '';

  switch (message.contentType) {
    case 'image':
      return `${senderPrefix}📷 Image`;
    case 'file':
      return `${senderPrefix}📎 File`;
    case 'audio':
      return `${senderPrefix}🎤 Voice message`;
    case 'system':
      return message.content;
    case 'text':
    default:
      return `${senderPrefix}${message.content}`;
  }
}

export function ConversationListItem({ data, isActive, onClick }: ConversationListItemProps) {
  const { conversation, lastMessage, otherParticipant, unreadCount } = data;
  const isGroup = conversation.type === 'group';

  const title = isGroup
    ? conversation.title || 'Unnamed group'
    : otherParticipant?.displayName || otherParticipant?.username || 'Unknown user';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
        isActive ? 'bg-primary-muted' : 'hover:bg-background-surface'
      }`}
    >
      {isGroup ? (
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background-overlay text-sm font-medium text-secondary ring-1 ring-border"
          aria-hidden="true"
        >
          {(conversation.title || '#').charAt(0).toUpperCase()}
        </div>
      ) : otherParticipant ? (
        <UserAvatar user={otherParticipant} size="md" />
      ) : (
        <div className="h-10 w-10 shrink-0 rounded-full bg-background-overlay" />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium text-content-primary">{title}</span>
          {lastMessage && (
            <span className="shrink-0 text-xs text-content-secondary">
              {formatRelativeTime(lastMessage.createdAt)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs text-content-secondary">{previewText(lastMessage)}</span>
          {unreadCount > 0 && (
            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-background">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
