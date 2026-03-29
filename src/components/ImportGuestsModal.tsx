'use client';

import { useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { GuestData } from './AddGuestModal';

interface ParsedRow {
  firstName: string;
  lastName: string;
  email?: string;
  category?: string;
  [key: string]: string | undefined;
}

interface Props {
  campaignId: string;
  onImported: (guests: GuestData[]) => void;
  onClose: () => void;
}

function findColumnIdx(headers: string[], keywords: string[]): number {
  return headers.findIndex(h => keywords.some(kw => h.toLowerCase().includes(kw)));
}

export default function ImportGuestsModal({ campaignId, onImported, onClose }: Props) {
  const { user } = useAuth();
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<{ created: number; errors: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setRows([]);
    setHeaders([]);
    setDone(null);

    const ext = file.name.split('.').pop()?.toLowerCase();
    let parsed: ParsedRow[] = [];
    let detectedHeaders: string[] = [];

    if (ext === 'csv') {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
      if (lines.length < 2) { setError('CSV must have at least a header row and one data row.'); return; }

      const splitLine = (line: string) => line.split(/[,;]/).map(c => c.trim().replace(/^"|"$/g, ''));
      detectedHeaders = splitLine(lines[0]);

      const firstIdx = findColumnIdx(detectedHeaders, ['first', 'prénom', 'prenom']);
      const lastIdx = findColumnIdx(detectedHeaders, ['last', 'nom']);
      const nameIdx = findColumnIdx(detectedHeaders, ['name', 'fullname']);
      const emailIdx = findColumnIdx(detectedHeaders, ['email', 'mail']);
      const categoryIdx = findColumnIdx(detectedHeaders, ['category', 'vip', 'type', 'status']);

      if (firstIdx === -1 && lastIdx === -1 && nameIdx === -1) {
        setError('Could not find Name columns. Please ensure you have "First Name" and "Last Name" columns.');
        return;
      }

      for (let i = 1; i < lines.length; i++) {
        const cols = splitLine(lines[i]);
        let first = '', last = '';

        if (firstIdx !== -1) first = cols[firstIdx] || '';
        if (lastIdx !== -1) last = cols[lastIdx] || '';
        
        if (!first && !last && nameIdx !== -1 && cols[nameIdx]) {
          const parts = cols[nameIdx].split(' ');
          first = parts[0];
          last = parts.slice(1).join(' ');
        }

        if (!first && !last) continue; // Skip empty rows

        const row: ParsedRow = { firstName: first, lastName: last };
        if (emailIdx !== -1 && cols[emailIdx]) row.email = cols[emailIdx];
        if (categoryIdx !== -1 && cols[categoryIdx]) row.category = cols[categoryIdx];

        detectedHeaders.forEach((h, idx) => {
          if (idx !== firstIdx && idx !== lastIdx && idx !== nameIdx && idx !== emailIdx && idx !== categoryIdx && cols[idx]) {
            row[h] = cols[idx];
          }
        });
        parsed.push(row);
      }

    } else if (ext === 'xlsx' || ext === 'xls') {
      const { read, utils } = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const wb = read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data: Record<string, string>[] = utils.sheet_to_json(ws, { defval: '' });

      if (data.length === 0) { setError('No data found in the file.'); return; }

      detectedHeaders = Object.keys(data[0]);
      
      const firstKey = detectedHeaders.find(h => ['first', 'prénom', 'prenom'].some(kw => h.toLowerCase().includes(kw)));
      const lastKey = detectedHeaders.find(h => ['last', 'nom'].some(kw => h.toLowerCase().includes(kw)));
      const nameKey = detectedHeaders.find(h => ['name', 'fullname'].some(kw => h.toLowerCase().includes(kw)));
      const emailKey = detectedHeaders.find(h => ['email', 'mail'].some(kw => h.toLowerCase().includes(kw)));
      const categoryKey = detectedHeaders.find(h => ['category', 'vip', 'type', 'status'].some(kw => h.toLowerCase().includes(kw)));

      if (!firstKey && !lastKey && !nameKey) {
        setError('Could not find Name columns. Please ensure you have "First Name" and "Last Name" columns.');
        return;
      }

      for (const row of data) {
        let first = '', last = '';
        if (firstKey) first = String(row[firstKey] ?? '').trim();
        if (lastKey) last = String(row[lastKey] ?? '').trim();
        
        if (!first && !last && nameKey && row[nameKey]) {
          const parts = String(row[nameKey]).trim().split(' ');
          first = parts[0];
          last = parts.slice(1).join(' ');
        }

        if (!first && !last) continue;

        const entry: ParsedRow = { firstName: first, lastName: last };
        if (emailKey && row[emailKey]) entry.email = String(row[emailKey]).trim();
        if (categoryKey && row[categoryKey]) entry.category = String(row[categoryKey]).trim();

        detectedHeaders.forEach(k => {
          if (k !== firstKey && k !== lastKey && k !== nameKey && k !== emailKey && k !== categoryKey && row[k] !== '' && row[k] !== undefined) {
            entry[k] = String(row[k]);
          }
        });
        parsed.push(entry);
      }
    } else {
      setError('Please upload a .csv, .xlsx, or .xls file.');
      return;
    }

    if (parsed.length === 0) {
      setError('No valid guest rows found.');
      return;
    }

    const standardKeys = ['firstName', 'lastName', 'email', 'category'];
    const extraHeaders = Array.from(new Set(parsed.flatMap(r => Object.keys(r).filter(k => !standardKeys.includes(k)))));
    
    setHeaders(extraHeaders);
    setRows(parsed);
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
      if (!res.ok) throw new Error(data.error || 'Import failed');
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
      
      <div className="relative w-full max-w-3xl bg-white/[0.03] border border-white/5 backdrop-blur-3xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500">
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
