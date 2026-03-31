'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ClaimForm({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() && !lastName.trim()) return;
    
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/lookup-guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId, firstName, lastName }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Invitation not found');
      }

      // Guest found! Redirect them to their personal RSVP confirmation page
      router.push(`/rsvp/${data.id}`);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleLookup} className="space-y-6">
      {error && (
        <div className="bg-red-50 text-red-500 border border-red-100 rounded-sm p-4 text-[13px] mb-6 animate-fade-up">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-2 text-left">
          <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-luxury-muted ml-0.5 font-sans">First Name</label>
          <input
            type="text"
            placeholder="ENTER FIRST NAME"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            className="w-full bg-transparent border-b border-gray-200 py-3 text-luxury-dark placeholder:text-gray-200 focus:outline-none focus:border-luxury-gold transition-all uppercase tracking-widest text-[13px] font-sans"
          />
        </div>
        <div className="space-y-2 text-left">
          <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-luxury-muted ml-0.5 font-sans">Last Name</label>
          <input
            type="text"
            placeholder="ENTER LAST NAME"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            className="w-full bg-transparent border-b border-gray-200 py-3 text-luxury-dark placeholder:text-gray-200 focus:outline-none focus:border-luxury-gold transition-all uppercase tracking-widest text-[13px] font-sans"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-luxury-dark hover:bg-black disabled:opacity-50 text-white font-medium py-5 rounded-sm transition-all mt-8 uppercase text-[11px] tracking-[0.3em] shadow-sm active:scale-[0.98] font-sans"
      >
        {loading ? 'Searching…' : 'Find My Invitation'}
      </button>
    </form>
  );
}
