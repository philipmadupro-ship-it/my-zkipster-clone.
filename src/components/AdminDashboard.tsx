'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import dynamic from 'next/dynamic';
import { type GuestData } from './AddGuestModal';

const AddGuestModal = dynamic(() => import('./AddGuestModal'), { ssr: false });
const ImportGuestsModal = dynamic(() => import('./ImportGuestsModal'), { ssr: false });
const LiveArrivalFeed = dynamic(() => import('./LiveArrivalFeed'), { ssr: false });
const ArrivalAnalytics = dynamic(() => import('./ArrivalAnalytics'), { ssr: false });
const QRScanner = dynamic(() => import('./QRScanner'), { ssr: false });
const SendInvitationsModal = dynamic(() => import('./SendInvitationsModal'), { ssr: false });
const EditGuestModal = dynamic(() => import('./EditGuestModal'), { ssr: false });

export interface CampaignData {
  id: string;
  name: string;
  ownerEmail: string;
  slug?: string;
  eventDate?: string;
  eventTime?: string;
  eventVenue?: string;
  createdAt?: any;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending: { label: 'Invited', className: 'bg-gray-500/20 text-gray-300 border-gray-600' },
  invited: { label: 'Invited', className: 'bg-gray-500/20 text-gray-300 border-gray-600' },
  confirmed: { label: 'Confirmed', className: 'bg-amber-500/20 text-amber-300 border-amber-600' },
  accepted: { label: 'Accepted', className: 'bg-amber-500/20 text-amber-300 border-amber-600' },
  arrived: { label: 'Arrived', className: 'bg-emerald-500/20 text-emerald-300 border-emerald-600' },
  refused: { label: 'Refused', className: 'bg-red-500/20 text-red-300 border-red-600' },
};

export default function AdminDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  
  const [campaigns, setCampaigns] = useState<CampaignData[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignData | null>(null);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventTime, setNewEventTime] = useState('');
  const [newEventVenue, setNewEventVenue] = useState('');
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);

  const [guests, setGuests] = useState<GuestData[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingGuest, setEditingGuest] = useState<GuestData | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    setOrigin(window.location.origin);
  }, []);

  // Auth guard
  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  // Realtime Firestore listener for CAMPAIGNS
  useEffect(() => {
    if (!user?.email) return;

    const email = user.email.toLowerCase().trim();
    console.log('[Dashboard] Subscribing to campaigns for:', email);
    
    const q = query(
      collection(db, 'campaigns'),
      where('ownerEmail', '==', email)
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ ...(d.data() as Omit<CampaignData, 'id'>), id: d.id }));
      // Stable client-side sort: newest first
      data.sort((a: any, b: any) => {
          const timeA = a.createdAt?.toMillis?.() || (a.createdAt instanceof Date ? a.createdAt.getTime() : 0);
          const timeB = b.createdAt?.toMillis?.() || (b.createdAt instanceof Date ? b.createdAt.getTime() : 0);
          return timeB - timeA;
      });
      console.log('[Dashboard] Campaigns update:', data.length);
      setCampaigns(data);
      
      // Auto-select first campaign if none selected
      if (data.length > 0 && !selectedCampaign) {
          setSelectedCampaign(data[0]); 
      }
      setDbError(null);
    }, (err) => {
      console.error('[Dashboard] Campaigns error:', err);
      setDbError(`Firebase Error (Campaigns): ${err.message}`);
    });
    return () => unsubscribe();
  }, [user?.email]);

  // Realtime Firestore listener for GUESTS
  useEffect(() => {
    if (!user?.email || !selectedCampaign?.id) {
        setGuests([]);
        return;
    }

    // Prevent 'ghosting' by clearing guest data immediately on campaign change
    setGuests([]);

    const email = user.email.toLowerCase().trim();
    console.log('[Dashboard] Subscribing to guests for campaign:', selectedCampaign.id, 'user:', email);
    
    // REMOVED ownerEmail where to avoid composite index requirements
    // campaignId is unique enough to fetch guests securely
    const q = query(
      collection(db, 'guests'),
      where('campaignId', '==', selectedCampaign.id)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ ...(d.data() as any), id: d.id })) as GuestData[];
      
      // Client-side sort: newest first
      data.sort((a, b) => {
        const timeA = (a.createdAt as any)?.seconds || 0;
        const timeB = (b.createdAt as any)?.seconds || 0;
        return timeB - timeA;
      });

      console.log('[Dashboard] Guests update for:', selectedCampaign.name, data.length);
      setGuests(data);
    }, (err) => {
      console.error('[Dashboard] Guests error:', err);
      setDbError(`Firebase Error (Guests): ${err.message}`);
    });
    
    return () => unsubscribe();
  }, [selectedCampaign]);

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleCreateCampaign(e: React.FormEvent) {
    e.preventDefault();
    if (!newCampaignName.trim() || !user?.email) return;
    setIsCreatingCampaign(true);
    try {
      const res = await fetch('/api/create-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: newCampaignName.trim(), 
          ownerEmail: user.email.toLowerCase(),
          eventDate: newEventDate,
          eventTime: newEventTime,
          eventVenue: newEventVenue
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create campaign');

      setNewCampaignName('');
      setNewEventDate('');
      setNewEventTime('');
      setNewEventVenue('');
      setSelectedCampaign({ 
        id: data.id, 
        name: data.name, 
        ownerEmail: data.ownerEmail,
        eventDate: data.eventDate,
        eventTime: data.eventTime,
        eventVenue: data.eventVenue
      });
      showToast('Campaign created!', 'success');
    } catch (err) {
      showToast('Failed to create campaign', 'error');
    } finally {
      setIsCreatingCampaign(false);
    }
  }

  async function copyCampaignLink() {
    if (!selectedCampaign) return;
    const identifier = selectedCampaign.slug || selectedCampaign.id;
    const link = `${origin}/c/${identifier}`;
    try {
      await navigator.clipboard.writeText(link);
      showToast('Shortened link copied!', 'success');
    } catch {
      showToast('Failed to copy', 'error');
    }
  }

  async function handleDeleteCampaign() {
    if (!selectedCampaign) return;
    if (!window.confirm(`🚨 Are you absolutely sure you want to delete the campaign "${selectedCampaign.name}"?\n\nThis will permanently delete the campaign and ALL associated guests. This action CANNOT be undone.`)) return;
    
    setIsDeleting(true);
    try {
      const res = await fetch('/api/delete-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: selectedCampaign.id }),
      });
      if (!res.ok) throw new Error('Failed to delete campaign');
      
      setSelectedCampaign(null);
      setGuests([]);
      showToast('Campaign deleted successfully', 'success');
    } catch (err) {
      showToast('Failed to delete campaign', 'error');
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleDeleteGuest(guestId: string, guestName: string) {
    if (!window.confirm(`Delete guest "${guestName}"? This cannot be undone.`)) return;
    
    setIsDeleting(true);
    try {
      const res = await fetch('/api/delete-guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestId }),
      });
      if (!res.ok) throw new Error('Failed to delete guest');
      showToast('Guest deleted', 'success');
    } catch (err) {
      showToast('Failed to delete guest', 'error');
    } finally {
      setIsDeleting(false);
    }
  }


  if (!isMounted || loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#050505] text-white overflow-hidden font-sans antialiased">
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl border text-sm shadow-xl transition-all
          ${toast.type === 'success'
            ? 'bg-emerald-900/80 border-emerald-700 text-emerald-200'
            : 'bg-red-900/80 border-red-700 text-red-200'}`}>
          {toast.msg}
        </div>
      )}

      {dbError && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-6 py-4 rounded-xl border-2 bg-red-950 border-red-500 text-red-200 shadow-2xl shadow-red-900/50 max-w-2xl text-center">
          <p className="font-bold text-red-400 mb-1">🚨 Database Connection Blocked</p>
          <p className="text-sm font-mono">{dbError}</p>
          <p className="text-xs mt-3 text-red-300">Your Firebase Security Rules are blocking access. Go to the Firebase Console {'->'} Firestore Database {'->'} Rules, and set them to `allow read, write: if true;`</p>
        </div>
      )}

      {/* SIDEBAR */}
      <aside className="w-72 flex-shrink-0 border-r border-white/5 bg-black/40 backdrop-blur-3xl flex flex-col">
        <div className="p-8 border-b border-white/5">
           <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center font-display font-bold text-xl shadow-[0_0_20px_rgba(255,255,255,0.15)]">A</div>
             <h1 className="font-display text-2xl font-bold tracking-tight">Antgravity</h1>
           </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-6 space-y-2 custom-scrollbar">
           <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] px-3 mb-4">Campaigns</p>
           
           {campaigns.length === 0 ? (
             <p className="text-xs text-gray-700 px-3 italic">No active campaigns</p>
           ) : (
             campaigns.map(c => (
               <button
                 key={c.id}
                 onClick={() => setSelectedCampaign(c)}
                 className={`w-full text-left px-4 py-3 rounded-2xl text-sm transition-all duration-300 group flex items-center justify-between
                   ${selectedCampaign?.id === c.id 
                     ? 'bg-white/10 text-white font-medium border border-white/10 shadow-[0_4px_12px_rgba(0,0,0,0.5)]' 
                     : 'text-gray-500 hover:bg-white/5 hover:text-gray-200'}`}
               >
                 <span className="truncate">{c.name}</span>
                 {selectedCampaign?.id === c.id && <div className="w-1 h-1 rounded-full bg-white shadow-[0_0_8px_white]" />}
               </button>
             ))
           )}

            {selectedCampaign && (
              <div className="px-3 mb-6">
                <button
                  onClick={() => setShowAdd(true)}
                  className="w-full py-4 bg-white hover:bg-gray-100 text-black text-[10px] font-bold rounded-2xl transition shadow-[0_4px_20px_rgba(255,255,255,0.1)] active:scale-95 flex items-center justify-center gap-2"
                >
                  <span className="text-sm">+</span> ADD GUEST TO REGISTRY
                </button>
              </div>
            )}

            <div className="pt-6 space-y-4">

              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] px-3">New Campaign</p>
              <form onSubmit={handleCreateCampaign} className="px-3 space-y-3">
                <input
                  type="text"
                  placeholder="Campaign Name"
                  value={newCampaignName}
                  onChange={(e) => setNewCampaignName(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg text-xs py-2 px-3 outline-none focus:border-violet-600 transition"
                />
                <input
                  type="text"
                  placeholder="Event Date (e.g. Tuesday, 3 March)"
                  value={newEventDate}
                  onChange={(e) => setNewEventDate(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg text-[10px] py-2 px-3 outline-none focus:border-violet-600 transition"
                />
                <input
                  type="text"
                  placeholder="Event Time (e.g. 9h30 AM)"
                  value={newEventTime}
                  onChange={(e) => setNewEventTime(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg text-[10px] py-2 px-3 outline-none focus:border-violet-600 transition"
                />
                <input
                  type="text"
                  placeholder="Event Venue"
                  value={newEventVenue}
                  onChange={(e) => setNewEventVenue(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg text-[10px] py-2 px-3 outline-none focus:border-violet-600 transition"
                />
                <button 
                  type="submit" 
                  disabled={isCreatingCampaign || !newCampaignName.trim()}
                  className="w-full py-2 bg-white/5 hover:bg-white/10 text-white text-[10px] font-bold rounded-lg border border-white/5 transition"
                >
                   {isCreatingCampaign ? 'Creating...' : 'CREATE CAMPAIGN'}
                </button>
              </form>
            </div>
        </nav>

        <div className="p-4 border-t border-white/5 bg-white/5 backdrop-blur-md">
           <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-luxury-gold flex items-center justify-center text-[11px] font-bold text-white shadow-lg">{user.email?.charAt(0).toUpperCase()}</div>
                <div className="max-w-[120px] truncate">
                  <p className="text-[10px] font-bold text-white uppercase tracking-widest truncate">{user.email?.split('@')[0]}</p>
                </div>
              </div>
              <button onClick={() => signOut(auth)} className="text-[10px] text-gray-500 hover:text-red-400 transition font-bold tracking-widest uppercase">Logout</button>
           </div>
           
            <button
              onClick={() => setShowScanner(true)}
              className="w-full py-4 bg-luxury-gold/10 border border-luxury-gold/30 rounded-sm text-[9px] font-bold text-luxury-gold uppercase tracking-[0.3em] transition-all duration-500 hover:bg-luxury-gold hover:text-white shadow-xl active:scale-95 flex items-center justify-center gap-2 mb-2"
            >
              Hostess Scanner
            </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#050505]">
        {selectedCampaign ? (
          <>
            <header className="h-24 border-b border-white/5 bg-black/20 backdrop-blur-xl flex items-center justify-between px-10 flex-shrink-0">
                <div className="space-y-1">
                  <h2 className="text-2xl font-display font-bold text-white tracking-tight">{selectedCampaign.name}</h2>
                  <div className="flex gap-4 text-[9px] text-gray-500 font-mono tracking-wider uppercase">
                    <span>{selectedCampaign.eventDate || 'No Date'}</span>
                    <span>•</span>
                    <span>{selectedCampaign.eventTime || 'No Time'}</span>
                    <span>•</span>
                    <span>{selectedCampaign.eventVenue || 'No Venue'}</span>
                  </div>
                </div>
                      <div className="flex flex-wrap items-center justify-end gap-3 sm:gap-4 flex-1 mt-2 lg:mt-0">
                   <div className="hidden sm:flex items-center bg-white/5 border border-white/10 rounded-2xl px-1 py-1">
                     <code className="text-[9px] text-gray-500 px-3 font-mono">
                       {origin.replace(/^https?:\/\//, '')}/c/{selectedCampaign.id.slice(0, 8)}...
                     </code>
                     <button
                       onClick={copyCampaignLink}
                       className="bg-white text-black text-[9px] font-bold px-3 py-2 rounded-xl transition hover:bg-gray-200 active:scale-95"
                     >
                       LINK
                     </button>
                   </div>
                   
                   <button
                     onClick={() => setShowEmailModal(true)}
                     className="bg-luxury-gold text-white text-[10px] sm:text-[11px] font-bold px-4 sm:px-6 py-2.5 rounded-2xl transition hover:bg-[#7a654a] active:scale-95 shadow-lg flex items-center gap-2"
                   >
                     <span>✉️</span> DISPATCH
                   </button>
                   
                   
                   <button
                     onClick={() => setShowImport(true)}
                     className="bg-white/5 hover:bg-white/10 text-white text-[10px] sm:text-[11px] font-bold px-4 sm:px-5 py-2.5 rounded-2xl border border-white/10 transition active:scale-95"
                   >
                     IMPORT
                   </button>
                   
                   <button
                     onClick={() => setShowAdd(true)}
                     className="bg-white text-black text-[10px] sm:text-[11px] font-bold px-5 sm:px-6 py-2.5 rounded-2xl transition hover:bg-gray-200 active:scale-95 shadow-[0_0_25px_rgba(255,255,255,0.15)] ring-2 ring-white/5"
                   >
                     + ADD GUEST
                   </button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
              {/* Top Stats & Live Feed Grid */}
              <div className="grid grid-cols-12 gap-6 items-stretch">
                {/* Stats */}
                <div className="col-span-8 grid grid-cols-2 gap-4">
                  {[
                    { label: 'Total Managed Guests', value: guests.length, bg: 'bg-white/[0.03]' },
                    { label: 'Invited / Pending', value: guests.filter(g => g.status === 'invited' || g.status === 'pending').length, color: 'text-gray-500', bg: 'bg-white/[0.02]' },
                    { label: 'Confirmed RSVPs', value: guests.filter(g => g.status === 'confirmed' || g.status === 'accepted').length, color: 'text-white', bg: 'bg-white/[0.05]' },
                    { label: 'At-the-Door Arrivals', value: guests.filter(g => g.status === 'arrived').length, color: 'text-white', bg: 'bg-white/[0.08]' },
                  ].map(s => (
                    <div key={s.label} className={`${s.bg} border border-white/5 backdrop-blur-3xl rounded-[2rem] p-8 transition-all duration-500 hover:border-white/10 hover:bg-white/[0.1] group`}>
                      <p className="text-[10px] text-gray-500 uppercase tracking-[0.2em] mb-2 font-bold">{s.label}</p>
                      <p className={`text-4xl font-display font-bold tracking-tighter ${s.color || 'text-white'} group-hover:scale-105 transition-transform origin-left`}>{s.value}</p>
                    </div>
                  ))}
                </div>

                {/* Live Feed */}
                <div className="col-span-4 min-h-[180px]">
                   <LiveArrivalFeed guests={guests} />
                </div>
              </div>

              {/* Arrival Analytics */}
              <ArrivalAnalytics guests={guests} />

              {/* Guest Table */}
              <div className="bg-white/[0.02] border border-white/5 backdrop-blur-3xl rounded-[2.5rem] overflow-hidden shadow-2xl transition-all duration-700 hover:border-white/10">
                {guests.length === 0 ? (
                  <div className="py-40 text-center">
                    <div className="text-6xl mb-6 grayscale opacity-20">🎟️</div>
                    <p className="text-white font-display text-xl font-bold tracking-tight">Your guest list is empty</p>
                    <p className="text-gray-600 text-[10px] mt-2 uppercase tracking-[0.2em]">Begin by importing data or manual entry</p>
                  </div>
                ) : (() => {
                  const extraKeys = Array.from(new Set(guests.flatMap(g => Object.keys(g.extraFields ?? {}))));
                  return (
                    <div className="overflow-x-auto custom-scrollbar">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-white/5 border-b border-white/5">
                            {['', 'Guest Name', 'Email Index', 'Profile', 'Status', ...extraKeys, 'Registered', ''].map((h, i) => (
                              <th key={i} className={`${i === 0 ? 'w-16 px-4' : 'px-8'} py-6 text-[10px] text-gray-500 uppercase tracking-[0.3em] font-bold whitespace-nowrap font-display`}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.03]">
                          {guests.map((guest) => {
                            const badge = STATUS_BADGE[guest.status] ?? STATUS_BADGE.invited;
                            return (
                              <tr key={guest.id} className={`hover:bg-white/[0.03] transition-all duration-300 group ${guest.parentId ? 'bg-white/[0.01]' : ''}`}>
                                <td className="px-4 py-6 whitespace-nowrap">
                                  <div className="flex items-center justify-center">
                                    {guest.portraitUrl ? (
                                      /* eslint-disable-next-line @next/next/no-img-element */
                                      <img 
                                        src={guest.portraitUrl} 
                                        alt={guest.name} 
                                        className="w-10 h-10 rounded-full object-cover border border-white/10 shadow-lg"
                                        onError={(e) => { (e.target as any).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(guest.name || 'G')}&background=333&color=fff`; }}
                                      />
                                    ) : (
                                      <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-bold text-gray-500">
                                        {(guest.firstName || guest.name || '?').charAt(0)}
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="px-8 py-6 text-sm font-medium text-white whitespace-nowrap tracking-tight">
                                  <div className="flex flex-col">
                                    <span className="flex items-center gap-2">
                                      {guest.name || <span className="text-gray-700 italic">Unnamed Guest</span>}
                                      {guest.parentId && (
                                        <span className="text-[8px] bg-white/10 text-gray-400 px-1.5 py-0.5 rounded uppercase tracking-tighter">Plus One</span>
                                      )}
                                    </span>
                                    {guest.seatNumber && <span className="text-[9px] text-luxury-gold uppercase tracking-widest mt-0.5">{guest.seatNumber}</span>}
                                  </div>
                                </td>
                                <td className="px-8 py-6 text-xs text-gray-500 whitespace-nowrap font-mono">{guest.email || '—'}</td>
                                <td className="px-8 py-6 whitespace-nowrap">
                                  {guest.category && guest.category !== 'Standard' ? (
                                    <span className={`text-[9px] font-bold px-2.5 py-1 rounded-full border tracking-widest
                                      ${guest.category === 'VIP' ? 'bg-white text-black border-transparent shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 
                                        'bg-white/5 border-white/10 text-gray-300'}`}>
                                      {guest.category.toUpperCase()}
                                    </span>
                                  ) : (
                                    <span className="text-[9px] text-gray-700 font-mono tracking-widest">STANDARD</span>
                                  )}
                                </td>
                                <td className="px-8 py-6">
                                  <span className={`text-[9px] font-bold px-3 py-1.5 rounded-full border whitespace-nowrap tracking-widest
                                    ${guest.status === 'arrived' ? 'bg-white/10 border-white/20 text-white' : 'bg-transparent border-white/10 text-gray-500'}`}>
                                    {badge.label.toUpperCase()}
                                  </span>
                                </td>
                                {extraKeys.map(key => (
                                  <td key={key} className="px-8 py-6 text-xs text-gray-400 whitespace-nowrap font-mono">
                                    {guest.extraFields?.[key] ?? <span className="text-gray-800">—</span>}
                                  </td>
                                ))}
                                <td className="px-8 py-6 text-[10px] text-gray-600 font-mono whitespace-nowrap uppercase tracking-tighter" suppressHydrationWarning>
                                  {(() => {
                                      const ca = guest.createdAt;
                                      if (!ca) return 'Now';
                                      try {
                                        const date = typeof ca === 'object' && 'seconds' in (ca as any) ? new Date((ca as any).seconds * 1000) : new Date(ca);
                                        return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                                      } catch { return 'Recent'; }
                                  })()}
                                </td>
                                <td className="px-6 py-6 text-right flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-4 group-hover:translate-x-0">
                                  <button 
                                    onClick={() => { setEditingGuest(guest); setShowEdit(true); }}
                                    className="p-2.5 bg-white/5 hover:bg-luxury-gold text-gray-400 hover:text-white rounded-xl border border-white/5 transition-all duration-300"
                                    title="Edit guest"
                                  >
                                    ✍️
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteGuest(guest.id, guest.name || 'this guest')} 
                                    disabled={isDeleting}
                                    className="p-2.5 bg-white/5 hover:bg-red-500/80 text-gray-400 hover:text-white rounded-xl border border-white/5 transition-all duration-300"
                                    title="Delete guest"
                                  >
                                    🗑️
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-gray-900/20">
             <div className="w-20 h-20 bg-gray-900 border border-gray-800 rounded-3xl flex items-center justify-center text-3xl mb-6 shadow-xl italic font-serif">A</div>
             <h2 className="text-2xl font-bold mb-2">Select a Campaign</h2>
             <p className="text-gray-500 text-sm max-w-sm">Choose a campaign from the sidebar on the left or create a new one to start managing your guest list.</p>
             
             {campaigns.length === 0 && (
                <div className="mt-8 pt-8 border-t border-gray-800 w-full max-w-xs">
                   <p className="text-xs text-amber-500/80 mb-4 bg-amber-500/5 px-4 py-2 rounded-lg border border-amber-500/10">You don&apos;t have any campaigns yet.</p>
                   <form onSubmit={handleCreateCampaign} className="space-y-4">
                     <input
                       type="text"
                       placeholder="e.g. Wedding 2026"
                       value={newCampaignName}
                       onChange={(e) => setNewCampaignName(e.target.value)}
                       className="w-full bg-gray-900 border border-gray-800 rounded-xl py-3 px-4 text-sm outline-none focus:border-violet-600 transition"
                     />
                     <button 
                       type="submit" 
                       disabled={isCreatingCampaign || !newCampaignName.trim()}
                       className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition"
                     >
                       {isCreatingCampaign ? 'Creating...' : 'Create First Campaign'}
                     </button>
                   </form>
                </div>
             )}
          </div>
        )}
      </main>

      {showAdd && selectedCampaign && (
        <AddGuestModal 
          campaignId={selectedCampaign.id} 
          guests={guests}
          onGuestAdded={(g: GuestData) => { setShowAdd(false); showToast('Guest added!', 'success'); }} 
          onClose={() => setShowAdd(false)} 
        />
      )}
      {showImport && selectedCampaign && (
        <ImportGuestsModal
          campaignId={selectedCampaign.id}
          onImported={(newGuests) => {
            setShowImport(false);
            showToast(`${newGuests.length} guests imported!`, 'success');
          }}
          onClose={() => setShowImport(false)}
        />
      )}

      {showScanner && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity duration-700"
            onClick={() => setShowScanner(false)}
          />
          <div className="relative w-full max-w-lg bg-white rounded-sm shadow-2xl overflow-hidden animate-fade-up">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-luxury-off-white">
              <h3 className="font-cormorant text-xl text-luxury-dark uppercase tracking-widest">Hostess Scanner</h3>
              <button 
                onClick={() => setShowScanner(false)}
                className="text-luxury-muted hover:text-luxury-dark transition-colors text-xl font-light"
              >
                ✕
              </button>
            </div>
            <div className="p-8 max-h-[85vh] overflow-y-auto">
              <QRScanner />
            </div>
          </div>
        </div>
      )}

      {showEmailModal && selectedCampaign && (
        <SendInvitationsModal
          campaignId={selectedCampaign.id}
          guests={guests}
          onSent={(success, failed) => {
            if (failed > 0) {
              showToast(`Dispatched ${success} successfully. ${failed} failed.`, 'error');
            } else {
              showToast(`Successfully dispatched ${success} invitations!`, 'success');
            }
            setShowEmailModal(false);
          }}
          onClose={() => setShowEmailModal(false)}
        />
      )}

      {showEdit && editingGuest && (
        <EditGuestModal
          guest={editingGuest}
          onGuestUpdated={(updated) => {
            // Updated directly in Firestore, but let's refresh locally if needed
            // Actually AdminDashboard has listeners or re-fetches
            setShowEdit(false);
            setEditingGuest(null);
            showToast('Registry updated!', 'success');
          }}
          onClose={() => { setShowEdit(false); setEditingGuest(null); }}
        />
      )}
    </div>
  );
}
