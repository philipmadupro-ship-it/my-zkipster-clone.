'use client';

import { useState } from 'react';
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
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      
      {/* Compact modal with max-h viewport constraint */}
      <form 
        onSubmit={handleSubmit}
        className="relative w-full max-w-md max-h-[90vh] bg-[#111111] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-white/5 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-xl font-bold text-white tracking-tight">Edit Guest</h3>
            <p className="text-[9px] text-gray-500 uppercase tracking-[0.2em] font-bold mt-0.5">Registry Update</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-gray-500 hover:text-white transition-colors">
            <span className="text-xl font-light">✕</span>
          </button>
        </div>

        {/* Scrollable form body */}
        <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1 min-h-0">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-xs font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[9px] uppercase tracking-widest font-bold text-gray-500">First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-white/30 transition-colors"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] uppercase tracking-widest font-bold text-gray-500">Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-white/30 transition-colors"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[9px] uppercase tracking-widest font-bold text-gray-500">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-white/30 transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[9px] uppercase tracking-widest font-bold text-gray-500">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-white/30 transition-colors appearance-none cursor-pointer"
              >
                <option value="Standard" className="bg-[#111] text-white">Standard</option>
                <option value="VIP" className="bg-[#111] text-white">VIP</option>
                <option value="Press" className="bg-[#111] text-white">Press</option>
                <option value="Influencer" className="bg-[#111] text-white">Influencer</option>
                <option value="Buyer" className="bg-[#111] text-white">Buyer</option>
                <option value="Staff" className="bg-[#111] text-white">Staff</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] uppercase tracking-widest font-bold text-gray-500">Portrait URL</label>
              <input
                type="text"
                value={portraitUrl}
                onChange={e => setPortraitUrl(e.target.value)}
                placeholder="https://..."
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-white/30 transition-colors placeholder:text-gray-700"
              />
            </div>
          </div>
        </div>

        {/* Buttons - ALWAYS pinned at bottom */}
        <div className="px-6 py-4 border-t border-white/5 flex gap-3 shrink-0 bg-[#111111]">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl border border-white/10 text-white font-bold text-[11px] uppercase tracking-widest hover:bg-white/5 transition-all active:scale-95"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-4 py-3 rounded-xl bg-white text-black font-bold text-[11px] uppercase tracking-widest hover:bg-gray-200 transition-all active:scale-95 shadow-[0_0_15px_rgba(255,255,255,0.15)] disabled:opacity-50"
          >
            {loading ? 'Updating...' : 'Update'}
          </button>
        </div>
      </form>
    </div>
  );
}
