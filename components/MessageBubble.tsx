// components/MessageBubble.tsx
import type { ThreadNode } from '@/lib/types';
import { formatMessageTime } from '@/lib/format';

interface MessageBubbleProps {
  message: ThreadNode;
  isOwnMessage: boolean;
  /** Total number of other participants who need to read this for it to count as "read" (1 for a direct conversation). */
  otherParticipantCount?: number;
  onReplyClick?: (parentMessageId: string) => void;
}

function ReadReceipt({ readBy, otherParticipantCount }: { readBy: string[]; otherParticipantCount: number }) {
  const isRead = otherParticipantCount > 0 && readBy.length >= otherParticipantCount;
  return (
    <span
      className={`text-xs ${isRead ? 'text-secondary' : 'text-content-disabled'}`}
      aria-label={isRead ? 'Read' : 'Sent'}
      title={isRead ? 'Read' : 'Sent'}
    >
      ✓✓
    </span>
  );
}

function MessageContent({ message }: { message: ThreadNode }) {
  if (message.isDeleted) {
    return <p className="italic text-content-disabled">This message was deleted</p>;
  }

  switch (message.contentType) {
    case 'image':
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={message.content}
          alt="Shared image"
          className="max-h-72 max-w-xs rounded-lg object-cover"
        />
      );

    case 'file': {
      const filename = message.content.split('/').pop() || 'Attachment';
      return (
        <a
          href={message.content}
          download
          className="flex items-center gap-2 rounded-lg border border-border-strong bg-background-overlay px-3 py-2 text-sm text-content-primary hover:border-secondary"
        >
          <span aria-hidden="true">📎</span>
          <span className="truncate">{filename}</span>
        </a>
      );
    }

    case 'audio':
      return (
        <audio controls preload="metadata" className="h-10 max-w-[260px]">
          <source src={message.content} />
        </audio>
      );

    case 'system':
      return <p className="text-center text-xs text-content-secondary">{message.content}</p>;

    case 'text':
    default:
      return <p className="whitespace-pre-wrap break-words">{message.content}</p>;
  }
}

export function MessageBubble({
  message,
  isOwnMessage,
  otherParticipantCount = 1,
  onReplyClick,
}: MessageBubbleProps) {
  if (message.contentType === 'system') {
    return (
      <div className="my-2 flex justify-center">
        <MessageContent message={message} />
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'} gap-1`}>
      {message.parentMessageId && (
        <button
          type="button"
          onClick={() => onReplyClick?.(message.parentMessageId!)}
          className="flex items-center gap-1 text-xs text-content-secondary hover:text-secondary"
        >
          <span aria-hidden="true">↪</span> Replying to a message
        </button>
      )}

      <div
        className={`max-w-md rounded-2xl px-4 py-2 ${
          isOwnMessage ? 'bg-primary-muted text-content-primary' : 'bg-background-surface text-content-primary'
        } ${message.isDeleted ? 'bg-transparent px-0' : ''}`}
      >
        <MessageContent message={message} />
      </div>

      <div className="flex items-center gap-1.5 px-1 text-xs text-content-secondary">
        <span>{formatMessageTime(message.createdAt)}</span>
        {message.isEdited && !message.isDeleted && <span>(edited)</span>}
        {message.replyCount > 0 && (
          <span className="text-content-secondary">
            · {message.replyCount} {message.replyCount === 1 ? 'reply' : 'replies'}
          </span>
        )}
        {isOwnMessage && !message.isDeleted && (
          <ReadReceipt readBy={message.readBy} otherParticipantCount={otherParticipantCount} />
        )}
      </div>
    </div>
  );
}
