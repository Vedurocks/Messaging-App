// lib/realtime.ts — SSE connection manager (server-only)
//
// ⚠️ DEPLOYMENT CAVEAT (not mentioned in the source material):
// This holds connection state in an in-memory Map inside a module-level
// singleton. That only works if every request that touches it — the SSE
// `connect` stream AND every `sendMessage`/broadcast call — runs in the
// *same* long-lived process.
//
// On Vercel's default serverless/edge functions, each API route
// invocation may run in a different, short-lived instance with its own
// memory. A `POST /api/conversations/[id]/messages` call has no
// guarantee of hitting the same instance as the client's open `GET
// /api/realtime/connect` SSE stream — so broadcastMessage() would often
// silently do nothing, and messages wouldn't arrive in realtime despite
// no errors being thrown.
//
// This works correctly today only if:
//   (a) deployed to a persistent Node process (not Vercel serverless
//       functions) — e.g. a long-running container/VM, or
//   (b) you're running `next dev` locally (single process).
//
// For real production use on Vercel, replace the in-memory Maps here
// with a shared pub/sub layer (Redis, Ably, Pusher) that all instances
// can publish to and subscribe from. The `.env.example` REDIS_URL
// placeholder is there for exactly this — it is not yet wired up.
import 'server-only';

export interface SSEClient {
  id: string;
  userId: string;
  conversationIds: Set<string>;
  controller: ReadableStreamDefaultController;
  heartbeatInterval: ReturnType<typeof setInterval>;
}

class SSEManager {
  private clients: Map<string, SSEClient> = new Map();
  private userClients: Map<string, Set<string>> = new Map();
  private conversationClients: Map<string, Set<string>> = new Map();

  addClient(client: SSEClient): void {
    this.clients.set(client.id, client);
    if (!this.userClients.has(client.userId)) {
      this.userClients.set(client.userId, new Set());
    }
    this.userClients.get(client.userId)!.add(client.id);
  }

  removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    for (const convId of client.conversationIds) {
      this.conversationClients.get(convId)?.delete(clientId);
    }
    this.userClients.get(client.userId)?.delete(clientId);
    clearInterval(client.heartbeatInterval);
    this.clients.delete(clientId);
  }

  subscribeToConversation(clientId: string, conversationId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.conversationIds.add(conversationId);
    if (!this.conversationClients.has(conversationId)) {
      this.conversationClients.set(conversationId, new Set());
    }
    this.conversationClients.get(conversationId)!.add(clientId);
  }

  unsubscribeFromConversation(clientId: string, conversationId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.conversationIds.delete(conversationId);
    this.conversationClients.get(conversationId)?.delete(clientId);
  }

  private send(clientIds: Set<string> | undefined, event: string, data: unknown): void {
    if (!clientIds) return;
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    const encoder = new TextEncoder();

    for (const clientId of clientIds) {
      const client = this.clients.get(clientId);
      if (!client) continue;
      try {
        client.controller.enqueue(encoder.encode(message));
      } catch {
        this.removeClient(clientId);
      }
    }
  }

  broadcastToConversation(conversationId: string, event: string, data: unknown): void {
    this.send(this.conversationClients.get(conversationId), event, data);
  }

  sendToUser(userId: string, event: string, data: unknown): void {
    this.send(this.userClients.get(userId), event, data);
  }

  getConnectedUsers(): string[] {
    return Array.from(this.userClients.keys());
  }

  getConversationSubscribers(conversationId: string): string[] {
    const clientIds = this.conversationClients.get(conversationId);
    if (!clientIds) return [];
    return Array.from(clientIds)
      .map((id) => this.clients.get(id)?.userId)
      .filter((id): id is string => !!id);
  }
}

export const sseManager = new SSEManager();
