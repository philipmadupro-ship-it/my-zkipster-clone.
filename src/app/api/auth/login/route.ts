import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/auth';
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
  verifyLogin,
} from '@/lib/admin-session';
import { createFailureLimiter } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

// Best-effort guessing limits (per warm server instance): per client+email, and per email overall.
const perClient = createFailureLimiter(8, 15 * 60 * 1000);
const perEmail = createFailureLimiter(20, 15 * 60 * 1000);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    const client = (req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown').trim();
    const clientKey = `${client}|${email}`;
    const wait = Math.max(perClient.retryAfterSeconds(clientKey), perEmail.retryAfterSeconds(email));
    if (wait > 0) {
      return NextResponse.json(
        { error: 'Too many attempts. Please wait a few minutes and try again.' },
        { status: 429, headers: { 'Retry-After': String(wait) } },
      );
    }

    if (!verifyLogin(email, password)) {
      perClient.recordFailure(clientKey);
      perEmail.recordFailure(email);
      await new Promise((resolve) => setTimeout(resolve, 400)); // slows down guessing
      return NextResponse.json({ error: 'Incorrect email or password.' }, { status: 401 });
    }
    perClient.reset(clientKey);

    const res = NextResponse.json({ email });
    res.cookies.set(SESSION_COOKIE, createSessionToken(email), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    return res;
  } catch (err) {
    return handleApiError(err, 'login');
  }
}
