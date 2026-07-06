// lib/events.ts — Event broadcasting helpers (server-only)
import 'server-only';
import { sseManager } from './realtime';

export interface MessageEvent {
  type: 'message';
  conversationId: string;
  message: {
    id: string;
    senderId: string;
    content: string;
    contentType: string;
    parentMessageId: string | null;
    createdAt: string;
    sender: {
      id: string;
      username: string;
      displayName: string;
      avatarUrl: string | null;
    };
  };
}

export interface TypingEvent {
  type: 'typing';
  conversationId: string;
  userId: string;
  username: string;
  isTyping: boolean;
}

export interface ReadReceiptEvent {
  type: 'read_receipt';
  conversationId: string;
  messageId: string;
  userId: string;
  readAt: string;
}

export interface PresenceEvent {
  type: 'presence';
  userId: string;
  status: 'online' | 'offline' | 'away' | 'dnd';
  lastSeen: string;
}

export function broadcastMessage(conversationId: string, message: MessageEvent['message']): void {
  sseManager.broadcastToConversation(conversationId, 'message', {
    type: 'message',
    conversationId,
    message,
  });
}

export function broadcastTyping(
  conversationId: string,
  userId: string,
  username: string,
  isTyping: boolean
): void {
  sseManager.broadcastToConversation(conversationId, 'typing', {
    type: 'typing',
    conversationId,
    userId,
    username,
    isTyping,
  });
}

export function broadcastReadReceipt(conversationId: string, messageId: string, userId: string): void {
  sseManager.broadcastToConversation(conversationId, 'read_receipt', {
    type: 'read_receipt',
    conversationId,
    messageId,
    userId,
    readAt: new Date().toISOString(),
  });
}

export function broadcastPresence(userId: string, status: PresenceEvent['status']): void {
  // NOTE: only reaches the given user's own open connections. Broadcasting
  // presence to everyone who shares a conversation with this user would
  // require querying their conversation list here and fanning out — not
  // yet implemented.
  sseManager.sendToUser(userId, 'presence', {
    type: 'presence',
    userId,
    status,
    lastSeen: new Date().toISOString(),
  });
}
