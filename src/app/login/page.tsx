'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import UngaroLogo from '@/components/UngaroLogo';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const { user, loading, refresh } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Already signed in: go to the dashboard.
  useEffect(() => {
    if (isMounted && !loading && user) {
      router.push('/');
    }
  }, [user, loading, router, isMounted]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not sign in. Please try again.');
        return;
      }
      await refresh(); // picks up the new session; the effect above then redirects
    } catch {
      setError('Network error. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!isMounted || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

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
              <h2 className="text-2xl font-bold text-white tracking-tight">System Login</h2>
              <p className="text-gray-500 text-sm font-medium">Enter your credentials to access the guest list.</p>
            </div>

            {error && (
              <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4 text-red-400 text-xs font-medium animate-in slide-in-from-top-2">
                <span className="opacity-60 mr-2">Error:</span> {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="space-y-2">
                <label htmlFor="email" className="px-1 block text-[10px] text-gray-500 uppercase tracking-[0.2em] font-bold">Email</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  placeholder="press@ungaro.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-6 py-4 text-white placeholder-gray-700 outline-none focus:border-white/30 focus:bg-white/[0.05] transition-all duration-300"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="px-1 block text-[10px] text-gray-500 uppercase tracking-[0.2em] font-bold">Password</label>
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
                      <span className="uppercase tracking-[0.1em] text-sm">Sign In</span>
                      <span className="text-lg">→</span>
                    </>
                  )}
                </div>
              </button>
            </form>
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
