'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

export interface GuestData {
  id: string;
  name?: string;     // Legacy
  firstName: string;
  lastName: string;
  email?: string;
  status: 'invited' | 'confirmed' | 'arrived' | 'pending' | 'accepted' | 'refused';
  qrCodeUrl: string;
  confirmedAt: null | string;
  arrivedAt: null | string;
  createdAt: any;
  ownerEmail: string;
  campaignId: string;
  category?: string;
  extraFields?: Record<string, string>;
  portraitUrl?: string;
  parentId?: string;
}

interface Props {
  campaignId: string;
  guests: GuestData[];
  onGuestAdded: (guest: GuestData) => void;
  onClose: () => void;
}

export default function AddGuestModal({ campaignId, guests, onGuestAdded, onClose }: Props) {
  const { user } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState('Standard');
  const [portraitUrl, setPortraitUrl] = useState('');
  const [parentId, setParentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setError('First and last name are required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/add-guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          firstName: firstName.trim(), 
          lastName: lastName.trim(), 
          email: email.trim(), 
          category,
          campaignId, 
          ownerEmail: user?.email?.toLowerCase(),
          portraitUrl: portraitUrl.trim(),
          parentId: parentId
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add guest');
      onGuestAdded(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal container: max-h ensures it never overflows the viewport */}
      <div className="relative w-full max-w-md max-h-[90vh] bg-[#111111] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header - fixed at top */}
        <div className="px-6 pt-6 pb-4 border-b border-white/5 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Register Guest</h2>
            <p className="text-[9px] text-gray-500 uppercase tracking-[0.2em] font-bold mt-0.5">Manual Enrollment</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-white transition-colors">
            <span className="text-xl font-light">✕</span>
          </button>
        </div>

        {/* Scrollable form body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-xs font-medium">
                {error}
              </div>
            )}
            
            {/* Name row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[9px] uppercase tracking-widest font-bold text-gray-500">First Name</label>
                <input
                  autoFocus
                  required
                  type="text"
                  placeholder="John"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-white/30 transition-colors placeholder:text-gray-700"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] uppercase tracking-widest font-bold text-gray-500">Last Name</label>
                <input
                  required
                  type="text"
                  placeholder="Doe"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-white/30 transition-colors placeholder:text-gray-700"
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1">
              <label className="text-[9px] uppercase tracking-widest font-bold text-gray-500">Email Address</label>
              <input
                type="email"
                placeholder="john@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-white/30 transition-colors placeholder:text-gray-700"
              />
            </div>

            {/* Category + Portrait row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[9px] uppercase tracking-widest font-bold text-gray-500">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-white/30 transition-colors appearance-none cursor-pointer"
                >
                  <option value="Standard" className="bg-[#111] text-white">Standard</option>
                  <option value="VIP" className="bg-[#111] text-white">VIP</option>
                  <option value="Press" className="bg-[#111] text-white">Press</option>
                  <option value="Staff" className="bg-[#111] text-white">Staff</option>
                  <option value="Speaker" className="bg-[#111] text-white">Speaker</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] uppercase tracking-widest font-bold text-gray-500">Plus-One of</label>
                <select
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-white/30 transition-colors appearance-none cursor-pointer"
                >
                  <option value="" className="bg-[#111] text-gray-500">None</option>
                  {guests.filter(g => !g.parentId).map(g => (
                    <option key={g.id} value={g.id} className="bg-[#111] text-white">
                      {g.firstName} {g.lastName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Portrait URL - optional */}
            <div className="space-y-1">
              <label className="text-[9px] uppercase tracking-widest font-bold text-gray-500">Portrait URL <span className="text-gray-700">(optional)</span></label>
              <input
                type="url"
                placeholder="https://example.com/photo.jpg"
                value={portraitUrl}
                onChange={(e) => setPortraitUrl(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-white/30 transition-colors placeholder:text-gray-700"
              />
            </div>
          </div>

          {/* Buttons - ALWAYS pinned at bottom, never scroll away */}
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
              {loading ? 'Processing...' : 'Register'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
