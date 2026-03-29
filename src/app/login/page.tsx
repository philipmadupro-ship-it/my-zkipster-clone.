'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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

function LoginContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Complete sign-in if this is a magic link callback
  useEffect(() => {
    if (!isMounted) return;

    if (isSignInWithEmailLink(auth, window.location.href)) {
      let storedEmail = window.localStorage.getItem('emailForSignIn');
      if (!storedEmail) {
        storedEmail = window.prompt('Please provide your email for confirmation') || '';
      }
      
      if (storedEmail) {
        signInWithEmailLink(auth, storedEmail, window.location.href)
          .then(() => {
            window.localStorage.removeItem('emailForSignIn');
            router.push('/');
          })
          .catch((err) => {
             console.error('Sign-in error:', err);
             setError(err.message);
          });
      }
    }
  }, [isMounted, router]);

  // Redirect if already signed in
  useEffect(() => {
    if (isMounted && !loading && user) {
        router.push('/');
    }
  }, [user, loading, router, isMounted]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    
    setSubmitting(true);
    setError('');
    try {
      await sendSignInLinkToEmail(auth, email, ACTION_CODE_SETTINGS);
      window.localStorage.setItem('emailForSignIn', email);
      setSent(true);
    } catch (err: unknown) {
      console.error('Send error:', err);
      setError(err instanceof Error ? err.message : 'Failed to send link');
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
          <h1 className="font-display text-5xl font-bold text-white tracking-tighter">Antgravity</h1>
          <div className="flex items-center justify-center gap-4">
             <div className="h-px w-8 bg-white/20" />
             <p className="text-[10px] text-gray-500 uppercase tracking-[0.5em] font-bold">Secure Access</p>
             <div className="h-px w-8 bg-white/20" />
          </div>
        </div>

        <div className="bg-white/[0.02] border border-white/5 backdrop-blur-3xl rounded-[3rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)] p-12">
          {sent ? (
            <div className="text-center space-y-8 py-4">
              <div className="relative inline-block">
                <div className="absolute inset-0 bg-white/20 blur-2xl rounded-full" />
                <div className="relative w-20 h-20 bg-white/[0.05] border border-white/10 rounded-3xl flex items-center justify-center text-4xl shadow-2xl">
                  ✉️
                </div>
              </div>
              
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-white tracking-tight">Check your identity</h2>
                <p className="text-gray-500 text-sm font-medium leading-relaxed max-w-xs mx-auto">
                  A magic link has been sent to <span className="text-white">{email}</span>. 
                  Please check your inbox to authenticate.
                </p>
              </div>

              <div className="pt-4">
                <button 
                  onClick={() => setSent(false)}
                  className="text-[10px] text-gray-600 hover:text-white uppercase tracking-[0.2em] font-bold transition-colors"
                >
                  Change email address
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-10">
              <div className="space-y-3">
                <h2 className="text-2xl font-bold text-white tracking-tight">System Login</h2>
                <p className="text-gray-500 text-sm font-medium">Enter your credentials to access the administrative control center.</p>
              </div>

              {error && (
                <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4 text-red-400 text-xs font-medium animate-in slide-in-from-top-2">
                  <span className="opacity-60 mr-2">Error:</span> {error}
                </div>
              )}

              <form onSubmit={handleSend} className="space-y-8">
                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-bold">Registry Email</label>
                  </div>
                  <input
                    type="email"
                    placeholder="authorized@antgravity.system"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-6 py-4 text-white placeholder-gray-700 outline-none focus:border-white/30 focus:bg-white/[0.05] transition-all duration-300"
                  />
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
                        <span className="uppercase tracking-[0.1em] text-sm">Initialize Session</span>
                        <span className="text-lg">→</span>
                      </>
                    )}
                  </div>
                </button>
              </form>
            </div>
          )}
        </div>
        
        <p className="text-center mt-12 text-[9px] text-gray-800 uppercase tracking-[0.5em] font-bold">ANTGRAVITY QUANTUM SECURITY</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
