'use client';

import { useState } from 'react';
import { authedFetch } from '@/lib/api-client';
import { type GuestData } from './AddGuestModal';
import { DEFAULT_TAGS, MAX_NOTES_LENGTH, MAX_TAG_LENGTH } from '@/lib/guest-fields';
import { displayName, resolveHosts } from '@/lib/guest-list';

interface Props {
  guest: GuestData;
  /** The campaign's guests, used for tag suggestions and the "plus-one of" list. */
  guests?: GuestData[];
  onGuestUpdated: (updated: GuestData) => void;
  onClose: () => void;
}

export default function EditGuestModal({ guest, guests = [], onGuestUpdated, onClose }: Props) {
  const [firstName, setFirstName] = useState(guest.firstName || '');
  const [lastName, setLastName] = useState(guest.lastName || '');
  const [email, setEmail] = useState(guest.email || '');
  const [category, setCategory] = useState(guest.category || 'Standard');
  const [portraitUrl, setPortraitUrl] = useState(guest.portraitUrl || '');
  const [notes, setNotes] = useState(guest.notes || '');
  // The host this guest is a plus-one of (older imports stored a name, so work out the real guest).
  const initialParent = resolveHosts([guest, ...guests.filter((g) => g.id !== guest.id)]).get(guest.id)?.id ?? '';
  const [parentId, setParentId] = useState(initialParent);
  const tagSuggestions = Array.from(new Set([...DEFAULT_TAGS, ...guests.map((g) => g.category).filter((t): t is string => !!t)]));
  const hostChoices = guests.filter((g) => g.id !== guest.id && g.parentId !== guest.id);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await authedFetch('/api/update-guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestId: guest.id,
          firstName,
          lastName,
          email,
          category,
          portraitUrl,
          notes,
          // Only sent when changed, so an unlinked older plus-one isn't wiped by an unrelated edit.
          ...(parentId !== initialParent ? { parentId } : {}),
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
        notes,
        ...(parentId !== initialParent ? { parentId } : {}),
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
              <label className="text-[9px] uppercase tracking-widest font-bold text-gray-500">Tag</label>
              <input
                list="guest-tags"
                type="text"
                maxLength={MAX_TAG_LENGTH}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Standard"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-white/30 transition-colors placeholder:text-gray-700"
              />
              <datalist id="guest-tags">
                {tagSuggestions.map((t) => <option key={t} value={t} />)}
              </datalist>
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

          <div className="space-y-1">
            <label className="text-[9px] uppercase tracking-widest font-bold text-gray-500">Plus-one of</label>
            <select
              value={parentId}
              onChange={e => setParentId(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-white/30 transition-colors appearance-none cursor-pointer"
            >
              <option value="" className="bg-[#111] text-gray-500">None</option>
              {hostChoices.map(g => (
                <option key={g.id} value={g.id} className="bg-[#111] text-white">{displayName(g)}</option>
              ))}
            </select>
          </div>

            {/* Notes - shown at the door */}
            <div className="space-y-1">
              <label className="text-[9px] uppercase tracking-widest font-bold text-gray-500">Notes <span className="text-gray-700">(shown at the door)</span></label>
              <textarea
                rows={2}
                maxLength={MAX_NOTES_LENGTH}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. seat near the front"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-white/30 transition-colors placeholder:text-gray-700 resize-none"
              />
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
