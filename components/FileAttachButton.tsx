'use client';

import { useRef, useState } from 'react';
import { upload } from '@vercel/blob/client';

interface FileAttachButtonProps {
  onUploaded: (url: string, contentType: 'image' | 'file') => void;
  disabled?: boolean;
}

export function FileAttachButton({ onUploaded, disabled }: FileAttachButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;

    setIsUploading(true);
    setError(null);
    try {
      const isImage = file.type.startsWith('image/');
      const uploaded = await upload(file.name, file, {
        access: 'public',
        handleUploadUrl: '/api/upload',
        clientPayload: JSON.stringify({ kind: isImage ? 'image' : 'file' }),
      });
      onUploaded(uploaded.url, isImage ? 'image' : 'file');
    } catch {
      setError('Upload failed.');
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="relative">
      <input ref={inputRef} type="file" onChange={handleChange} className="hidden" />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || isUploading}
        aria-label="Attach a file"
        title={error || undefined}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg text-content-secondary transition hover:bg-background-surface hover:text-content-primary disabled:opacity-40"
      >
        {isUploading ? '…' : '📎'}
      </button>
      {error && <p className="absolute bottom-full right-0 mb-1 w-32 text-right text-[10px] text-danger">{error}</p>}
    </div>
  );
}
