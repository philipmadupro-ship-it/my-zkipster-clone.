import { auth } from '@/lib/firebase';

/**
 * fetch() for the admin API routes: attaches the signed-in user's Firebase ID
 * token, which the server verifies in `requireAdmin`.
 */
export async function authedFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const token = await auth.currentUser?.getIdToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
