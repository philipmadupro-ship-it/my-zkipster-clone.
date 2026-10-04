import { NextRequest, NextResponse } from 'next/server';
import { handleApiError, requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Tells the browser who is signed in (the session cookie itself is HttpOnly).
export async function GET(req: NextRequest) {
  try {
    const user = await requireAdmin(req);
    return NextResponse.json({ email: user.email });
  } catch (err) {
    return handleApiError(err, 'session');
  }
}
