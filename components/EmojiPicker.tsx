'use client';

import { useEffect, useRef, useState } from 'react';

const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  {
    label: 'Smileys',
    emojis: ['😀', '😂', '🥲', '😊', '😍', '🤔', '😉', '😢', '😮', '😴', '🙄', '😅', '🥳', '😎', '🤗', '😇'],
  },
  {
    label: 'Gestures',
    emojis: ['👍', '👎', '👏', '🙌', '🙏', '👋', '✌️', '🤝', '💪', '👌', '🤞', '✋'],
  },
  {
    label: 'Hearts',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '💕'],
  },
  {
    label: 'Objects',
    emojis: ['🔥', '🎉', '✨', '💯', '⭐', '✅', '❌', '⚡', '🎂', '☕', '🚀', '📌'],
  },
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
}

export function EmojiPicker({ onSelect }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Add emoji"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg text-content-secondary transition hover:bg-background-surface hover:text-content-primary"
      >
        🙂
      </button>

      {open && (
        <div className="absolute bottom-full right-0 z-10 mb-2 w-64 rounded-xl border border-border bg-background-elevated p-3 shadow-panel">
          {EMOJI_GROUPS.map((group) => (
            <div key={group.label} className="mb-2 last:mb-0">
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-content-secondary">
                {group.label}
              </p>
              <div className="grid grid-cols-8 gap-0.5">
                {group.emojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      onSelect(emoji);
                      setOpen(false);
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-base transition hover:bg-background-surface"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
