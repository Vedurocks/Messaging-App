// components/UserAvatar.tsx
import type { User, UserStatus } from '@/lib/types';

const STATUS_COLOR: Record<UserStatus, string> = {
  online: 'bg-status-online',
  away: 'bg-status-away',
  dnd: 'bg-status-dnd',
  offline: 'bg-status-offline',
};

const SIZE_MAP = {
  sm: { box: 'h-8 w-8', dot: 'h-2 w-2', text: 'text-xs' },
  md: { box: 'h-10 w-10', dot: 'h-2.5 w-2.5', text: 'text-sm' },
  lg: { box: 'h-14 w-14', dot: 'h-3.5 w-3.5', text: 'text-lg' },
} as const;

interface UserAvatarProps {
  user: Pick<User, 'displayName' | 'username' | 'avatarUrl' | 'status'>;
  size?: keyof typeof SIZE_MAP;
  showStatus?: boolean;
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function UserAvatar({ user, size = 'md', showStatus = true }: UserAvatarProps) {
  const label = user.displayName || user.username;
  const { box, dot, text } = SIZE_MAP[size];

  return (
    <div className={`relative shrink-0 ${box}`}>
      {user.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.avatarUrl}
          alt={label}
          className={`${box} rounded-full object-cover ring-1 ring-border`}
        />
      ) : (
        <div
          className={`flex ${box} items-center justify-center rounded-full bg-background-overlay text-content-primary ring-1 ring-border ${text} font-medium`}
          aria-hidden="true"
        >
          {initials(label)}
        </div>
      )}

      {showStatus && (
        <span
          className={`absolute bottom-0 right-0 ${dot} rounded-full ${STATUS_COLOR[user.status]} ring-2 ring-background`}
          role="status"
          aria-label={user.status}
        />
      )}
    </div>
  );
}
