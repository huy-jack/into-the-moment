import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse, type NextRequest } from 'next/server';
import { UPLOAD_CONTENT_TYPES, UPLOAD_MAX_BYTES } from '@/src/config';
import { errorResponse } from '@/src/server/http';

// Client-upload token for direct browser → private Blob uploads (skips Vercel's 4.5 MB body limit).
// The proxy has already checked the access-code cookie. Does not rely on the upload-completed
// callback: it never fires on localhost. POST /api/jobs confirms each path instead.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as HandleUploadBody | null;
  if (!body) return errorResponse(400, 'BAD_UPLOAD');
  try {
    const json = await handleUpload({
      token: process.env.BLOB_READ_WRITE_TOKEN,
      request: req,
      body,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith('uploads/')) throw new Error('uploads must go under uploads/');
        return { allowedContentTypes: UPLOAD_CONTENT_TYPES, maximumSizeInBytes: UPLOAD_MAX_BYTES, addRandomSuffix: true };
      },
    });
    return NextResponse.json(json);
  } catch (err) {
    return errorResponse(400, 'BAD_UPLOAD', (err as Error).message);
  }
}
