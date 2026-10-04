'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuth } from '@/context/AuthContext';
import { useCampaigns, useGuests } from '@/lib/use-guests';
import { postCheckIn } from '@/lib/checkin-client';
import { describeCheckIn } from '@/lib/checkin';
import {
  applyCheckInLocally,
  buildRows,
  displayName,
  formatClock,
  isArrived,
  plusOneStats,
  recentArrivals,
  shortWho,
  tagHue,
  tagKey,
  tagOf,
  type ListRow,
} from '@/lib/guest-list';
import type { GuestData } from './AddGuestModal';

const QRScanner = dynamic(() => import('./QRScanner'), { ssr: false });

const MAX_RESULTS = 25;
const CAMPAIGN_KEY = 'pfw_door_campaign';

interface Banner {
  text: string;
  kind: 'success' | 'warning' | 'error';
  /** Guests just checked in, so the banner can offer to undo it. */
  undoIds?: string[];
}

function TagChip({ tag }: { tag: string }) {
  const key = tagKey(tag);
  if (key === 'standard') return null;
  const hue = key === 'vip' ? 48 : tagHue(tag);
  return (
    <span
      className="text-xs font-bold px-3 py-1 rounded-full border tracking-wider uppercase"
      style={{ backgroundColor: `hsl(${hue} 60% 50% / 0.18)`, borderColor: `hsl(${hue} 60% 60% / 0.5)`, color: `hsl(${hue} 85% 80%)` }}
    >
      {tag}
    </span>
  );
}

function GuestCard({
  row, busy, onCheckIn,
}: {
  row: ListRow<GuestData>;
  busy: boolean;
  onCheckIn: (ids: string[], undo: boolean) => void;
}) {
  const { guest, depth, host, context, party } = row;
  const arrived = isArrived(guest);
  const name = displayName(guest);
  const pending = party?.pendingIds.length ?? 0;

  return (
    <article
      className={`rounded-3xl border p-5 ${arrived ? 'border-emerald-500/40 bg-emerald-500/[0.07]' : 'border-white/10 bg-white/[0.04]'} ${depth === 1 ? 'ml-6' : ''} ${context ? 'opacity-50' : ''}`}
      aria-label={name}
    >
      <div className="flex items-start gap-4">
        {guest.portraitUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={guest.portraitUrl} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover border border-white/10" />
        ) : (
          <div className="h-14 w-14 shrink-0 rounded-full bg-white/10 flex items-center justify-center text-xl font-bold text-gray-300" aria-hidden="true">
            {name.charAt(0)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-2xl font-semibold leading-tight break-words">{name}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <TagChip tag={tagOf(guest)} />
            {depth === 1 && host && (
              <span className="text-xs text-gray-300 border border-white/15 rounded-full px-3 py-1">Plus-one of {displayName(host)}</span>
            )}
            {party && (
              <span className="text-xs font-semibold text-gray-200 border border-white/20 rounded-full px-3 py-1">
                +{party.total} · {party.arrived}/{party.total} arrived
              </span>
            )}
          </div>
        </div>
      </div>

      {guest.notes && (
        <div className="mt-4 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-lg leading-snug text-amber-100 break-words">
          <span aria-hidden="true">📝 </span>
          {guest.notes}
        </div>
      )}

      {arrived ? (
        <>
          <div className="mt-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-3" role="status">
            <p className="text-lg font-semibold text-emerald-200">✓ Already checked in</p>
            <p className="text-base text-emerald-100/80" suppressHydrationWarning>
              at {formatClock(guest.arrivedAt)}
              {guest.arrivedBy ? ` by ${shortWho(guest.arrivedBy)}` : ''}
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => onCheckIn([guest.id], true)}
            className="mt-3 w-full h-12 rounded-2xl border border-white/20 text-base font-semibold text-gray-200 active:scale-[0.98] disabled:opacity-50"
          >
            Undo check-in
          </button>
        </>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => onCheckIn([guest.id], false)}
          className="mt-4 w-full h-16 rounded-2xl bg-white text-black text-xl font-bold tracking-wide active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? 'Checking in…' : 'CHECK IN'}
        </button>
      )}

      {party && pending >= (arrived ? 1 : 2) && (
        <button
          type="button"
          disabled={busy}
          onClick={() => onCheckIn(party.pendingIds, false)}
          className="mt-3 w-full h-14 rounded-2xl border border-white/25 bg-white/[0.06] text-base font-semibold active:scale-[0.98] disabled:opacity-50"
        >
          {arrived ? `Check in plus-ones (${pending})` : `Check in whole party (${pending})`}
        </button>
      )}
    </article>
  );
}

export default function DoorMode() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { campaigns, loaded: campaignsLoaded, error: campaignsError } = useCampaigns(!!user);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const { guests, updateGuests, error: guestsError, loaded, refresh } = useGuests<GuestData>(campaignId, !!user, 3000);

  const [query, setQuery] = useState('');
  const [onlyExpected, setOnlyExpected] = useState(false);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [banner, setBanner] = useState<Banner | null>(null);
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  // Pick the campaign: the one used last time on this device, otherwise the first.
  useEffect(() => {
    if (campaigns.length === 0) return;
    if (campaignId && campaigns.some((c) => c.id === campaignId)) return;
    let saved: string | null = null;
    try { saved = window.localStorage.getItem(CAMPAIGN_KEY); } catch { /* storage unavailable */ }
    setCampaignId(campaigns.find((c) => c.id === saved)?.id ?? campaigns[0].id);
  }, [campaigns, campaignId]);

  function chooseCampaign(id: string) {
    setCampaignId(id);
    setQuery('');
    try { window.localStorage.setItem(CAMPAIGN_KEY, id); } catch { /* storage unavailable */ }
  }

  // A successful check-in message tidies itself away; warnings and errors stay until dismissed.
  useEffect(() => {
    if (!banner || banner.kind !== 'success') return;
    const timer = setTimeout(() => setBanner(null), 8000);
    return () => clearTimeout(timer);
  }, [banner]);

  async function doCheckIn(ids: string[], undo: boolean) {
    if (ids.length === 0 || !user) return;
    setBusy((prev) => new Set([...prev, ...ids]));
    updateGuests((prev) => applyCheckInLocally(prev, ids, undo, user.email));

    const res = await postCheckIn(ids, undo);
    if (res.ok) {
      const { text, kind } = describeCheckIn(res.results, undo, formatClock);
      const doneIds = res.results.filter((r) => r.outcome === 'checked_in').map((r) => r.id);
      setBanner({ text, kind, undoIds: !undo && doneIds.length > 0 ? doneIds : undefined });
      if (typeof navigator !== 'undefined') navigator.vibrate?.(kind === 'success' ? 40 : [60, 40, 60]);
    } else {
      setBanner({ text: res.error, kind: 'error' });
    }

    setBusy((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    refresh();
  }

  const arrivedCount = useMemo(() => guests.filter(isArrived).length, [guests]);
  const expectedCount = useMemo(() => guests.filter((g) => g.status !== 'refused').length, [guests]);
  const plusOnes = useMemo(() => plusOneStats(guests), [guests]);
  const recent = useMemo(() => recentArrivals(guests, 5), [guests]);
  const searching = query.trim().length > 0 || onlyExpected;
  const { rows, shown } = useMemo(
    () => buildRows(guests, { query, status: onlyExpected ? 'notArrived' : 'all', tag: 'all', sort: 'name' }),
    [guests, query, onlyExpected],
  );
  const visibleRows = rows.slice(0, MAX_RESULTS);
  const campaign = campaigns.find((c) => c.id === campaignId);
  const percent = expectedCount > 0 ? Math.min(100, Math.round((arrivedCount / expectedCount) * 100)) : 0;

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505]">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-44">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#050505]/95 backdrop-blur">
        <div className="mx-auto max-w-2xl space-y-3 px-4 pb-4 pt-3">
          <div className="flex items-center justify-between gap-3">
            <a href="/" className="shrink-0 py-3 pr-2 text-sm text-gray-400 hover:text-white">← Dashboard</a>
            {campaigns.length > 1 ? (
              <select
                value={campaignId ?? ''}
                onChange={(e) => chooseCampaign(e.target.value)}
                aria-label="Campaign"
                className="h-12 min-w-0 flex-1 truncate rounded-xl border border-white/15 bg-white/[0.06] px-3 text-base font-semibold text-white"
              >
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id} className="bg-[#111]">{c.name}</option>
                ))}
              </select>
            ) : (
              <p className="min-w-0 flex-1 truncate text-center text-base font-semibold">{campaign?.name ?? ''}</p>
            )}
            <button
              type="button"
              onClick={() => setShowScanner(true)}
              className="h-12 shrink-0 rounded-xl border border-white/20 bg-white/[0.06] px-5 text-base font-bold active:scale-95"
            >
              Scan QR
            </button>
          </div>

          <div>
            <div className="flex items-baseline gap-2" aria-live="polite">
              <span className="text-4xl font-bold tabular-nums">{arrivedCount}</span>
              <span className="text-xl text-gray-400">/ {expectedCount} arrived</span>
              {plusOnes.total > 0 && (
                <span className="ml-auto text-sm text-gray-400">Plus-ones {plusOnes.arrived}/{plusOnes.total}</span>
              )}
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Guests arrived">
              <div className="h-full rounded-full bg-emerald-400 transition-all duration-500" style={{ width: `${percent}%` }} />
            </div>
          </div>

          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a guest…"
            aria-label="Find a guest"
            autoFocus
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="h-16 w-full rounded-2xl border border-white/15 bg-white/[0.07] px-5 text-xl text-white placeholder-gray-500 outline-none focus:border-white/40"
          />
          <label className="flex items-center gap-3 text-base text-gray-300">
            <input type="checkbox" checked={onlyExpected} onChange={(e) => setOnlyExpected(e.target.checked)} className="h-5 w-5 accent-white" />
            Only guests still to arrive
          </label>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-5">
        {(campaignsError || guestsError) && (
          <p className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-base text-red-200" role="alert">
            {guestsError || campaignsError}
          </p>
        )}

        {campaignsLoaded && campaigns.length === 0 && (
          <p className="py-16 text-center text-lg text-gray-400">No campaigns yet. Create one in the dashboard first.</p>
        )}

        {campaignId && !loaded && !guestsError && <p className="py-16 text-center text-lg text-gray-400">Loading guests…</p>}

        {loaded && !searching && (
          <section aria-label="Recently arrived" className="space-y-3">
            <p className="text-center text-lg text-gray-400">Type a name to find a guest.</p>
            {recent.length > 0 && (
              <>
                <h2 className="pt-2 text-sm font-bold uppercase tracking-[0.2em] text-gray-500">Recently arrived</h2>
                {recent.map((g) => (
                  <div key={g.id} className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-lg font-semibold">{displayName(g)}</p>
                      <p className="text-sm text-emerald-200/80" suppressHydrationWarning>
                        {formatClock(g.arrivedAt)}{g.arrivedBy ? ` · by ${shortWho(g.arrivedBy)}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busy.has(g.id)}
                      onClick={() => doCheckIn([g.id], true)}
                      className="shrink-0 rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-gray-200 active:scale-95 disabled:opacity-50"
                    >
                      Undo
                    </button>
                  </div>
                ))}
              </>
            )}
          </section>
        )}

        {loaded && searching && (
          <section aria-label="Results" className="space-y-4">
            {visibleRows.length === 0 ? (
              <p className="py-12 text-center text-xl text-gray-300" role="status">No guest found</p>
            ) : (
              <>
                <p className="text-sm text-gray-500" role="status">
                  {shown > MAX_RESULTS ? `Showing the first ${MAX_RESULTS} of ${shown}. Keep typing to narrow it down.` : `${shown} guest${shown === 1 ? '' : 's'}`}
                </p>
                {visibleRows.map((row) => (
                  <GuestCard key={row.guest.id} row={row} busy={busy.has(row.guest.id)} onCheckIn={doCheckIn} />
                ))}
              </>
            )}
          </section>
        )}
      </main>

      {banner && (
        <div
          className={`fixed inset-x-0 bottom-0 z-40 border-t px-4 pb-6 pt-4 backdrop-blur ${
            banner.kind === 'success' ? 'border-emerald-500/40 bg-emerald-950/95' : banner.kind === 'warning' ? 'border-amber-500/50 bg-amber-950/95' : 'border-red-500/50 bg-red-950/95'
          }`}
          role={banner.kind === 'success' ? 'status' : 'alert'}
        >
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            <p className="min-w-0 flex-1 text-lg font-semibold leading-snug">
              {banner.kind === 'success' ? '✓ ' : banner.kind === 'warning' ? '⚠ ' : '✕ '}
              {banner.text}
            </p>
            {banner.undoIds && (
              <button
                type="button"
                onClick={() => { const ids = banner.undoIds!; setBanner(null); doCheckIn(ids, true); }}
                className="shrink-0 rounded-xl bg-white px-5 py-3 text-base font-bold text-black active:scale-95"
              >
                UNDO
              </button>
            )}
            <button type="button" onClick={() => setBanner(null)} aria-label="Dismiss" className="shrink-0 px-2 py-3 text-xl text-gray-300">✕</button>
          </div>
        </div>
      )}

      {showScanner && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          <div className="absolute inset-0 bg-black/80" onClick={() => setShowScanner(false)} />
          <div className="relative max-h-[92vh] w-full max-w-lg overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-sm">
            <div className="flex items-center justify-between border-b border-gray-100 bg-luxury-off-white p-5">
              <h3 className="font-cormorant text-xl uppercase tracking-widest text-luxury-dark">Scan a QR code</h3>
              <button type="button" onClick={() => setShowScanner(false)} aria-label="Close scanner" className="px-2 text-xl font-light text-luxury-muted">✕</button>
            </div>
            <div className="max-h-[78vh] overflow-y-auto p-6">
              <QRScanner onCheckedIn={refresh} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
