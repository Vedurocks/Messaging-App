import { NextRequest } from 'next/server';
import { verifySession } from '@/lib/session';
import { sseManager } from '@/lib/realtime';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const token = request.cookies.get('session_token')?.value;
  const payload = await verifySession(token || '');

  if (!payload) {
    return new Response('Unauthorized', { status: 401 });
  }

  const clientId = crypto.randomUUID();
  const userId = payload.userId;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(`event: connected
data: {"clientId":"${clientId}"}

`));

      // Heartbeat to keep connection alive (every 30s)
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`event: heartbeat
data: {}

`));
        } catch {
          sseManager.removeClient(clientId);
        }
      }, 30000);

      // Register client
      sseManager.addClient({
        id: clientId,
        userId,
        conversationIds: new Set(),
        controller,
        heartbeatInterval,
      });

      // Notify user online status
      sseManager.sendToUser(userId, 'status', { userId, status: 'online' });
    },
    cancel() {
      sseManager.removeClient(clientId);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

