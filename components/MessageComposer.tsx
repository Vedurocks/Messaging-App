'use client';

import { useRef, useState } from 'react';
import { EmojiPicker } from './EmojiPicker';

interface MessageComposerProps {
  onSend: (content: string) => void;
  onTyping?: (isTyping: boolean) => void;
  disabled?: boolean;
}

export function MessageComposer({ onSend, onTyping, disabled }: MessageComposerProps) {
  const [value, setValue] = useState('');
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value);

    if (onTyping) {
      onTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => onTyping(false), 2000);
    }
  }

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    if (onTyping) onTyping(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex items-end gap-2 border-t border-border bg-background-elevated p-3">
      <textarea
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="Type a message…"
        rows={1}
        className="max-h-32 flex-1 resize-none rounded-lg border border-border-strong bg-background-surface px-3 py-2 text-sm text-content-primary outline-none placeholder:text-content-disabled focus:border-primary disabled:opacity-50"
      />

      <EmojiPicker onSelect={(emoji) => setValue((v) => v + emoji)} />

      <button
        type="button"
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        aria-label="Send message"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-background transition hover:bg-primary-hover disabled:opacity-40"
      >
        ➤
      </button>
    </div>
  );
}
