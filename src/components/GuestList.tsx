'use client';

import { useEffect, useMemo, useState } from 'react';
import type { WorkBook } from 'xlsx';
import type { GuestData } from './AddGuestModal';
import {
  buildExportRows,
  buildRows,
  collectTags,
  countStatuses,
  displayName,
  formatClock,
  isArrived,
  plusOneStats,
  shortWho,
  tagHue,
  tagKey,
  toMs,
  type SortKey,
  type StatusFilter,
} from '@/lib/guest-list';
import { buildWorkbook, exportFileName } from '@/lib/export-guests';

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'arrived', label: 'Arrived' },
  { key: 'notArrived', label: 'Not arrived' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'invited', label: 'Invited' },
];

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'newest', label: 'Newest first' },
  { key: 'name', label: 'Name (A–Z)' },
  { key: 'arrival', label: 'Arrival time' },
  { key: 'status', label: 'Status' },
];

const STATUS_LABEL: Record<string, string> = {
  pending: 'Invited', invited: 'Invited', confirmed: 'Confirmed', accepted: 'Accepted', arrived: 'Arrived', refused: 'Refused',
};

function registeredLabel(value: unknown): string {
  const ms = toMs(value);
  return ms === null ? 'Now' : new Date(ms).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function TagPill({ tag }: { tag: string }) {
  const key = tagKey(tag);
  if (key === 'standard') return <span className="text-[9px] text-gray-700 font-mono tracking-widest">STANDARD</span>;
  if (key === 'vip') {
    return (
      <span className="text-[9px] font-bold px-2.5 py-1 rounded-full border tracking-widest bg-white text-black border-transparent shadow-[0_0_15px_rgba(255,255,255,0.3)]">
        VIP
      </span>
    );
  }
  const hue = tagHue(tag);
  return (
    <span
      className="text-[9px] font-bold px-2.5 py-1 rounded-full border tracking-widest uppercase"
      style={{ backgroundColor: `hsl(${hue} 55% 50% / 0.15)`, borderColor: `hsl(${hue} 55% 60% / 0.45)`, color: `hsl(${hue} 80% 78%)` }}
    >
      {tag}
    </span>
  );
}

interface Props {
  guests: GuestData[];
  campaignName: string;
  /** Guests whose check-in is being sent right now. */
  checkingIds: Set<string>;
  onCheckIn: (ids: string[], undo: boolean) => void;
  onEdit: (guest: GuestData) => void;
  onDelete: (guest: GuestData) => void;
  deleting: boolean;
  onToast: (message: string, kind: 'success' | 'error' | 'warning') => void;
}

export default function GuestList({ guests, campaignName, checkingIds, onCheckIn, onEdit, onDelete, deleting, onToast }: Props) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [tag, setTag] = useState('all');
  const [sort, setSort] = useState<SortKey>('newest');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);

  const counts = useMemo(() => countStatuses(guests), [guests]);
  const tags = useMemo(() => collectTags(guests), [guests]);
  const plusOnes = useMemo(() => plusOneStats(guests), [guests]);
  const extraKeys = useMemo(() => Array.from(new Set(guests.flatMap((g) => Object.keys(g.extraFields ?? {})))), [guests]);

  // A tag filter for a tag nobody has any more (after edits) falls back to "all".
  const activeTag = tag !== 'all' && !tags.some((t) => t.key === tag) ? 'all' : tag;
  const { rows, shown } = useMemo(() => buildRows(guests, { query, status, tag: activeTag, sort }), [guests, query, status, activeTag, sort]);

  // Forget selected guests who no longer exist (deleted, or another campaign opened).
  useEffect(() => {
    setSelected((prev) => {
      const ids = new Set(guests.map((g) => g.id));
      const kept = [...prev].filter((id) => ids.has(id));
      return kept.length === prev.size ? prev : new Set(kept);
    });
  }, [guests]);

  const visibleIds = useMemo(() => rows.filter((r) => !r.context).map((r) => r.guest.id), [rows]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const selectedGuests = useMemo(() => guests.filter((g) => selected.has(g.id)), [guests, selected]);
  const toArrive = selectedGuests.filter((g) => !isArrived(g)).map((g) => g.id);
  const toUndo = selectedGuests.filter((g) => isArrived(g)).map((g) => g.id);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function runBulk(ids: string[], undo: boolean) {
    if (ids.length === 0) return;
    onCheckIn(ids, undo);
    setSelected(new Set());
  }

  async function handleExport() {
    setExporting(true);
    try {
      const XLSX = await import('xlsx'); // loaded only when needed
      const workbook = buildWorkbook(XLSX as never, buildExportRows(guests)) as WorkBook;
      XLSX.writeFile(workbook, exportFileName(campaignName));
    } catch (err) {
      console.error('Export failed:', err);
      onToast('Export failed. Please try again.', 'error');
    } finally {
      setExporting(false);
    }
  }

  const selectClass =
    'bg-white/[0.03] border border-white/10 rounded-full pl-4 pr-8 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-300 outline-none focus:border-white/30 cursor-pointer appearance-none';

  return (
    <div className="bg-white/[0.02] border border-white/5 backdrop-blur-3xl rounded-[2.5rem] overflow-hidden shadow-2xl transition-all duration-700 hover:border-white/10">
      {guests.length > 0 && (
        <div className="p-6 border-b border-white/5 space-y-4">
          <div className="flex flex-col lg:flex-row gap-4 lg:items-center">
            <div className="relative flex-1 max-w-xl">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 text-sm" aria-hidden="true">🔍</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, email, tag or note…"
                aria-label="Search guests"
                className="w-full bg-white/[0.03] border border-white/10 rounded-2xl pl-12 pr-10 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-white/30 focus:bg-white/[0.05] transition-all duration-300"
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-xs transition">
                  ✕
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2 lg:ml-auto">
              <a
                href="/door"
                className="text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-full border border-white/10 bg-white/[0.03] text-gray-300 hover:border-white/30 hover:text-white transition"
              >
                Door mode
              </a>
              <button
                type="button"
                onClick={handleExport}
                disabled={exporting}
                className="text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-full border border-white/10 bg-white/[0.03] text-gray-300 hover:border-white/30 hover:text-white transition disabled:opacity-50"
              >
                {exporting ? 'Exporting…' : 'Export Excel'}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setStatus(f.key)}
                className={`text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-full border transition ${
                  status === f.key ? 'bg-white text-black border-white' : 'bg-white/[0.03] text-gray-400 border-white/10 hover:border-white/30 hover:text-white'
                }`}
              >
                {f.label} <span className="opacity-60 ml-1">{counts[f.key]}</span>
              </button>
            ))}
            <div className="flex flex-wrap gap-2 sm:ml-auto">
              <label className="relative">
                <span className="sr-only">Filter by tag</span>
                <select value={activeTag} onChange={(e) => setTag(e.target.value)} className={selectClass} aria-label="Filter by tag">
                  <option value="all" className="bg-[#111]">All tags</option>
                  {tags.map((t) => (
                    <option key={t.key} value={t.key} className="bg-[#111]">{t.label} ({t.count})</option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-[8px]">▼</span>
              </label>
              <label className="relative">
                <span className="sr-only">Sort by</span>
                <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={selectClass} aria-label="Sort guests">
                  {SORTS.map((s) => (
                    <option key={s.key} value={s.key} className="bg-[#111]">Sort: {s.label}</option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-[8px]">▼</span>
              </label>
            </div>
          </div>

          <p className="text-[10px] text-gray-600 uppercase tracking-[0.2em]">
            Showing {shown} of {guests.length} guests
            {plusOnes.total > 0 && <> · Plus-ones arrived: {plusOnes.arrived} of {plusOnes.total}</>}
          </p>

          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/15 bg-white/[0.06] px-5 py-3" role="region" aria-label="Selected guests">
              <span className="text-xs font-bold text-white">{selected.size} selected</span>
              <button
                type="button"
                disabled={toArrive.length === 0}
                onClick={() => runBulk(toArrive, false)}
                className="text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-xl bg-white text-black hover:bg-gray-200 transition active:scale-95 disabled:opacity-40"
              >
                Check in {toArrive.length}
              </button>
              {toUndo.length > 0 && (
                <button
                  type="button"
                  onClick={() => runBulk(toUndo, true)}
                  className="text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-xl border border-white/15 text-gray-300 hover:text-white hover:border-white/40 transition"
                >
                  Undo {toUndo.length} check-in{toUndo.length === 1 ? '' : 's'}
                </button>
              )}
              <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-[10px] text-gray-500 hover:text-white uppercase tracking-widest font-bold transition">
                Clear selection
              </button>
            </div>
          )}
        </div>
      )}

      {guests.length === 0 ? (
        <div className="py-40 text-center">
          <div className="text-6xl mb-6 grayscale opacity-20">🎟️</div>
          <p className="text-white font-display text-xl font-bold tracking-tight">Your guest list is empty</p>
          <p className="text-gray-600 text-[10px] mt-2 uppercase tracking-[0.2em]">Begin by importing data or manual entry</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="py-24 text-center">
          <p className="text-white font-display text-lg font-bold tracking-tight">No guests match</p>
          <p className="text-gray-600 text-[10px] mt-2 uppercase tracking-[0.2em]">Try a different name or clear the filters</p>
          <button
            type="button"
            onClick={() => { setQuery(''); setStatus('all'); setTag('all'); }}
            className="mt-6 text-[10px] font-bold uppercase tracking-widest px-5 py-2.5 rounded-full border border-white/10 text-gray-300 hover:border-white/30 hover:text-white transition"
          >
            Clear search and filters
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-white/5">
                <th className="pl-6 pr-2 py-6 w-10">
                  <input
                    type="checkbox"
                    aria-label="Select all shown guests"
                    checked={allVisibleSelected}
                    onChange={() => setSelected(allVisibleSelected ? new Set() : new Set(visibleIds))}
                    className="h-4 w-4 accent-white cursor-pointer"
                  />
                </th>
                {['', 'Guest', 'Email', 'Tag', 'Status', 'Arrival', ...extraKeys, 'Registered', ''].map((h, i) => (
                  <th key={i} className={`${i === 0 ? 'w-16 px-3' : 'px-6'} py-6 text-[10px] text-gray-500 uppercase tracking-[0.3em] font-bold whitespace-nowrap font-display`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {rows.map(({ guest, depth, host, context, party }) => {
                const arrived = isArrived(guest);
                const busy = checkingIds.has(guest.id);
                const name = displayName(guest);
                const pending = party?.pendingIds.length ?? 0;
                return (
                  <tr
                    key={guest.id}
                    className={`group transition-all duration-300 hover:bg-white/[0.03] ${arrived ? 'bg-emerald-500/[0.05]' : ''} ${context ? 'opacity-50' : ''} ${selected.has(guest.id) ? 'bg-white/[0.07]' : ''}`}
                  >
                    <td className="pl-6 pr-2 py-5">
                      <input
                        type="checkbox"
                        aria-label={`Select ${name}`}
                        checked={selected.has(guest.id)}
                        onChange={() => toggle(guest.id)}
                        className="h-4 w-4 accent-white cursor-pointer"
                      />
                    </td>
                    <td className="px-3 py-5 whitespace-nowrap">
                      <div className="flex items-center justify-center">
                        {guest.portraitUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={guest.portraitUrl}
                            alt={name}
                            className="w-10 h-10 rounded-full object-cover border border-white/10 shadow-lg"
                            onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=333&color=fff`; }}
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-bold text-gray-500">
                            {name.charAt(0)}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className={`flex flex-col gap-1 ${depth === 1 ? 'pl-5 border-l border-white/10' : ''}`}>
                        <span className="flex items-center gap-2 text-sm font-medium text-white tracking-tight whitespace-nowrap">
                          {depth === 1 && <span className="text-gray-600" aria-hidden="true">↳</span>}
                          {name}
                          {depth === 1 && host && (
                            <span className="text-[8px] bg-white/10 text-gray-400 px-1.5 py-0.5 rounded uppercase tracking-tighter">Plus-one of {displayName(host)}</span>
                          )}
                          {depth === 0 && guest.parentId && (
                            <span className="text-[8px] bg-white/10 text-gray-400 px-1.5 py-0.5 rounded uppercase tracking-tighter">Plus-one</span>
                          )}
                          {party && (
                            <span className="text-[9px] font-bold border border-white/15 text-gray-300 rounded-full px-2 py-0.5 tracking-wide">
                              +{party.total} · {party.arrived}/{party.total} arrived
                            </span>
                          )}
                        </span>
                        {guest.notes && (
                          <span className="text-[11px] text-amber-300/90 italic max-w-xs truncate" title={guest.notes}>📝 {guest.notes}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-xs text-gray-500 whitespace-nowrap font-mono">{guest.email || '—'}</td>
                    <td className="px-6 py-5 whitespace-nowrap"><TagPill tag={(guest.category ?? '').trim() || 'Standard'} /></td>
                    <td className="px-6 py-5">
                      <span
                        className={`text-[9px] font-bold px-3 py-1.5 rounded-full border whitespace-nowrap tracking-widest uppercase ${
                          arrived ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' : 'bg-transparent border-white/10 text-gray-500'
                        }`}
                      >
                        {STATUS_LABEL[guest.status] ?? guest.status}
                      </span>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap">
                      {arrived ? (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-mono text-emerald-300" suppressHydrationWarning>{formatClock(guest.arrivedAt)}</span>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => onCheckIn([guest.id], true)}
                              className="text-[9px] text-gray-600 hover:text-red-400 uppercase tracking-widest font-bold transition disabled:opacity-40"
                              title="Undo this check-in"
                            >
                              Undo
                            </button>
                          </div>
                          {guest.arrivedBy && (
                            <span className="text-[9px] text-gray-500 uppercase tracking-widest" title={guest.arrivedBy}>by {shortWho(guest.arrivedBy)}</span>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onCheckIn([guest.id], false)}
                          className="text-[10px] font-bold px-4 py-2 rounded-xl bg-white text-black hover:bg-gray-200 transition active:scale-95 disabled:opacity-50 uppercase tracking-widest"
                        >
                          Check in
                        </button>
                      )}
                      {party && pending >= (arrived ? 1 : 2) && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onCheckIn(party.pendingIds, false)}
                          className="mt-1.5 block text-[9px] text-gray-400 hover:text-white uppercase tracking-widest font-bold transition disabled:opacity-40"
                        >
                          {arrived ? `Check in plus-ones (${pending})` : `Check in whole party (${pending})`}
                        </button>
                      )}
                    </td>
                    {extraKeys.map((key) => (
                      <td key={key} className="px-6 py-5 text-xs text-gray-400 whitespace-nowrap font-mono">
                        {guest.extraFields?.[key] ?? <span className="text-gray-800">—</span>}
                      </td>
                    ))}
                    <td className="px-6 py-5 text-[10px] text-gray-600 font-mono whitespace-nowrap uppercase tracking-tighter" suppressHydrationWarning>
                      {registeredLabel(guest.createdAt)}
                    </td>
                    <td className="px-6 py-5 text-right opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-all duration-300">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => onEdit(guest)}
                          className="p-2.5 bg-white/5 hover:bg-luxury-gold text-gray-400 hover:text-white rounded-xl border border-white/5 transition-all duration-300"
                          title="Edit guest"
                          aria-label={`Edit ${name}`}
                        >
                          ✍️
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(guest)}
                          disabled={deleting}
                          className="p-2.5 bg-white/5 hover:bg-red-500/80 text-gray-400 hover:text-white rounded-xl border border-white/5 transition-all duration-300"
                          title="Delete guest"
                          aria-label={`Delete ${name}`}
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
