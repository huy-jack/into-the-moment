import { NextResponse } from 'next/server';
import { userMessage, type ErrorCode } from '../errors';

export function errorResponse(status: number, code: ErrorCode, message = userMessage(code)) {
  return NextResponse.json({ error: { code, message } }, { status });
}
