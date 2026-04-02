'use client';

import React from 'react';
import UngaroLogo from './UngaroLogo';

interface Guest {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
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
  language?: 'en' | 'fr';
}

export default function LuxuryInvitation({ guest, campaign }: { guest: Guest | null, campaign: Campaign | null }) {
  const name = guest?.name || 'Yann';
  
  const isFr = campaign?.language === 'fr';
  const t = {
    greeting: isFr ? 'Cher/Chère' : 'Dear',
    confirmMsg: isFr 
      ? `Nous sommes ravis de confirmer votre invitation à l'événement `
      : `We are delighted to confirm your invitation to the `,
    dateTimeText: isFr ? 'Date & Heure:' : 'Date & Time:',
    venueText: isFr ? 'Lieu:' : 'Venue:',
    atText: isFr ? 'à' : 'at',
    guestSelectionText: isFr ? 'SÉLECTION DES INVITÉS' : 'GUEST SELECTION',
    poweredBy: isFr ? 'Communications événementielles par' : 'Event communications powered by',
    qrInst: isFr ? 'Veuillez présenter le code QR ci-joint à l\'entrée.' : 'Please present the QR code attached to this email at the entrance to check in.',
    changesMsg: isFr ? 'Pour toute modification de votre réservation, veuillez nous en informer à ' : 'For attendance changes, please notify us at ',
    clickHere: isFr ? 'Cliquez ici' : 'Click here',
    toUnsub: isFr ? 'pour vous désabonner' : 'to unsubscribe'
  };

  return (
    <div className="min-h-screen bg-luxury-off-white flex flex-col items-center justify-center p-6 sm:p-12 font-sans text-luxury-dark selection:bg-luxury-gold selection:text-white relative">
      {/* Background Gradient */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(255,251,240,1)_0%,_rgba(250,250,250,1)_100%)] pointer-events-none" />
      
      <main className="relative w-full max-w-[600px] bg-white shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-gray-100 rounded-sm overflow-hidden animate-fade-up">
        <div className="p-12 sm:p-16 flex flex-col items-center text-center">
          
          {/* Header Branding */}
          <header className="mb-16 animate-fade-up delay-100">
            <UngaroLogo className="h-14 sm:h-16" color="#000000" />
          </header>

          {/* Greeting & Message */}
          <section className="space-y-6 mb-12 animate-fade-up delay-200">
            <h2 className="text-2xl font-medium text-luxury-dark">
              {t.greeting} {guest?.firstName && guest?.lastName ? `${guest.firstName} ${guest.lastName}` : name.split(' ').filter((v, i, a) => !a.some((x, j) => j < i && x.toLowerCase() === v.toLowerCase())).join(' ')},
            </h2>
            <p className="text-luxury-muted leading-relaxed max-w-[400px] mx-auto text-[15px]">
              {t.confirmMsg} <span className="text-luxury-dark font-medium border-b border-luxury-gold/30 pb-0.5 tracking-tighter">{campaign?.name || 'Exclusive Fashion Event'}</span>.
            </p>
          </section>

          {/* Event Details Box */}
          <section className="w-full bg-luxury-off-white border-l-[3px] border-luxury-gold p-8 text-left space-y-4 mb-12 animate-fade-up delay-300">
            <div className="flex flex-col sm:flex-row sm:gap-2">
              <span className="text-[11px] font-bold uppercase tracking-widest text-luxury-dark w-28 shrink-0">{t.dateTimeText}</span>
              <span className="text-[14px] text-luxury-dark">
                {campaign?.eventDate || 'Date TBD'} {t.atText} {campaign?.eventTime || 'Time TBD'}.
              </span>
            </div>
            <div className="flex flex-col sm:flex-row sm:gap-2">
              <span className="text-[11px] font-bold uppercase tracking-widest text-luxury-dark w-28 shrink-0">{t.venueText}</span>
              <span className="text-[14px] text-luxury-dark">{campaign?.eventVenue || 'Venue TBD'}</span>
            </div>
          </section>

          {/* QR Code Section */}
          <section className="flex flex-col items-center space-y-8 animate-fade-up delay-400">
            <div className="relative group">
              <div className="absolute -inset-4 border border-gray-100 rounded-sm opacity-50 group-hover:opacity-100 transition-opacity duration-700" />
              <div className="relative bg-white p-4 border border-gray-200">
                {guest?.qrCodeUrl ? (
                   /* eslint-disable-next-line @next/next/no-img-element */
                   <img 
                    src={guest.qrCodeUrl} 
                    alt="Entry QR Code" 
                    className="w-48 h-48 sm:w-56 sm:h-56 filter grayscale hover:grayscale-0 transition-all duration-700" 
                  />
                ) : (
                  <div className="w-48 h-48 sm:w-56 sm:h-56 bg-gray-50 flex items-center justify-center text-luxury-muted text-[10px] uppercase tracking-widest">
                    QR Code Placeholder
                  </div>
                )}
              </div>
            </div>
            
            <div className="space-y-4 max-w-[380px]">
              <p className="text-[13px] text-luxury-dark leading-relaxed">
                {t.qrInst}
              </p>
              <p className="text-[13px] text-luxury-muted italic text-center">
                {t.changesMsg} <span className="underline">pressoffice@ungaro.com</span>
              </p>
            </div>
          </section>

        </div>
        
        {/* Footer with Brand Logo */}
        <footer className="w-full border-t border-gray-100 py-10 px-12 text-center space-y-6 bg-white animate-fade-up delay-500">
          <div className="flex items-baseline justify-center gap-1">
            <a href="#" className="text-blue-600 underline text-sm hover:text-blue-800 transition-colors">{t.clickHere}</a>
            <span className="text-luxury-muted text-sm font-light">{t.toUnsub}</span>
          </div>
          
          <div className="pt-4 space-y-3">
            <p className="text-[9px] uppercase tracking-[0.4em] text-gray-400 font-light">{t.poweredBy}</p>
            <UngaroLogo className="h-10 opacity-70" color="#000000" />
          </div>
        </footer>
      </main>
    </div>
  );
}
