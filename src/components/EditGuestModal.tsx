'use client';

import { useState, useEffect } from 'react';
import { type GuestData } from './AddGuestModal';

interface Props {
  guest: GuestData;
  onGuestUpdated: (updated: GuestData) => void;
  onClose: () => void;
}

export default function EditGuestModal({ guest, onGuestUpdated, onClose }: Props) {
  const [firstName, setFirstName] = useState(guest.firstName || '');
  const [lastName, setLastName] = useState(guest.lastName || '');
  const [email, setEmail] = useState(guest.email || '');
  const [category, setCategory] = useState(guest.category || 'Standard');
  const [portraitUrl, setPortraitUrl] = useState(guest.portraitUrl || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/update-guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestId: guest.id,
          firstName,
          lastName,
          email,
          category,
          portraitUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update guest');

      onGuestUpdated({
        ...guest,
        firstName,
        lastName,
        email,
        category,
        portraitUrl,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      <form 
        onSubmit={handleSubmit}
        className="relative w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-sm shadow-2xl overflow-hidden animate-fade-up"
      >
        <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-luxury-off-white">
          <div>
            <h3 className="font-cormorant text-2xl text-luxury-dark uppercase tracking-widest leading-none">Edit Guest Profile</h3>
            <p className="text-[10px] text-luxury-muted uppercase tracking-[0.2em] mt-2">Registry Intelligence Management</p>
          </div>
          <button type="button" onClick={onClose} className="text-luxury-muted hover:text-luxury-dark transition-colors text-xl font-light">✕</button>
        </div>

        <div className="p-10 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {error && (
            <div className="p-4 bg-red-50 border border-red-100 text-red-600 text-[11px] font-medium rounded-sm uppercase tracking-wider">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-[0.3em] font-bold text-luxury-muted ml-0.5">First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                className="w-full bg-transparent border-b border-gray-200 py-3 text-sm text-luxury-dark outline-none focus:border-luxury-gold transition-all duration-500 font-medium"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-[0.3em] font-bold text-luxury-muted ml-0.5">Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                className="w-full bg-transparent border-b border-gray-200 py-3 text-sm text-luxury-dark outline-none focus:border-luxury-gold transition-all duration-500 font-medium"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-[0.3em] font-bold text-luxury-muted ml-0.5">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-transparent border-b border-gray-200 py-3 text-sm text-luxury-dark outline-none focus:border-luxury-gold transition-all duration-500"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-[0.3em] font-bold text-luxury-muted ml-0.5">Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full bg-transparent border-b border-gray-200 py-3 text-sm text-luxury-dark outline-none focus:border-luxury-gold transition-all duration-500 uppercase tracking-widest text-[10px] font-bold"
            >
              <option value="VIP">VIP</option>
              <option value="Press">Press</option>
              <option value="Influencer">Influencer</option>
              <option value="Buyer">Buyer</option>
              <option value="Standard">Standard</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-[0.3em] font-bold text-luxury-muted ml-0.5">Portrait URL</label>
            <input
              type="text"
              value={portraitUrl}
              onChange={e => setPortraitUrl(e.target.value)}
              placeholder="https://..."
              className="w-full bg-transparent border-b border-gray-200 py-3 text-sm text-luxury-dark outline-none focus:border-luxury-gold transition-all duration-500"
            />
          </div>
        </div>

        <div className="p-8 bg-white border-t border-gray-50 flex gap-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-4 border border-gray-100 text-[11px] font-bold text-luxury-muted uppercase tracking-widest hover:bg-gray-50 transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-luxury-dark hover:bg-black disabled:opacity-50 text-white font-bold py-4 rounded-sm transition-all duration-500 text-[11px] uppercase tracking-[0.3em] flex items-center justify-center gap-2 shadow-xl"
          >
            {loading ? (
              <>
                <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Updating...
              </>
            ) : 'Update Registry'}
          </button>
        </div>
      </form>
    </div>
  );
}
