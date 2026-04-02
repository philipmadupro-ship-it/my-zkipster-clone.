'use client';

import { useState } from 'react';
import LuxuryInvitation from './LuxuryInvitation';

interface Guest {
  id: string;
  name: string;
  email: string;
  status: string;
  qrCodeUrl: string;
  seatNumber?: string;
  campaignId?: string;
}

interface Campaign {
  id: string;
  name: string;
  eventDate?: string;
  eventTime?: string;
  eventVenue?: string;
}

export default function LuxuryRSVPClient({ guest, campaign }: { guest: Guest, campaign: Campaign | null }) {
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

  // If confirmed, show the elegant invitation view
  if (state === 'confirmed') {
    return <LuxuryInvitation guest={{ ...guest, name: name || guest.name, status: 'confirmed', qrCodeUrl }} campaign={campaign} />;
  }

  return (
    <div className="min-h-screen bg-luxury-off-white flex flex-col items-center justify-center p-6 sm:p-12 font-sans text-luxury-dark selection:bg-luxury-gold selection:text-white relative">
      {/* Background Gradient */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(255,251,240,1)_0%,_rgba(250,250,250,1)_100%)] pointer-events-none" />
      
      <main className="relative w-full max-w-[600px] bg-white shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-gray-100 rounded-sm overflow-hidden animate-fade-up">
        <div className="p-12 sm:p-16 flex flex-col items-center text-center">
          
          {/* Header Branding */}
          <header className="mb-16 animate-fade-up delay-100">
            <h1 className="font-cormorant text-4xl sm:text-5xl uppercase tracking-[0.2em] text-luxury-gold font-light">
              Emanuel Ungaro
            </h1>
          </header>

          {state === 'idle' && (
            <div className="w-full space-y-12 animate-fade-up delay-200">
              <section className="space-y-4">
                <h2 className="text-2xl font-medium text-luxury-dark">
                  Confirm Attendance
                </h2>
                <p className="text-luxury-muted leading-relaxed max-w-[400px] mx-auto text-[14px]">
                  {guest.name 
                    ? `Welcome, ${guest.name}. Please confirm your attendance details to generate your digital access pass for the FW26 runway show.`
                    : 'Welcome. Please provide your full name to synchronize with the guest registry and generate your exclusive entry credentials.'}
                </p>
              </section>

              <form onSubmit={handleConfirm} className="space-y-10 text-left">
                <div className="space-y-3">
                  <label className="text-[10px] uppercase tracking-[0.3em] font-bold text-luxury-muted ml-0.5">Guest Identification</label>
                  <input
                    type="text"
                    placeholder="ENTER FULL NAME"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    className="w-full bg-transparent border-b border-gray-200 py-4 text-lg text-luxury-dark outline-none focus:border-luxury-gold transition-all duration-500 placeholder:text-gray-300 font-light tracking-wide uppercase"
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-luxury-dark text-white font-medium py-5 rounded-sm transition-all duration-500 hover:bg-black active:scale-[0.98] uppercase text-[11px] tracking-[0.3em] shadow-sm"
                  >
                    Confirm Registration
                  </button>
                  <button
                    type="button"
                    onClick={() => setState('error')}
                    className="px-8 py-5 rounded-sm border border-gray-100 text-luxury-muted font-medium text-[11px] uppercase tracking-[0.3em] hover:text-luxury-dark hover:bg-luxury-off-white transition-all"
                  >
                    Decline
                  </button>
                </div>
              </form>
            </div>
          )}

          {state === 'loading' && (
            <div className="py-24 text-center space-y-8 animate-fade-up">
              <div className="w-12 h-12 border border-luxury-gold border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-[10px] text-luxury-muted uppercase tracking-[0.4em] font-light animate-pulse">Syncing with Registry...</p>
            </div>
          )}

          {state === 'error' && (
            <div className="py-24 text-center space-y-10 animate-fade-up">
              <p className="text-luxury-dark text-[15px] font-light leading-relaxed max-w-[350px] mx-auto">
                {error || 'The system could not finalize your registration at this time. Please contact event staff or try again later.'}
              </p>
              <button 
                onClick={() => { setState('idle'); setError(''); }} 
                className="text-[10px] font-bold text-luxury-gold uppercase tracking-[0.3em] border-b border-luxury-gold/30 hover:border-luxury-gold transition-all pb-1"
              >
                Return to registration
              </button>
            </div>
          )}

        </div>
        
        {/* Footer with Brand Logo */}
        <footer className="w-full border-t border-gray-100 py-10 px-12 text-center space-y-4 bg-white shrink-0">
          <p className="text-[9px] font-light uppercase tracking-[0.4em] text-luxury-muted">Event communications powered by</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ungaro-logo.svg" alt="Emanuel Ungaro Paris" className="h-14 mx-auto opacity-60" />
        </footer>
      </main>
    </div>
  );
}
