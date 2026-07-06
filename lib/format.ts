// lib/format.ts

export function formatRelativeTime(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.round(diffMs / 1000);

  if (diffSec < 30) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;

  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatLastSeen(iso: string | null): string {
  if (!iso) return 'Offline';
  return `Last seen ${formatRelativeTime(iso)}`;
}

export function formatMessageTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}
