// lib/types.ts
//
// UI-facing types. Enums and the message shape are re-exported from
// lib/conversation.ts (ThreadNode, PaginatedMessages) so there's a single
// definition rather than two competing ones. Everything here mirrors
// db/schema.sql exactly — check that file if a field looks unfamiliar.

export type { ThreadNode, PaginatedMessages } from './conversation';

export type UserStatus = 'online' | 'offline' | 'away' | 'dnd';
export type ConversationType = 'direct' | 'group';
export type ParticipantRole = 'owner' | 'admin' | 'member';
export type MessageContentType = 'text' | 'image' | 'file' | 'system';

export interface User {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  status: UserStatus;
  lastSeen: string | null; // ISO timestamp
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  title: string | null; // null for direct conversations
  description: string | null;
  avatarUrl: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string | null;
  isEncrypted: boolean;
}

export interface ConversationParticipant {
  id: string;
  conversationId: string;
  userId: string;
  role: ParticipantRole;
  joinedAt: string;
  leftAt: string | null; // null = still a member
  lastReadMessageId: string | null;
  isMuted: boolean;
}

export interface MessagePreview {
  id: string;
  content: string;
  contentType: MessageContentType;
  senderId: string;
  createdAt: string;
  isDeleted: boolean;
  sender: { displayName: string | null; username: string } | null;
}

// ---- Composite / hydrated shapes used by components ----

export interface ConversationParticipantWithUser extends ConversationParticipant {
  user: User;
}

export interface ConversationListItemData {
  conversation: Conversation;
  lastMessage: MessagePreview | null;
  otherParticipant: User | null; // for direct conversations, the other person
  unreadCount: number;
}
