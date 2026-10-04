'use client';

import React, { useState, useEffect, useCallback, useMemo, Component } from 'react';
import { authedFetch } from '@/lib/api-client';
import { useRouter } from 'next/navigation';
import UngaroLogo from './UngaroLogo';
import { useAuth } from '@/context/AuthContext';
import dynamic from 'next/dynamic';
import { type GuestData } from './AddGuestModal';

import RichTextEditor from './RichTextEditor';
const AddGuestModal = dynamic(() => import('./AddGuestModal'), { ssr: false });
const ImportGuestsModal = dynamic(() => import('./ImportGuestsModal'), { ssr: false });
const LiveArrivalFeed = dynamic(() => import('./LiveArrivalFeed'), { ssr: false });
const ArrivalAnalytics = dynamic(() => import('./ArrivalAnalytics'), { ssr: false });
const QRScanner = dynamic(() => import('./QRScanner'), { ssr: false });
const SendInvitationsModal = dynamic(() => import('./SendInvitationsModal'), { ssr: false });
const EditGuestModal = dynamic(() => import('./EditGuestModal'), { ssr: false });

// Diagnostic Error Boundary
class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error("[CRITICAL ERROR]", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-10 text-center">
          <div className="max-w-md">
            <h1 className="text-2xl font-bold text-red-500 mb-4">Diagnostics: Critical Error</h1>
            <p className="text-gray-400 text-sm mb-6">Something went wrong while rendering the dashboard. Error code: {String(this.state.error?.message || this.state.error)}</p>
            <button onClick={() => window.location.reload()} className="bg-white text-black px-6 py-2 rounded-lg font-bold">Reload Application</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export interface CampaignData {
  id: string;
  name: string;
  ownerEmail: string;
  slug?: string;
  eventDate?: string;
  eventTime?: string;
  eventEndTime?: string;
  eventVenue?: string;
  language?: 'en' | 'fr';
  emailImageUrl?: string;
  logoVariant?: 'black' | 'white' | 'img-pink' | 'img-black' | 'img-white';
  emailMessage?: string;
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

// ---- Guest list: filters, search and time helpers ------------------------
type StatusFilter = 'all' | 'arrived' | 'notArrived' | 'confirmed' | 'invited';

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'arrived', label: 'Arrived' },
  { key: 'notArrived', label: 'Not arrived' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'invited', label: 'Invited' },
];

function matchesFilter(status: string, filter: StatusFilter): boolean {
  switch (filter) {
    case 'arrived': return status === 'arrived';
    case 'notArrived': return status !== 'arrived';
    case 'confirmed': return status === 'confirmed' || status === 'accepted';
    case 'invited': return status === 'invited' || status === 'pending';
    default: return true;
  }
}

// Lower-case and strip accents, so "elodie" finds "Élodie".
function normalizeText(value: unknown): string {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// Timestamps arrive as { seconds, nanoseconds } (or an ISO string for brand-new records).
function toDate(value: any): Date | null {
  if (!value) return null;
  const date = typeof value === 'object' && 'seconds' in value ? new Date(value.seconds * 1000) : new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

function formatArrival(value: any): string {
  const date = toDate(value);
  if (!date) return '—';
  const sameDay = date.toDateString() === new Date().toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function guestSearchText(g: GuestData): string {
  return normalizeText([g.name, g.firstName, g.lastName, g.email, g.category, ...Object.values(g.extraFields ?? {})].join(' '));
}

export default function AdminDashboard() {
  return (
    <ErrorBoundary>
      <AdminDashboardContent />
    </ErrorBoundary>
  );
}

function AdminDashboardContent() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  
  const [campaigns, setCampaigns] = useState<CampaignData[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignData | null>(null);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventTime, setNewEventTime] = useState('');
  const [newEventEndTime, setNewEventEndTime] = useState('');
  const [newEventVenue, setNewEventVenue] = useState('');
  const [newCampaignLanguage, setNewCampaignLanguage] = useState<'en'|'fr'>('en');
  const [newCampaignLogoVariant, setNewCampaignLogoVariant] = useState<'black'|'white'|'img-pink'|'img-black'|'img-white'>('black');
  const [newCampaignEmailImage, setNewCampaignEmailImage] = useState('');
  const [newCampaignMessage, setNewCampaignMessage] = useState('');
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

  // Guest-list controls
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [checkingInId, setCheckingInId] = useState<string | null>(null);

  // Bumping this reloads the lists straight away (after adding, deleting, checking in...).
  const [refreshTick, setRefreshTick] = useState(0);
  const refresh = useCallback(() => setRefreshTick(t => t + 1), []);

  // Keeps the campaign list fresh: polls every few seconds while the tab is visible.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function load() {
      try {
        const res = await authedFetch('/api/campaigns');
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
        if (cancelled) return;
        const data: CampaignData[] = body.campaigns;
        setCampaigns(data);
        // Keep the open campaign in sync with its latest copy, or open the first one.
        setSelectedCampaign(prev => {
          if (!prev) return data[0] ?? null;
          const latest = data.find(c => c.id === prev.id);
          return latest && JSON.stringify(latest) !== JSON.stringify(prev) ? latest : prev;
        });
        setDbError(null);
      } catch (err) {
        if (!cancelled) setDbError(`Could not load campaigns: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    load();
    const timer = setInterval(onVisible, 5000);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user, refreshTick]);

  // Clear the previous campaign's guests the moment another one is opened.
  const selectedCampaignId = selectedCampaign?.id;
  useEffect(() => {
    setGuests([]);
  }, [selectedCampaignId]);

  // Keeps the guest list fresh (a little faster, since this is what the door team watches).
  useEffect(() => {
    if (!user || !selectedCampaignId) return;
    let cancelled = false;

    async function load() {
      try {
        const res = await authedFetch(`/api/guests?campaignId=${encodeURIComponent(selectedCampaignId as string)}`);
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
        if (cancelled) return;
        setGuests(body.guests as GuestData[]);
        setDbError(null);
      } catch (err) {
        if (!cancelled) setDbError(`Could not load guests: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    load();
    const timer = setInterval(onVisible, 4000);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user, selectedCampaignId, refreshTick]);

  // Search + filter. Every word typed must appear somewhere in the guest's details.
  const filterCounts = useMemo(() => {
    const counts = {} as Record<StatusFilter, number>;
    for (const f of FILTERS) counts[f.key] = guests.filter(g => matchesFilter(g.status, f.key)).length;
    return counts;
  }, [guests]);

  const visibleGuests = useMemo(() => {
    const terms = normalizeText(query).split(/\s+/).filter(Boolean);
    return guests.filter(g => {
      if (!matchesFilter(g.status, statusFilter)) return false;
      if (terms.length === 0) return true;
      const text = guestSearchText(g);
      return terms.every(t => text.includes(t));
    });
  }, [guests, query, statusFilter]);

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  // Checks a guest in by hand (or undoes it). The row updates at once; the next
  // refresh confirms it with the server and corrects it if the request failed.
  async function handleCheckIn(guest: GuestData, undo: boolean) {
    const name = guest.name || 'Guest';
    setCheckingInId(guest.id);
    setGuests(prev => prev.map(g => g.id !== guest.id ? g : {
      ...g,
      status: undo ? (g.confirmedAt ? 'confirmed' : 'invited') : 'arrived',
      arrivedAt: undo ? null : ({ seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } as any),
    }));
    try {
      const res = await authedFetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestId: guest.id, undo }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 409) throw new Error(data.error || 'Check-in failed');
      showToast(
        undo ? `${name}: check-in undone` : res.status === 409 ? `${name} was already checked in` : `${name} checked in`,
        'success',
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Check-in failed', 'error');
    } finally {
      setCheckingInId(null);
      refresh();
    }
  }

  async function handleCreateCampaign(e: React.FormEvent) {
    e.preventDefault();
    if (!newCampaignName.trim() || !user?.email) return;
    setIsCreatingCampaign(true);
    try {
      const res = await authedFetch('/api/create-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: newCampaignName.trim(), 
          ownerEmail: user.email.toLowerCase(),
          eventDate: newEventDate,
          eventTime: newEventTime,
          eventEndTime: newEventEndTime,
          eventVenue: newEventVenue,
          language: newCampaignLanguage,
          emailImageUrl: newCampaignEmailImage,
          logoVariant: newCampaignLogoVariant,
          emailMessage: newCampaignMessage
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create campaign');

      setNewCampaignName('');
      setNewEventDate('');
      setNewEventTime('');
      setNewEventEndTime('');
      setNewEventVenue('');
      setNewCampaignEmailImage('');
      setNewCampaignMessage('');
      
      setSelectedCampaign({ 
        id: data.id, 
        name: data.name, 
        ownerEmail: data.ownerEmail,
        eventDate: data.eventDate,
        eventTime: data.eventTime,
        eventEndTime: data.eventEndTime || '',
        eventVenue: data.eventVenue,
        language: data.language || 'en',
        logoVariant: data.logoVariant || 'black',
        emailImageUrl: data.emailImageUrl || '',
        emailMessage: data.emailMessage || ''
      });
      refresh();
      showToast('Campaign created!', 'success');
    } catch (err) {
      showToast('Failed to create campaign', 'error');
    } finally {
      setIsCreatingCampaign(false);
    }
  }

  async function copyCampaignLink() {
    if (!selectedCampaign) return;
    const currentHost = typeof window !== 'undefined' ? window.location.origin : origin;
    const identifier = selectedCampaign.slug || selectedCampaign.id;
    const link = `${currentHost}/c/${identifier}`;
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
      const res = await authedFetch('/api/delete-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: selectedCampaign.id }),
      });
      if (!res.ok) throw new Error('Failed to delete campaign');
      
      setSelectedCampaign(null);
      setGuests([]);
      refresh();
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
      const res = await authedFetch('/api/delete-guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestId }),
      });
      if (!res.ok) throw new Error('Failed to delete guest');
      refresh();
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
              <div className="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center font-bold text-sm shadow-[0_0_20px_rgba(255,255,255,0.15)]">EU</div>
              <UngaroLogo className="h-6" color="#FFFFFF" />
           </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-6 space-y-2 custom-scrollbar">
           <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] px-3 mb-4">Campaigns</p>
           
           {campaigns.length === 0 ? (
             <p className="text-xs text-gray-700 px-3 italic">No active campaigns</p>
           ) : (
             campaigns.map(c => (
                <div
                  key={c.id}
                  className={`group relative flex items-center rounded-2xl transition-all duration-300
                    ${selectedCampaign?.id === c.id 
                      ? 'bg-white/10 border border-white/10 shadow-[0_4px_12px_rgba(0,0,0,0.5)]' 
                      : 'hover:bg-white/5'}`}
                >
                  <button
                    onClick={() => setSelectedCampaign(c)}
                    className={`flex-1 text-left px-4 py-3 text-sm transition-all duration-300 truncate
                      ${selectedCampaign?.id === c.id 
                        ? 'text-white font-medium' 
                        : 'text-gray-500 hover:text-gray-200'}`}
                  >
                    {c.name}
                  </button>
                  {/* Delete button - visible on hover */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!window.confirm(`🚨 Delete "${c.name}" and ALL its guests?\n\nThis cannot be undone.`)) return;
                      (async () => {
                        setIsDeleting(true);
                        try {
                          const res = await authedFetch('/api/delete-campaign', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ campaignId: c.id }),
                          });
                          if (!res.ok) throw new Error('Failed');
                          if (selectedCampaign?.id === c.id) {
                            setSelectedCampaign(null);
                            setGuests([]);
                          }
                          refresh();
                          showToast('Campaign deleted', 'success');
                        } catch {
                          showToast('Failed to delete campaign', 'error');
                        } finally {
                          setIsDeleting(false);
                        }
                      })();
                    }}
                    disabled={isDeleting}
                    className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-2 mr-1 text-gray-600 hover:text-red-400 rounded-lg hover:bg-red-500/10 disabled:opacity-50"
                    title={`Delete ${c.name}`}
                  >
                    🗑️
                  </button>
                </div>
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
                <div className="flex gap-2">
                  <div className="w-1/2 space-y-1">
                    <label className="text-[8px] uppercase tracking-widest text-gray-500 font-bold pl-1">Start Time</label>
                    <input
                      type="time"
                      value={newEventTime}
                      onChange={(e) => setNewEventTime(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-800 rounded-lg text-[10px] py-2 px-3 outline-none focus:border-violet-600 transition"
                    />
                  </div>
                  <div className="w-1/2 space-y-1">
                    <label className="text-[8px] uppercase tracking-widest text-gray-500 font-bold pl-1">End Time</label>
                    <input
                      type="time"
                      value={newEventEndTime}
                      onChange={(e) => setNewEventEndTime(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-800 rounded-lg text-[10px] py-2 px-3 outline-none focus:border-violet-600 transition"
                    />
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="VENUE LOCATION"
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

        <div className="px-6 py-4 border-t border-white/5 text-center">
            <UngaroLogo className="h-5 opacity-40" color="#FFFFFF" />
        </div>

        <div className="p-4 border-t border-white/5 bg-white/5 backdrop-blur-md">
           <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-luxury-gold flex items-center justify-center text-[11px] font-bold text-white shadow-lg">{user.email?.charAt(0).toUpperCase()}</div>
                <div className="max-w-[120px] truncate">
                  <p className="text-[10px] font-bold text-white uppercase tracking-widest truncate">{user.email?.split('@')[0]}</p>
                </div>
              </div>
              <button onClick={async () => { await logout(); router.push('/login'); }} className="text-[10px] text-gray-500 hover:text-red-400 transition font-bold tracking-widest uppercase">Logout</button>
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
                     onClick={() => {
                       if(window.confirm('Dispatch 1-Week Reminders to ALL guests?\n\n- Pending guests will receive RSVP prompts.\n- Confirmed guests will receive their Entry QR codes again.\n\nThis may take a moment to dispatch.')) {
                         (async () => {
                           try {
                             showToast('Dispatching 1-Week remiders...', 'success');
                             const res = await authedFetch('/api/send-reminders', {
                               method: 'POST',
                               headers: { 'Content-Type': 'application/json' },
                               body: JSON.stringify({ campaignId: selectedCampaign.id, origin: window.location.origin }),
                             });
                             if(!res.ok) throw new Error('Failed to send');
                             const data = await res.json();
                             showToast(`Successfully dispatched ${data.sentCount} reminders!`, 'success');
                           } catch {
                             showToast('Failed to dispatch reminders', 'error');
                           }
                         })();
                       }
                     }}
                     className="bg-white/5 hover:bg-white/10 text-white text-[10px] sm:text-[11px] font-bold px-4 sm:px-6 py-2.5 rounded-2xl transition border border-white/10 active:scale-95 shadow-lg flex items-center gap-2"
                   >
                     <span>⏱️</span> 1-WEEK REMINDER
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
                {guests.length > 0 && (
                  <div className="p-6 border-b border-white/5 space-y-4">
                    <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
                      <div className="relative flex-1 max-w-xl">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 text-sm" aria-hidden="true">🔍</span>
                        <input
                          type="search"
                          value={query}
                          onChange={e => setQuery(e.target.value)}
                          placeholder="Search by name, email or category…"
                          aria-label="Search guests"
                          className="w-full bg-white/[0.03] border border-white/10 rounded-2xl pl-12 pr-10 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-white/30 focus:bg-white/[0.05] transition-all duration-300"
                        />
                        {query && (
                          <button
                            type="button"
                            onClick={() => setQuery('')}
                            aria-label="Clear search"
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-xs transition"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {FILTERS.map(f => (
                          <button
                            key={f.key}
                            type="button"
                            onClick={() => setStatusFilter(f.key)}
                            className={`text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-full border transition ${
                              statusFilter === f.key
                                ? 'bg-white text-black border-white'
                                : 'bg-white/[0.03] text-gray-400 border-white/10 hover:border-white/30 hover:text-white'
                            }`}
                          >
                            {f.label} <span className="opacity-60 ml-1">{filterCounts[f.key]}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-600 uppercase tracking-[0.2em]">
                      Showing {visibleGuests.length} of {guests.length} guests
                    </p>
                  </div>
                )}
                {guests.length === 0 ? (
                  <div className="py-40 text-center">
                    <div className="text-6xl mb-6 grayscale opacity-20">🎟️</div>
                    <p className="text-white font-display text-xl font-bold tracking-tight">Your guest list is empty</p>
                    <p className="text-gray-600 text-[10px] mt-2 uppercase tracking-[0.2em]">Begin by importing data or manual entry</p>
                  </div>
                ) : (() => {
                  const extraKeys = Array.from(new Set(guests.flatMap(g => Object.keys(g.extraFields ?? {}))));
                  if (visibleGuests.length === 0) {
                    return (
                      <div className="py-24 text-center">
                        <p className="text-white font-display text-lg font-bold tracking-tight">No guests match</p>
                        <p className="text-gray-600 text-[10px] mt-2 uppercase tracking-[0.2em]">Try a different name or clear the filters</p>
                        <button
                          type="button"
                          onClick={() => { setQuery(''); setStatusFilter('all'); }}
                          className="mt-6 text-[10px] font-bold uppercase tracking-widest px-5 py-2.5 rounded-full border border-white/10 text-gray-300 hover:border-white/30 hover:text-white transition"
                        >
                          Clear search and filters
                        </button>
                      </div>
                    );
                  }
                  return (
                    <div className="overflow-x-auto custom-scrollbar">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-white/5 border-b border-white/5">
                            {['', 'Guest Name', 'Email Index', 'Profile', 'Status', 'Arrival', ...extraKeys, 'Registered', ''].map((h, i) => (
                              <th key={i} className={`${i === 0 ? 'w-16 px-4' : 'px-8'} py-6 text-[10px] text-gray-500 uppercase tracking-[0.3em] font-bold whitespace-nowrap font-display`}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.03]">
                          {visibleGuests.map((guest) => {
                            const badge = STATUS_BADGE[guest.status] ?? STATUS_BADGE.invited;
                            return (
                              <tr key={guest.id} className={`hover:bg-white/[0.03] transition-all duration-300 group ${guest.status === 'arrived' ? 'bg-emerald-500/[0.05]' : guest.parentId ? 'bg-white/[0.01]' : ''}`}>
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
                                    ${guest.status === 'arrived' ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' : 'bg-transparent border-white/10 text-gray-500'}`}>
                                    {badge.label.toUpperCase()}
                                  </span>
                                </td>
                                <td className="px-8 py-6 whitespace-nowrap">
                                  {guest.status === 'arrived' ? (
                                    <div className="flex items-center gap-3">
                                      <span className="text-sm font-mono text-emerald-300" suppressHydrationWarning>{formatArrival(guest.arrivedAt)}</span>
                                      <button
                                        type="button"
                                        disabled={checkingInId === guest.id}
                                        onClick={() => handleCheckIn(guest, true)}
                                        className="text-[9px] text-gray-600 hover:text-red-400 uppercase tracking-widest font-bold transition disabled:opacity-40"
                                        title="Undo this check-in"
                                      >
                                        Undo
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={checkingInId === guest.id}
                                      onClick={() => handleCheckIn(guest, false)}
                                      className="text-[10px] font-bold px-4 py-2 rounded-xl bg-white text-black hover:bg-gray-200 transition active:scale-95 disabled:opacity-50 uppercase tracking-widest"
                                    >
                                      Check in
                                    </button>
                                  )}
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
          onGuestAdded={(g: GuestData) => { setShowAdd(false); refresh(); showToast('Guest added!', 'success'); }} 
          onClose={() => setShowAdd(false)} 
        />
      )}
      {showImport && selectedCampaign && (
        <ImportGuestsModal
          campaignId={selectedCampaign.id}
          onImported={(newGuests) => {
            setShowImport(false);
            refresh();
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
          campaign={selectedCampaign}
          guests={guests}
          onSent={(success, failed) => {
            if (failed > 0) {
              showToast(`Dispatched ${success} successfully. ${failed} failed.`, 'error');
            } else {
              showToast(`Successfully dispatched ${success} invitations!`, 'success');
            }
            setShowEmailModal(false);
            refresh();
          }}
          onClose={() => setShowEmailModal(false)}
        />
      )}

      {showEdit && editingGuest && (
        <EditGuestModal
          guest={editingGuest}
          onGuestUpdated={(updated) => {
            setShowEdit(false);
            refresh();
            setEditingGuest(null);
            showToast('Registry updated!', 'success');
          }}
          onClose={() => { setShowEdit(false); setEditingGuest(null); }}
        />
      )}
    </div>
  );
}
