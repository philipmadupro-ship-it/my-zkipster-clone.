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
  seatNumber?: string;
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
  const [seatNumber, setSeatNumber] = useState('');
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
          seatNumber: seatNumber.trim(),
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
      <div className="absolute inset-0 bg-black/60 backdrop-blur-2xl transition-opacity animate-in fade-in duration-500" onClick={onClose} />
      
      <div className="relative w-full max-w-xl bg-white/[0.03] border border-white/5 backdrop-blur-3xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500">
        <div className="p-10">
          <div className="flex justify-between items-start mb-10">
            <div className="space-y-1">
              <h2 className="text-3xl font-display font-bold text-white tracking-tight">Register Guest</h2>
              <p className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-bold">Manual Enrollment System</p>
            </div>
            <button onClick={onClose} className="p-2 text-gray-600 hover:text-white transition-colors">
              <span className="text-2xl font-light">✕</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-xs font-medium">
                {error}
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest font-bold text-gray-500 ml-1">First Name</label>
                <input
                  autoFocus
                  required
                  type="text"
                  placeholder="e.g. John"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full bg-transparent border-b border-white/10 py-3 text-white outline-none focus:border-white transition-colors placeholder:text-gray-800"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest font-bold text-gray-500 ml-1">Last Name</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Doe"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full bg-transparent border-b border-white/10 py-3 text-white outline-none focus:border-white transition-colors placeholder:text-gray-800"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest font-bold text-gray-500 ml-1">Email Address</label>
              <input
                type="email"
                placeholder="e.g. john@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent border-b border-white/10 py-3 text-white outline-none focus:border-white transition-colors placeholder:text-gray-800"
              />
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest font-bold text-gray-500 ml-1 font-sans">Profile Category / VIP Status</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-transparent border-b border-white/10 py-3 text-white outline-none focus:border-white transition-colors appearance-none cursor-pointer text-sm"
                >
                  <option value="Standard" className="bg-black text-white">Standard Guest</option>
                  <option value="VIP" className="bg-black text-white">VIP Profile</option>
                  <option value="Press" className="bg-black text-white">Press / Media</option>
                  <option value="Staff" className="bg-black text-white">Event Staff</option>
                  <option value="Speaker" className="bg-black text-white">Guest Speaker</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest font-bold text-gray-500 ml-1 font-sans">Seat Number</label>
                <input
                  type="text"
                  placeholder="e.g. A-12"
                  value={seatNumber}
                  onChange={(e) => setSeatNumber(e.target.value)}
                  className="w-full bg-transparent border-b border-white/10 py-3 text-white outline-none focus:border-white transition-colors placeholder:text-gray-800 text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest font-bold text-gray-500 ml-1">Portrait Image URL (PR Recognition)</label>
              <input
                type="url"
                placeholder="https://example.com/portrait.jpg"
                value={portraitUrl}
                onChange={(e) => setPortraitUrl(e.target.value)}
                className="w-full bg-transparent border-b border-white/10 py-3 text-white outline-none focus:border-white transition-colors placeholder:text-gray-800 text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest font-bold text-gray-500 ml-1">Relationship (Plus-One of...)</label>
              <select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="w-full bg-transparent border-b border-white/10 py-3 text-white outline-none focus:border-white transition-colors appearance-none cursor-pointer text-sm"
              >
                <option value="" className="bg-black text-gray-500">None / Principal Guest</option>
                {guests.filter(g => !g.parentId).map(g => (
                  <option key={g.id} value={g.id} className="bg-black text-white">
                    {g.firstName} {g.lastName}
                  </option>
                ))}
              </select>
              <p className="text-[9px] text-gray-600 mt-1 italic">Link this guest as a companion or plus-one to a principal attendee.</p>
            </div>

            <div className="flex gap-4 pt-6">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-4 rounded-2xl border border-white/10 text-white font-bold text-[11px] uppercase tracking-widest hover:bg-white/5 transition-all active:scale-95"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-4 rounded-2xl bg-white text-black font-bold text-[11px] uppercase tracking-widest hover:bg-gray-200 transition-all active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.2)] disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Complete Registry'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
