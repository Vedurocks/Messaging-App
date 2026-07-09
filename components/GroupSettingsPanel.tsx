// components/GroupSettingsPanel.tsx
import type { Conversation, ConversationParticipantWithUser, ParticipantRole } from '@/lib/types';
import { UserAvatar } from './UserAvatar';
import { formatRelativeTime } from '@/lib/format';

interface GroupSettingsPanelProps {
  conversation: Conversation;
  participants: ConversationParticipantWithUser[];
  currentUserRole: ParticipantRole;
  onRoleChange?: (userId: string, newRole: ParticipantRole) => void;
  onRemoveParticipant?: (userId: string) => void;
}

const ROLE_BADGE_STYLE: Record<ParticipantRole, string> = {
  owner: 'bg-primary-muted text-primary',
  admin: 'bg-secondary-muted text-secondary',
  member: 'bg-background-overlay text-content-secondary',
};

const ROLE_OPTIONS: ParticipantRole[] = ['owner', 'admin', 'member'];

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function RoleBadge({ role }: { role: ParticipantRole }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_BADGE_STYLE[role]}`}>
      {capitalize(role)}
    </span>
  );
}

export function GroupSettingsPanel({
  conversation,
  participants,
  currentUserRole,
  onRoleChange,
  onRemoveParticipant,
}: GroupSettingsPanelProps) {
  const canManageRoles = currentUserRole === 'owner' || currentUserRole === 'admin';
  const active = participants.filter((p) => !p.leftAt);
  const former = participants.filter((p) => p.leftAt);

  return (
    <div className="flex h-full flex-col bg-background-elevated">
      <header className="border-b border-border px-5 py-4">
        <h2 className="text-base font-semibold text-content-primary">
          {conversation.title || 'Group settings'}
        </h2>
        <p className="text-xs text-content-secondary">
          {active.length} member{active.length === 1 ? '' : 's'}
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-content-secondary">Members</h3>
        <ul className="flex flex-col gap-1">
          {active.map((participant) => (
            <li
              key={participant.userId}
              className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-background-surface"
            >
              <UserAvatar user={participant.user} size="sm" />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-content-primary">
                  {participant.user.displayName || participant.user.username}
                </p>
                <p className="truncate text-xs text-content-secondary">
                  Joined {formatRelativeTime(participant.joinedAt)}
                </p>
              </div>

              {canManageRoles ? (
                <select
                  value={participant.role}
                  onChange={(e) => onRoleChange?.(participant.userId, e.target.value as ParticipantRole)}
                  className="rounded-md border border-border-strong bg-background-surface px-2 py-1 text-xs text-content-primary"
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {capitalize(role)}
                    </option>
                  ))}
                </select>
              ) : (
                <RoleBadge role={participant.role} />
              )}

              {canManageRoles && participant.role !== 'owner' && (
                <button
                  type="button"
                  onClick={() => onRemoveParticipant?.(participant.userId)}
                  className="text-xs text-danger hover:underline"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>

        {former.length > 0 && (
          <>
            <h3 className="mb-2 mt-6 text-xs font-medium uppercase tracking-wide text-content-secondary">
              Former members
            </h3>
            <ul className="flex flex-col gap-1">
              {former.map((participant) => (
                <li key={participant.userId} className="flex items-center gap-3 rounded-lg px-2 py-2 opacity-60">
                  <UserAvatar user={participant.user} size="sm" showStatus={false} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-content-primary">
                      {participant.user.displayName || participant.user.username}
                    </p>
                    <p className="truncate text-xs text-content-secondary">
                      Left {formatRelativeTime(participant.leftAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
