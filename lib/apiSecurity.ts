import { NextResponse } from 'next/server';

export function tooManyRequests(resetEpochSeconds: number, message = 'Too many requests. Please try again later.') {
  return NextResponse.json(
    { error: message },
    {
      status: 429,
      headers: {
        'Retry-After': String(Math.max(1, resetEpochSeconds - Math.floor(Date.now() / 1000))),
      },
    },
  );
}

export function internalServerError(scope: string, error: unknown) {
  console.error(`[${scope}]`, error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
