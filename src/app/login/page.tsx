'use client';

export const dynamic = 'force-dynamic';


import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';

const ACTION_CODE_SETTINGS = {
  url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login`,
  handleCodeInApp: true,
};

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Complete sign-in if this is a magic link callback
  useEffect(() => {
    if (isSignInWithEmailLink(auth, window.location.href)) {
      let storedEmail = window.localStorage.getItem('emailForSignIn');
      if (!storedEmail) {
        storedEmail = window.prompt('Please provide your email for confirmation') || '';
      }
      signInWithEmailLink(auth, storedEmail, window.location.href)
        .then(() => {
          window.localStorage.removeItem('emailForSignIn');
          router.push('/');
        })
        .catch((err) => setError(err.message));
    }
  }, [router]);

  // Redirect if already signed in
  useEffect(() => {
    if (!loading && user) router.push('/');
  }, [user, loading, router]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await sendSignInLinkToEmail(auth, email, ACTION_CODE_SETTINGS);
      window.localStorage.setItem('emailForSignIn', email);
      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send link');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="font-display text-4xl font-bold text-white mb-2">Antgravity</h1>
          <p className="text-gray-400 text-sm tracking-widest uppercase">Event Management</p>
        </div>

        {/* Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">
          {sent ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">✉️</span>
              </div>
              <h2 className="text-xl font-semibold mb-2">Check your inbox</h2>
              <p className="text-gray-400 text-sm">
                We sent a sign-in link to <span className="text-white font-medium">{email}</span>.
                Click the link to access your dashboard.
              </p>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-semibold mb-1">Sign in</h2>
              <p className="text-gray-400 text-sm mb-6">Enter your email to receive a magic sign-in link.</p>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSend} className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5 tracking-wide uppercase">Email address</label>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 transition"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-lg transition"
                >
                  {submitting ? 'Sending…' : 'Send sign-in link'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
