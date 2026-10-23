export const ERROR_CODES = [
  'BAD_UPLOAD',
  'NO_FACE',
  'MULTI_FACE',
  'FACE_TOO_SMALL',
  'LOW_RES',
  'BLURRY',
  'NO_PERSON',
  'REFUSED_ALL',
  'SPEND_CAP',
  'JOB_CAP',
  'UPLOAD_CAP',
  'TIMEOUT',
  'PROVIDER_ERROR',
  'STUCK',
  'BAD_CODE',
  'CHILD_UNSUPPORTED',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

const MESSAGES: Record<ErrorCode, string> = {
  BAD_UPLOAD: 'This file is not a photo we can use. Upload a JPEG, PNG or WebP photo under 15 MB.',
  NO_FACE: 'We could not find a face. Use a photo where your face is clear and facing the camera.',
  MULTI_FACE: 'Two faces found: use a photo with only you.',
  FACE_TOO_SMALL: 'Face too small: use a closer photo.',
  LOW_RES: 'This photo is too small. Use a photo at least 512 pixels on its short side.',
  BLURRY: 'This photo is blurry. Use a sharper photo.',
  NO_PERSON: 'We could not find a person in the template. Choose a photo where one person is clearly visible.',
  REFUSED_ALL: "This pair can't be made: the AI services refused it. Try a different photo pair.",
  SPEND_CAP: 'The demo has used its budget. No new photos can be made.',
  JOB_CAP: 'Many photos are being made right now. Wait a few minutes and try again.',
  UPLOAD_CAP: 'The demo has reached its upload limit for this month. No new photos can be made.',
  TIMEOUT: 'The AI service took too long. Try again.',
  PROVIDER_ERROR: 'The AI service had a problem. Try again.',
  STUCK: 'This photo stopped making progress. Try again.',
  BAD_CODE: 'That code is not right. Check the email you got.',
  CHILD_UNSUPPORTED: "Photos with a child can't be made yet. Use photos of adults only.",
};

export function userMessage(code: ErrorCode): string {
  return MESSAGES[code];
}

export class RateLimitError extends Error {
  constructor(public readonly retryAfterMs: number) {
    super(`rate limited, retry after ${retryAfterMs} ms`);
    this.name = 'RateLimitError';
  }
}

export class RefusalError extends Error {
  constructor(public readonly text: string) {
    super(`refused: ${text}`);
    this.name = 'RefusalError';
  }
}

export class TimeoutError extends Error {
  constructor(message = 'paid call timed out') {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class SpendCapError extends Error {
  constructor(message = 'spend cap reached') {
    super(message);
    this.name = 'SpendCapError';
  }
}

export class FatalError extends Error {
  constructor(public readonly code: ErrorCode, detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'FatalError';
  }
}
