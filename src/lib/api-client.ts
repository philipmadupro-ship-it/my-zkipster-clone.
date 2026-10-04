/**
 * fetch() for the admin API routes. The session cookie goes along automatically;
 * if the server says we're not signed in (never, or the session ran out), send
 * the person back to the login page.
 */
export async function authedFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(input, { credentials: 'same-origin', ...init });
  if (res.status === 401 && typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.assign('/login');
  }
  return res;
}
