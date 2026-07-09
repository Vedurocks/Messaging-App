'use client';

import { useEffect, useRef, useState } from 'react';

interface Gif {
  id: string;
  title: string;
  previewUrl: string;
  url: string;
}

interface GifPickerProps {
  onSelect: (gifUrl: string) => void;
}

export function GifPicker({ onSelect }: GifPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<Gif[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  useEffect(() => {
    if (!open) return;
    const timeout = setTimeout(async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/gifs/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'GIF search failed');
          setGifs([]);
          return;
        }
        setGifs(data.gifs || []);
      } catch {
        setError('GIF search failed');
      } finally {
        setIsLoading(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Send a GIF"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-content-secondary transition hover:bg-background-surface hover:text-content-primary"
      >
        GIF
      </button>

      {open && (
        <div className="absolute bottom-full right-0 z-10 mb-2 w-72 rounded-xl border border-border bg-background-elevated p-3 shadow-panel">
          <input
            type="text"
            autoFocus
            placeholder="Search GIFs…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="mb-2 w-full rounded-lg border border-border-strong bg-background-surface px-3 py-2 text-sm text-content-primary outline-none focus:border-primary"
          />

          {error && <p className="px-1 py-4 text-center text-xs text-content-secondary">{error}</p>}
          {isLoading && !error && <p className="px-1 py-4 text-center text-xs text-content-secondary">Searching…</p>}

          {!isLoading && !error && (
            <div className="grid max-h-56 grid-cols-2 gap-1.5 overflow-y-auto">
              {gifs.map((gif) => (
                <button
                  key={gif.id}
                  type="button"
                  onClick={() => {
                    onSelect(gif.url);
                    setOpen(false);
                    setQuery('');
                  }}
                  className="overflow-hidden rounded-lg ring-1 ring-border transition hover:ring-primary"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={gif.previewUrl} alt={gif.title} className="h-24 w-full object-cover" />
                </button>
              ))}
              {gifs.length === 0 && (
                <p className="col-span-2 py-4 text-center text-xs text-content-secondary">No GIFs found.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
