'use client';

import { useState } from 'react';

interface Guest {
  id: string;
  name: string;
  email: string;
  status: string;
  qrCodeUrl: string;
  rsvpLink: string;
}

export default function RSVPClient({ guest }: { guest: Guest }) {
  const [name, setName] = useState(guest.name || '');
  const [state, setState] = useState<'idle' | 'loading' | 'confirmed' | 'error'>(
    guest.status !== 'invited' ? 'confirmed' : 'idle'
  );
  const [qrCodeUrl, setQrCodeUrl] = useState(guest.qrCodeUrl);
  const [error, setError] = useState('');

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setState('loading');
    try {
      const res = await fetch('/api/confirm-rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestId: guest.id, name }),
      });
      const data = await res.json();
      if (res.status === 409) {
        // already confirmed — just show QR
        setQrCodeUrl(data.qrCodeUrl);
        setState('confirmed');
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Failed to confirm');
      setQrCodeUrl(data.qrCodeUrl);
      setState('confirmed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setState('error');
    }
  }

  const isAlreadyConfirmed = guest.status !== 'invited';

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6 selection:bg-white selection:text-black">
      {/* Dynamic Background Grain/Gradient */}
      <div className="fixed inset-0 pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-white/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-white/5 blur-[120px] rounded-full" />
      </div>

      <div className="w-full max-w-xl relative animate-in fade-in zoom-in-95 duration-1000">
        <div className="text-center mb-16">
          <p className="text-[10px] text-gray-700 uppercase tracking-[0.4em] font-bold mb-4">Official Invitation</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ungaro-logo-white.png" alt="emanuel ungaro" className="h-10 sm:h-12 mx-auto mb-2" />
          <div className="h-px w-12 bg-white/20 mx-auto" />
        </div>

        <div className="bg-white/[0.02] border border-white/5 backdrop-blur-3xl rounded-[3rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)] transition-all duration-700">
          <div className="p-12 md:p-16">
            {/* IDLE: RSVP Form */}
            {state === 'idle' && (
              <div className="space-y-10 animate-in slide-in-from-bottom-6 duration-700">
                <div className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-white tracking-tight">Confirm Attendance</h2>
                  <p className="text-gray-500 text-sm leading-relaxed font-medium">
                     {guest.name 
                        ? `Welcome, ${guest.name}. We look forward to your presence. Please confirm your guest details to generate your digital access pass.`
                        : 'Welcome. Please provide your full name to synchronize with the guest registry and generate your exclusive entry credentials.'}
                  </p>
                </div>

                <form onSubmit={handleConfirm} className="space-y-8">
                  <div className="space-y-3">
                    <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-gray-500 ml-1">Guest Identification</label>
                    <input
                      type="text"
                      placeholder="Enter Full Name"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      required
                      className="w-full bg-transparent border-b border-white/10 py-4 text-xl text-white outline-none focus:border-white transition-all duration-500 placeholder:text-gray-900 font-display font-bold tracking-tight"
                    />
                  </div>

                  <div className="flex flex-col md:flex-row gap-6 pt-4">
                     <button
                        type="submit"
                        className="flex-1 bg-white text-black font-bold py-5 rounded-2xl transition-all duration-500 hover:bg-gray-200 active:scale-[0.98] shadow-[0_0_40px_rgba(255,255,255,0.15)] uppercase text-[11px] tracking-[0.2em]"
                      >
                        Confirm Registration
                      </button>
                      <button
                        type="button"
                        onClick={() => setState('error')}
                        className="px-8 py-5 rounded-2xl border border-white/5 text-gray-600 font-bold text-[11px] uppercase tracking-[0.2em] hover:text-white hover:bg-white/5 transition-all"
                      >
                        Decline
                      </button>
                  </div>
                </form>
              </div>
            )}

            {/* LOADING STATE */}
            {state === 'loading' && (
              <div className="py-24 text-center space-y-8">
                <div className="relative inline-block">
                  <div className="w-16 h-16 border-2 border-white/5 border-t-white rounded-full animate-spin mx-auto" />
                  <div className="absolute inset-0 bg-white/5 blur-xl animate-pulse rounded-full" />
                </div>
                <p className="text-[10px] text-gray-500 uppercase tracking-[0.3em] font-bold animate-pulse">Syncing with Registry...</p>
              </div>
            )}

            {/* CONFIRMED: QR CODE DISPLAY */}
            {state === 'confirmed' && (
              <div className="text-center space-y-10 animate-in zoom-in-95 duration-1000">
                <div className="space-y-4">
                  <div className="w-12 h-12 bg-white/10 border border-white/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="text-white">✓</span>
                  </div>
                  <h2 className="text-3xl font-display font-bold text-white tracking-tight">Access Granted</h2>
                  <p className="text-gray-500 text-sm font-medium px-4">
                    Your credentials have been verified. Present this code upon arrival for priority entrance.
                  </p>
                </div>

                <div className="relative group">
                  <div className="absolute inset-[-20px] bg-white/[0.03] blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000 rounded-full" />
                  <div className="relative inline-block bg-white p-6 rounded-[2.5rem] shadow-[0_0_60px_rgba(255,255,255,0.1)] group-hover:scale-105 transition-transform duration-700">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                      src={qrCodeUrl} 
                      alt="Encrypted Entry Key" 
                      width={220} 
                      height={220} 
                      className="block mix-blend-multiply" 
                    />
                  </div>
                </div>

                <div className="pt-6 space-y-2">
                   <p className="text-[10px] text-white font-mono uppercase tracking-[0.2em]">{guest.email || 'GUEST-ID-SECURED'}</p>
                   <p className="text-[9px] text-gray-700 font-mono tracking-tighter">AUTHENTICATED EVENT PASSPORT — DO NOT SHARE</p>
                </div>
                
                <p className="text-[10px] text-gray-600 italic tracking-tight pt-4">Screenshot this pass for offline utility.</p>
              </div>
            )}

            {/* ERROR STATE */}
            {state === 'error' && (
              <div className="py-12 text-center space-y-8 animate-in fade-in duration-500">
                <p className="text-gray-400 text-sm font-medium leading-relaxed">
                  {error || 'The system could not finalize your registration at this time. Please contact event staff or try again later.'}
                </p>
                <button 
                  onClick={() => { setState('idle'); setError(''); }} 
                  className="text-[10px] font-bold text-white uppercase tracking-[0.3em] border-b border-white/20 hover:border-white transition-all pb-1"
                >
                  Return to registration
                </button>
              </div>
            )}
          </div>
        </div>
        
        <div className="text-center mt-12 space-y-2">
          <p className="text-[9px] text-gray-800 uppercase tracking-[0.5em] font-bold">EMANUEL UNGARO EVENT SYSTEM</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ungaro-logo-white.png" alt="emanuel ungaro" className="h-3 mx-auto opacity-20 grayscale" />
        </div>
      </div>
    </div>
  );
}
