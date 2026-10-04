'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import UngaroLogo from '@/components/UngaroLogo';
import {
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';

type Mode = 'signin' | 'reset';

// Wrong-password and unknown-email deliberately share one message so the form
// can't be used to find out which addresses have accounts.
function friendlyError(err: unknown): string {
  const code = (err as { code?: string } | null)?.code ?? '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-login-credentials':
      return 'Incorrect email or password.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    case 'auth/operation-not-allowed':
      return 'Email and password sign-in is not enabled for this project yet.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return '';
    default:
      return err instanceof Error ? err.message : 'Something went wrong. Please try again.';
  }
}

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Redirect once signed in (AuthContext only exposes verified users).
  useEffect(() => {
    if (isMounted && !loading && user) {
      router.push('/');
    }
  }, [user, loading, router, isMounted]);

  function switchMode(next: Mode) {
    setMode(next);
    setError('');
    setNotice('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const address = email.trim();
    if (!address) return;

    setError('');
    setNotice('');
    setSubmitting(true);

    try {
      if (mode === 'reset') {
        await sendPasswordResetEmail(auth, address);
        setNotice(`If an account exists for ${address}, a password reset link is on its way.`);
        return;
      }

      const cred = await signInWithEmailAndPassword(auth, address, password);
      if (!cred.user.emailVerified) {
        // Logins created by hand in the Firebase Console start out unverified. The
        // server activates them if the address is named in ADMIN_EMAILS.
        const res = await fetch('/api/activate-account', {
          method: 'POST',
          headers: { Authorization: `Bearer ${await cred.user.getIdToken()}` },
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          await signOut(auth);
          setError(data.error || 'This account has not been activated. Please contact the administrator.');
          return;
        }
        // Pick up the verified flag and a fresh token so the API and Firestore accept us.
        await cred.user.reload();
        await cred.user.getIdToken(true);
      }
      router.push('/');
    } catch (err) {
      console.error('Auth error:', err);
      setError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    setError('');
    setNotice('');
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      router.push('/');
    } catch (err: unknown) {
      console.error('Google sign-in error:', err);
      setError(friendlyError(err));
    }
  }

  if (!isMounted || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  const isReset = mode === 'reset';

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6 selection:bg-white selection:text-black">
      {/* Dynamic Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-white/[0.03] blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[30%] h-[30%] bg-white/[0.02] blur-[100px] rounded-full" />
      </div>

      <div className="w-full max-w-lg relative animate-in fade-in zoom-in-95 duration-1000">
        <div className="text-center mb-12 space-y-3">
          <UngaroLogo className="h-14 sm:h-16" color="#FFFFFF" />
          <div className="flex items-center justify-center gap-4">
             <div className="h-px w-8 bg-white/20" />
             <p className="text-[10px] text-gray-500 uppercase tracking-[0.5em] font-bold">Secure Access</p>
             <div className="h-px w-8 bg-white/20" />
          </div>
        </div>

        <div className="bg-white/[0.02] border border-white/5 backdrop-blur-3xl rounded-[3rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)] p-12">
          <div className="space-y-10">
            <div className="space-y-3">
              <h2 className="text-2xl font-bold text-white tracking-tight">{isReset ? 'Reset Password' : 'System Login'}</h2>
              <p className="text-gray-500 text-sm font-medium">
                {isReset
                  ? 'Enter your email and we will send you a link to choose a new password.'
                  : 'Enter your credentials to access the administrative control center.'}
              </p>
            </div>

            {error && (
              <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4 text-red-400 text-xs font-medium animate-in slide-in-from-top-2">
                <span className="opacity-60 mr-2">Error:</span> {error}
              </div>
            )}
            {notice && (
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 text-emerald-400 text-xs font-medium animate-in slide-in-from-top-2">
                {notice}
              </div>
            )}

            {!isReset && (
              <div className="space-y-6">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="group relative w-full"
                >
                  <div className="absolute inset-0 bg-white blur-lg opacity-0 group-hover:opacity-10 transition-opacity duration-500" />
                  <div className="relative w-full bg-white/[0.03] border border-white/10 hover:border-white/25 text-white font-bold py-5 rounded-2xl transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-4">
                     <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                        <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                     </svg>
                     <span className="uppercase tracking-[0.15em] text-[11px]">Continue with Google</span>
                  </div>
                </button>

                <div className="flex items-center gap-6 py-2">
                   <div className="h-px flex-1 bg-white/5" />
                   <span className="text-[10px] text-gray-700 font-bold uppercase tracking-[0.3em]">or</span>
                   <div className="h-px flex-1 bg-white/5" />
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="space-y-2">
                <label htmlFor="email" className="px-1 block text-[10px] text-gray-500 uppercase tracking-[0.2em] font-bold">Email</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="press@ungaro.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-6 py-4 text-white placeholder-gray-700 outline-none focus:border-white/30 focus:bg-white/[0.05] transition-all duration-300"
                />
              </div>

              {!isReset && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <label htmlFor="password" className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-bold">Password</label>
                    <button
                      type="button"
                      onClick={() => switchMode('reset')}
                      className="text-[10px] text-gray-600 hover:text-white uppercase tracking-[0.2em] font-bold transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      className="w-full bg-white/[0.03] border border-white/10 rounded-2xl pl-6 pr-20 py-4 text-white placeholder-gray-700 outline-none focus:border-white/30 focus:bg-white/[0.05] transition-all duration-300"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(s => !s)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] text-gray-600 hover:text-white uppercase tracking-[0.2em] font-bold transition-colors"
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="group relative w-full"
              >
                <div className="absolute inset-0 bg-white blur-lg opacity-0 group-hover:opacity-10 transition-opacity duration-500" />
                <div className="relative w-full bg-white text-black font-bold py-5 rounded-2xl transition-transform active:scale-[0.98] disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-3">
                  {submitting ? (
                    <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                  ) : (
                    <>
                      <span className="uppercase tracking-[0.1em] text-sm">{isReset ? 'Send Reset Link' : 'Sign In'}</span>
                      <span className="text-lg">→</span>
                    </>
                  )}
                </div>
              </button>
            </form>

            {isReset && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => switchMode('signin')}
                  className="text-[10px] text-gray-600 hover:text-white uppercase tracking-[0.2em] font-bold transition-colors"
                >
                  Back to sign in
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="text-center mt-12 space-y-4">
          <p className="text-[9px] text-gray-800 uppercase tracking-[0.5em] font-bold">EMANUEL UNGARO SECURE ACCESS</p>
          <UngaroLogo className="h-6 opacity-20 grayscale" color="#FFFFFF" />
        </div>
      </div>
    </div>
  );
}
