import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/session';

const CONTENT_TYPES_BY_KIND: Record<string, string[]> = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  audio: ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav'],
  file: [
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf', 'text/plain',
    'application/zip', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  avatar: ['image/jpeg', 'image/png', 'image/webp'],
};

const MAX_SIZE_BY_KIND: Record<string, number> = {
  image: 15 * 1024 * 1024,
  audio: 10 * 1024 * 1024,
  file: 25 * 1024 * 1024,
  avatar: 5 * 1024 * 1024,
};

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // Auth check — without this, anyone could get a token to upload to
        // this store, authenticated or not.
        const token = cookies().get('session_token')?.value;
        const session = await verifySession(token || '');
        if (!session) {
          throw new Error('Unauthorized');
        }

        let kind = 'file';
        try {
          kind = clientPayload ? JSON.parse(clientPayload).kind || 'file' : 'file';
        } catch {
          // fall through to default 'file'
        }

        return {
          allowedContentTypes: CONTENT_TYPES_BY_KIND[kind] || CONTENT_TYPES_BY_KIND.file,
          maximumSizeInBytes: MAX_SIZE_BY_KIND[kind] || MAX_SIZE_BY_KIND.file,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: session.userId, kind }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Nothing to persist here — the message/profile-update routes save
        // the resulting blob.url themselves once the client receives it.
        // (This callback fires via Vercel's webhook and won't reach a
        // localhost dev server without a tunnel; that's expected.)
        console.log('Blob upload completed:', blob.url, tokenPayload);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    const status = message === 'Unauthorized' ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
