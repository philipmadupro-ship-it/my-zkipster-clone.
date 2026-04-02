'use client';

import { useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { GuestData } from './AddGuestModal';

interface ParsedRow {
  firstName: string;
  lastName: string;
  email?: string;
  category?: string;
  portraitUrl?: string;
  parentId?: string;
  [key: string]: string | undefined;
}

interface Props {
  campaignId: string;
  onImported: (guests: GuestData[]) => void;
  onClose: () => void;
}

export default function ImportGuestsModal({ campaignId, onImported, onClose }: Props) {
  const { user } = useAuth();
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<{ created: number; errors: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /**
   * Universal file handler for .csv, .xlsx, and .xls
   * Uses 'xlsx' library for robust parsing and a heuristic-based column mapper.
   */
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setRows([]);
    setHeaders([]);
    setDone(null);

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext || '')) {
      setError('Please upload a .csv, .xlsx, or .xls file.');
      return;
    }

    try {
      setLoading(true);
      const { read, utils } = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const wb = read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      
      // Read as 2D array to handle headers manually and reliably
      const rawData: any[][] = utils.sheet_to_json(ws, { defval: '', header: 1 });

      if (rawData.length < 2) {
        setError('The file must contain a header row and at least one guest record.');
        setLoading(false);
        return;
      }

      const fileHeaders = rawData[0].map((h: any) => String(h || '').trim());
      const dataRows = rawData.slice(1);

      // Advanced Heuristic Mapping
      const mappingDict = {
        first: ['first', 'prénom', 'prenom', 'given', 'fname', '1st', 'prnom'],
        last: ['last', 'nom', 'surname', 'family', 'lname', 'lastname'],
        full: ['name', 'fullname', 'guest', 'nom complet', 'identity', 'nomcomplet'],
        email: ['email', 'mail', 'courriel', 'e-mail', 'contact'],
        category: ['category', 'vip', 'type', 'status', 'group', 'tag', 'catégorie', 'catgorie'],
        portrait: ['portrait', 'image', 'photo', 'picture', 'avatar', 'url'],
        plusOne: ['parent', 'plusone', 'plus-one', 'principal', 'host', 'associated']
      };

      const findIdx = (keywords: string[]) => 
        fileHeaders.findIndex((h: string) => 
          keywords.some(kw => h.toLowerCase().replace(/[^a-z0-9]/g, '').includes(kw))
        );

      const idxMap = {
        first: findIdx(mappingDict.first),
        last: findIdx(mappingDict.last),
        full: findIdx(mappingDict.full),
        email: findIdx(mappingDict.email),
        category: findIdx(mappingDict.category),
        portrait: findIdx(mappingDict.portrait),
        plusOne: findIdx(mappingDict.plusOne)
      };

      if (idxMap.first === -1 && idxMap.last === -1 && idxMap.full === -1) {
        setError('Header Identification Error: Could not find Name columns. Please label your columns clearly (e.g. "First Name").');
        setLoading(false);
        return;
      }

      const parsed: ParsedRow[] = [];
      dataRows.forEach((cols: any[]) => {
        let first = '', last = '';
        
        if (idxMap.first !== -1) first = String(cols[idxMap.first] || '').trim();
        if (idxMap.last !== -1) last = String(cols[idxMap.last] || '').trim();

        // Fallback to Full Name split if individual parts are missing
        if (!first && !last && idxMap.full !== -1 && cols[idxMap.full]) {
          const full = String(cols[idxMap.full]).trim();
          const parts = full.split(' ');
          first = parts[0];
          last = parts.slice(1).join(' ');
        }

        // Only skip if there's absolutely no identifying data
        if (!first && !last && (!idxMap.email || !cols[idxMap.email])) return; 

        const row: ParsedRow = { firstName: first, lastName: last };
        if (idxMap.email !== -1 && cols[idxMap.email]) row.email = String(cols[idxMap.email]).trim();
        if (idxMap.category !== -1 && cols[idxMap.category]) row.category = String(cols[idxMap.category]).trim();
        if (idxMap.portrait !== -1 && cols[idxMap.portrait]) row.portraitUrl = String(cols[idxMap.portrait]).trim();
        if (idxMap.plusOne !== -1 && cols[idxMap.plusOne]) row.parentId = String(cols[idxMap.plusOne]).trim();

        // Capture Extra Metadata for any columns not already mapped
        fileHeaders.forEach((h: string, idx: number) => {
          const isStandard = Object.values(idxMap).includes(idx);
          if (!isStandard && cols[idx] !== undefined && String(cols[idx]).trim() !== '') {
            row[h] = String(cols[idx]).trim();
          }
        });

        parsed.push(row);
      });

      if (parsed.length === 0) {
        setError('Semantic analysis found zero valid records in the provided file.');
      } else {
        const standardKeys = ['firstName', 'lastName', 'email', 'category', 'portraitUrl', 'parentId'];
        const extraHeaders = Array.from(new Set(parsed.flatMap(r => Object.keys(r).filter(k => !standardKeys.includes(k)))));
        setHeaders(extraHeaders);
        setRows(parsed);
      }
    } catch (err) {
      console.error('Handover Error:', err);
      setError('Corrupted or invalid file format detected.');
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    if (!rows.length || !user?.email || !campaignId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guests: rows, campaignId, ownerEmail: user.email.toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Synchronization failed');
      setDone({ created: data.created, errors: data.errors?.length ?? 0 });
      onImported(data.guests);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  }

  const previewCols = ['firstName', 'lastName', ...headers.slice(0, 3)];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-2xl transition-opacity animate-in fade-in duration-500" onClick={onClose} />
      
      <div className="relative w-full max-w-3xl bg-[#111111] border border-white/5 backdrop-blur-3xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500">
        <div className="px-10 py-8 border-b border-white/5 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-display font-bold text-white tracking-tight">Bulk Import</h2>
            <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-[0.2em] font-bold">Intelligent Guest Normalization</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-600 hover:text-white transition-colors">
            <span className="text-2xl font-light">✕</span>
          </button>
        </div>

        <div className="p-10 space-y-8">
          {done ? (
            <div className="text-center py-12 animate-in fade-in zoom-in duration-700">
              <div className="text-7xl mb-6 grayscale opacity-40">🌟</div>
              <p className="text-3xl font-display font-bold text-white mb-2 tracking-tight">{done.created} Guests Registered</p>
              {done.errors > 0 && <p className="text-sm text-gray-500 font-mono tracking-widest uppercase">{done.errors} DATA COLLISIONS RESOLVED</p>}
              <button onClick={onClose} className="mt-10 bg-white text-black font-bold px-10 py-4 rounded-2xl transition hover:bg-gray-200 active:scale-95 shadow-[0_0_30px_rgba(255,255,255,0.2)] uppercase text-[11px] tracking-widest">
                Return to Dashboard
              </button>
            </div>
          ) : (
            <>
              <label className="block cursor-pointer group">
                <div className={`border border-dashed rounded-3xl p-12 text-center transition-all duration-500
                  ${rows.length > 0 ? 'border-white/40 bg-white/5 shadow-[0_0_30px_rgba(255,255,255,0.05)]' : 'border-white/10 hover:border-white/30 bg-white/[0.01]'}`}>
                  <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-500">📂</div>
                  <p className="text-lg font-display font-bold text-white tracking-tight">
                    {rows.length > 0
                       ? `${rows.length} records identified`
                       : 'Deploy Guest List'}
                  </p>
                  <p className="text-[10px] text-gray-600 mt-2 uppercase tracking-[0.2em] font-bold group-hover:text-gray-400 transition-colors">Select .xlsx or .csv data source</p>
                </div>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
              </label>

              {rows.length === 0 && !error && (
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">Required Column Mapping</p>
                  <div className="flex gap-4">
                    <div className="px-3 py-1 bg-white/[0.04] border border-white/10 rounded-full text-[9px] font-mono text-gray-400">FIRST NAME</div>
                    <div className="px-3 py-1 bg-white/[0.04] border border-white/10 rounded-full text-[9px] font-mono text-gray-400">LAST NAME</div>
                    <div className="px-3 py-1 bg-white/[0.04] border border-white/10 rounded-full text-[9px] font-mono text-gray-400">EMAIL (OPTIONAL)</div>
                  </div>
                  <p className="mt-4 text-[9px] text-gray-700 italic">Advanced heuristic: Auto-detects names, emails, and categories from any spreadsheet structure.</p>
                </div>
              )}

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-red-100 text-[10px] font-bold uppercase tracking-widest">{error}</div>
              )}

              {rows.length > 0 && (
                <div className="animate-in slide-in-from-bottom-4 duration-500">
                  <p className="text-[10px] text-gray-600 uppercase tracking-[0.2em] font-bold mb-4 ml-1">
                    Intelligence Analysis — {rows.length} Found
                  </p>
                  <div className="bg-black/40 border border-white/5 rounded-3xl overflow-auto max-h-56 custom-scrollbar">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-white/5 border-b border-white/5">
                          {previewCols.map(col => (
                            <th key={col} className="px-6 py-4 text-[9px] font-bold text-gray-500 uppercase tracking-widest font-display">
                              {col === 'firstName' ? 'First' : col === 'lastName' ? 'Last' : col}
                            </th>
                          ))}
                          {headers.length > 3 && <th className="px-6 py-4 text-[9px] text-gray-700">…</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.02]">
                        {rows.slice(0, 50).map((row, i) => (
                          <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                            {previewCols.map(col => (
                              <td key={col} className={`px-6 py-3 text-[11px] truncate max-w-[150px] font-medium tracking-tight ${['firstName','lastName'].includes(col) ? 'text-white' : 'text-gray-500'}`}>
                                {row[col] ?? '—'}
                              </td>
                            ))}
                            {headers.length > 3 && <td className="px-6 py-3 text-gray-800">…</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <button onClick={onClose} className="flex-1 px-6 py-4 rounded-2xl border border-white/10 text-white font-bold text-[11px] uppercase tracking-widest hover:bg-white/5 transition-all">
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={rows.length === 0 || loading}
                  className="flex-2 px-12 py-4 rounded-2xl bg-white text-black font-bold text-[11px] uppercase tracking-widest hover:bg-gray-200 transition-all active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.1)] disabled:opacity-30"
                >
                  {loading ? `Synchronizing ${rows.length}...` : `Initialize Import`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
