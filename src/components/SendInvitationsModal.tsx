'use client';

import { useState } from 'react';
import { type GuestData } from './AddGuestModal';

interface Props {
  campaignId: string;
  guests: GuestData[];
  onClose: () => void;
  onSent: (success: number, failed: number) => void;
}

export default function SendInvitationsModal({ campaignId, guests, onClose, onSent }: Props) {
  const [subject, setSubject] = useState('Exclusive Invitation: Emanuel Ungaro FW26');
  const [customMessage, setCustomMessage] = useState(
    'It is our distinct pleasure to invite you to the Emanuel Ungaro Fall/Winter 26 Runway Show. Please find your personal digital invitation and access pass below.'
  );
  const [target, setTarget] = useState<'all' | 'uninvited'>('uninvited');
  const [sending, setSending] = useState(false);
  const [currentBatch, setCurrentBatch] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);
  const [sentCount, setSentCount] = useState(0);
  const [error, setError] = useState('');

  const targetGuests = target === 'all' 
    ? guests 
    : guests.filter(g => g.status === 'pending' || g.status === 'invited');

  async function handleSend() {
    if (targetGuests.length === 0) {
      setError('No guests match the selected criteria.');
      return;
    }

    setSending(true);
    setError('');
    setSentCount(0);
    
    const BATCH_SIZE = 100;
    const guestIds = targetGuests.map(g => g.id);
    const chunks: string[][] = [];
    
    for (let i = 0; i < guestIds.length; i += BATCH_SIZE) {
      chunks.push(guestIds.slice(i, i + BATCH_SIZE));
    }
    
    setTotalBatches(chunks.length);
    let totalSuccess = 0;
    let totalFailed = 0;

    try {
      for (let i = 0; i < chunks.length; i++) {
        setCurrentBatch(i + 1);
        
        const res = await fetch('/api/send-bulk-invitation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            campaignId,
            guestIds: chunks[i],
            subject,
            customMessage,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Failed to dispatch batch ${i + 1}`);
        
        totalSuccess += data.count || 0;
        totalFailed += data.failed || 0;
        setSentCount(totalSuccess);
      }

      onSent(totalSuccess, totalFailed);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSending(false);
      setCurrentBatch(0);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white rounded-sm shadow-2xl overflow-hidden animate-fade-up">
        
        {/* Header */}
        <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-luxury-off-white">
          <div>
            <h3 className="font-cormorant text-2xl text-luxury-dark uppercase tracking-widest leading-none">Couture Dispatch</h3>
            <p className="text-[10px] text-luxury-muted uppercase tracking-[0.2em] mt-2">Bulk Invitation Management</p>
          </div>
          <button onClick={onClose} className="text-luxury-muted hover:text-luxury-dark transition-colors text-xl font-light">✕</button>
        </div>

        <div className="p-10 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
          
          {/* Target Selection */}
          <div className="space-y-4">
            <label className="text-[10px] uppercase tracking-[0.3em] font-bold text-luxury-muted">Target Audience</label>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setTarget('uninvited')}
                className={`py-4 px-6 rounded-sm border text-[11px] font-bold uppercase tracking-widest transition-all duration-500 ${
                  target === 'uninvited' 
                    ? 'bg-luxury-dark text-white border-luxury-dark' 
                    : 'bg-white text-luxury-muted border-gray-100 hover:border-gray-300'
                }`}
              >
                Pending Only ({guests.filter(g => g.status === 'pending' || g.status === 'invited').length})
              </button>
              <button
                onClick={() => setTarget('all')}
                className={`py-4 px-6 rounded-sm border text-[11px] font-bold uppercase tracking-widest transition-all duration-500 ${
                  target === 'all' 
                    ? 'bg-luxury-dark text-white border-luxury-dark' 
                    : 'bg-white text-luxury-muted border-gray-100 hover:border-gray-300'
                }`}
              >
                All Guests ({guests.length})
              </button>
            </div>
          </div>

          {/* Subject */}
          <div className="space-y-3">
            <label className="text-[10px] uppercase tracking-[0.3em] font-bold text-luxury-muted ml-0.5 text-left block">Email Subject</label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full bg-transparent border-b border-gray-200 py-3 text-sm text-luxury-dark outline-none focus:border-luxury-gold transition-all duration-500 placeholder:text-gray-300"
            />
          </div>

          {/* Custom Message */}
          <div className="space-y-3">
            <label className="text-[10px] uppercase tracking-[0.3em] font-bold text-luxury-muted ml-0.5 text-left block">Personalized Narrative</label>
            <textarea
              value={customMessage}
              onChange={e => setCustomMessage(e.target.value)}
              rows={4}
              className="w-full bg-transparent border border-gray-100 p-4 text-sm text-luxury-dark outline-none focus:border-luxury-gold transition-all duration-500 placeholder:text-gray-300 leading-relaxed rounded-sm"
              placeholder="Enter your custom invitation message..."
            />
          </div>

          {/* Link Preview */}
          <div className="bg-luxury-off-white/50 p-6 rounded-sm border border-gray-50 flex items-start gap-4">
             <div className="w-8 h-8 rounded-full bg-luxury-gold/10 flex items-center justify-center text-luxury-gold shrink-0">
               <span className="text-xs">🔗</span>
             </div>
             <div className="space-y-1">
               <p className="text-[10px] font-bold text-luxury-dark uppercase tracking-widest">Digital Link Inclusion</p>
               <p className="text-[10px] text-luxury-muted italic">Each guest will receive their unique [Personal RSVP Link] automatically at the end of the message.</p>
             </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-100 text-red-600 text-[11px] font-medium rounded-sm uppercase tracking-wider">
              {error}
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="p-8 bg-white border-t border-gray-50">
          <button
            onClick={handleSend}
            disabled={sending || targetGuests.length === 0}
            className="w-full bg-luxury-dark hover:bg-black disabled:opacity-50 text-white font-bold py-5 rounded-sm transition-all duration-500 text-[12px] uppercase tracking-[0.4em] shadow-xl active:scale-95 flex items-center justify-center gap-3"
          >
            {sending ? (
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Dispatching Wave {currentBatch} of {totalBatches}...</span>
                </div>
                <span className="text-[10px] opacity-60 font-normal lowercase tracking-widest">
                  ({sentCount} / {targetGuests.length} Delivered)
                </span>
              </div>
            ) : (
              `Send Invitations to ${targetGuests.length} Guests`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
