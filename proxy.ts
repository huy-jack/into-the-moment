import { NextResponse, type NextRequest } from 'next/server';
import { errorResponse } from './src/server/http';
import { hasSession } from './src/server/session';

// The access code gates every API call that can spend money. Open: the code check itself.
// The job runner's internal route (/.well-known/workflow/) must stay outside the matcher
// entirely: the Workflow docs say a proxy that even passes those requests through can break
// the runner's queue calls. The path check below is a second guard.
const OPEN = ['/api/access', '/.well-known/workflow/'];

export function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (OPEN.some((p) => path === p || path.startsWith(p))) return NextResponse.next();
  if (path.startsWith('/api/') && !hasSession(req)) return errorResponse(401, 'BAD_CODE', 'Enter the access code first.');
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
