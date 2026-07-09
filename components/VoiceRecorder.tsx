'use client';

import { useRef, useState } from 'react';
import { upload } from '@vercel/blob/client';

interface VoiceRecorderProps {
  onRecorded: (url: string, durationSeconds: number) => void;
  disabled?: boolean;
}

export function VoiceRecorder({ onRecorded, disabled }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);

        const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
        const blob = new Blob(chunksRef.current, { type: mimeType });

        if (blob.size === 0) {
          setIsRecording(false);
          return;
        }

        setIsUploading(true);
        try {
          const uploaded = await upload(`voice-${Date.now()}.webm`, blob, {
            access: 'public',
            handleUploadUrl: '/api/upload',
            clientPayload: JSON.stringify({ kind: 'audio' }),
          });
          onRecorded(uploaded.url, duration);
        } catch {
          setError('Upload failed. Try again.');
        } finally {
          setIsUploading(false);
          setIsRecording(false);
          setSeconds(0);
        }
      };

      recorder.start();
      startTimeRef.current = Date.now();
      setIsRecording(true);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setError('Microphone access denied.');
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
  }

  function cancelRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setSeconds(0);
  }

  if (isRecording) {
    const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
    const ss = String(seconds % 60).padStart(2, '0');
    return (
      <div className="flex items-center gap-2 rounded-lg bg-background-surface px-2">
        <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-danger" />
        <span className="text-xs tabular-nums text-content-secondary">{mm}:{ss}</span>
        <button
          type="button"
          onClick={cancelRecording}
          aria-label="Cancel recording"
          className="text-xs text-content-secondary hover:text-danger"
        >
          ✕
        </button>
        <button
          type="button"
          onClick={stopRecording}
          aria-label="Stop and send recording"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-danger text-background"
        >
          ■
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={startRecording}
        disabled={disabled || isUploading}
        aria-label="Record voice message"
        title={error || undefined}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg text-content-secondary transition hover:bg-background-surface hover:text-content-primary disabled:opacity-40"
      >
        {isUploading ? '…' : '🎤'}
      </button>
      {error && <p className="absolute bottom-full right-0 mb-1 w-32 text-right text-[10px] text-danger">{error}</p>}
    </div>
  );
}
