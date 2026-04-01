'use client';

import { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';

interface ScanResult {
  status: 'confirmed' | 'arrived' | 'invited' | 'pending' | 'accepted' | 'refused' | 'not_found' | null;
  name?: string;
  email?: string;
  portraitUrl?: string;
  category?: string;
  seatNumber?: string;
  arrivedAt?: string;
  error?: string;
}

function extractGuestId(text: string): string | null {
  try {
    const url = new URL(text);
    const parts = url.pathname.split('/').filter(Boolean);
    const rsvpIdx = parts.indexOf('rsvp');
    if (rsvpIdx !== -1 && parts[rsvpIdx + 1]) return parts[rsvpIdx + 1];
  } catch { /* not a URL */ }
  // Try as raw ID
  if (/^[a-zA-Z0-9]{20}$/.test(text.trim())) return text.trim();
  return null;
}

export default function QRScanner() {
  const [mode, setMode] = useState<'camera' | 'upload'>('camera');
  const [scanResult, setScanResult] = useState<ScanResult>({ status: null });
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [currentGuestId, setCurrentGuestId] = useState<string | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const scannerDivRef = useRef<HTMLDivElement>(null);

  function resetScan() {
    setScanResult({ status: null });
    setCheckedIn(false);
    setCurrentGuestId(null);
  }

  async function handleScan(decodedText: string) {
    const guestId = extractGuestId(decodedText);
    if (!guestId || guestId === currentGuestId) return;
    setCurrentGuestId(guestId);

    try {
      const res = await fetch(`/api/guest/${guestId}`);
      if (!res.ok) {
        setScanResult({ status: 'not_found', error: 'Guest not found' });
        return;
      }
      const data = await res.json();
      setScanResult({
        status: data.status,
        name: data.name,
        email: data.email,
        portraitUrl: data.portraitUrl,
        category: data.category,
        seatNumber: data.seatNumber,
        arrivedAt: data.arrivedAt,
      });
    } catch {
      setScanResult({ status: 'not_found', error: 'Network error' });
    }
  }

  async function handleCheckIn() {
    if (!currentGuestId) return;
    setCheckingIn(true);
    try {
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestId: currentGuestId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setScanResult(prev => ({ ...prev, status: 'arrived' }));
      setCheckedIn(true);
    } catch (err) {
      setScanResult(prev => ({ ...prev, error: err instanceof Error ? err.message : 'Check-in failed' }));
    } finally {
      setCheckingIn(false);
    }
  }

  // Camera scanner lifecycle
  useEffect(() => {
    if (mode !== 'camera') return;
    if (!scannerDivRef.current) return;

    const scanner = new Html5QrcodeScanner(
      'qr-reader',
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
      },
      false
    );

    scanner.render(
      (decodedText) => {
        if (!currentGuestId) handleScan(decodedText);
      },
      () => { /* scan error — ignore */ }
    );

    scannerRef.current = scanner;
    return () => {
      scanner.clear().catch(() => {});
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // File upload scan
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const { Html5Qrcode } = await import('html5-qrcode');
    const reader = new Html5Qrcode('qr-reader-file');
    try {
      const result = await reader.scanFile(file, true);
      handleScan(result);
    } catch {
      setScanResult({ status: 'not_found', error: 'No QR code found in image' });
    }
    try { reader.clear(); } catch { /* ignore */ }
  }



  return (
    <div className="space-y-6">
      {/* Mode Toggle */}
      <div className="flex bg-gray-800 rounded-xl p-1 gap-1">
        {(['camera', 'upload'] as const).map(m => (
          <button
            key={m}
            onClick={() => { setMode(m); resetScan(); }}
            className={`flex-1 py-3 rounded-lg text-xs font-bold uppercase tracking-widest transition duration-500 ${mode === m
              ? 'bg-luxury-gold text-white shadow-lg'
              : 'text-gray-500 hover:text-luxury-dark'}`}
          >
            {m === 'camera' ? 'Camera' : 'Upload'}
          </button>
        ))}
      </div>

      {/* Scanner area */}
      {!scanResult.status && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          {mode === 'camera' ? (
            <div ref={scannerDivRef}>
              <div id="qr-reader" className="w-full" />
            </div>
          ) : (
            <div className="p-12 text-center">
              <div id="qr-reader-file" className="hidden" />
              <div className="w-24 h-24 bg-luxury-off-white rounded-full flex items-center justify-center mx-auto mb-6 text-2xl border border-gray-100 shadow-inner">
                🖼️
              </div>
              <p className="text-luxury-muted text-[13px] mb-8 uppercase tracking-widest font-light">Select a high-resolution photo</p>
              <label className="cursor-pointer inline-block bg-luxury-dark hover:bg-black text-white text-[11px] uppercase tracking-[0.2em] font-bold px-8 py-4 rounded-sm transition-all duration-500 shadow-xl">
                Upload Image
                <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
          )}
        </div>
      )}

      {/* Scan Result */}
      {scanResult.status && (
        <div className={`rounded-sm border p-8 shadow-2xl transition-all duration-700 animate-fade-up ${
          checkedIn || scanResult.status === 'arrived' ? 'bg-white border-emerald-100' :
          ['confirmed', 'accepted', 'invited', 'pending'].includes(scanResult.status) ? 'bg-white border-luxury-gold/20' :
          scanResult.status === 'refused' ? 'bg-white border-red-100' :
          'bg-white border-gray-100'
        }`}>
          {/* Not Arrived Yet — show check-in button */}
          {['confirmed', 'accepted', 'invited', 'pending'].includes(scanResult.status) && !checkedIn && (
            <div className="text-center space-y-6">
              <div className="relative inline-block">
                <div className="w-28 h-28 rounded-full overflow-hidden mx-auto border-2 border-luxury-gold p-1 bg-white shadow-xl">
                  {scanResult.portraitUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={scanResult.portraitUrl} alt={scanResult.name} className="w-full h-full object-cover rounded-full" />
                  ) : (
                    <div className="w-full h-full bg-luxury-off-white flex items-center justify-center text-luxury-gold text-2xl font-cormorant">
                      {scanResult.name?.charAt(0)}
                    </div>
                  )}
                </div>
                {scanResult.category === 'VIP' && (
                  <span className="absolute -top-1 -right-1 bg-luxury-gold text-white text-[8px] font-bold px-2 py-1 rounded-full shadow-lg animate-pulse">VIP</span>
                )}
              </div>
              
              <div className="space-y-1">
                <p className="text-2xl font-cormorant text-luxury-dark uppercase tracking-widest">{scanResult.name}</p>
                <div className="flex items-center justify-center gap-3">
                    <span className="text-[10px] uppercase tracking-widest text-luxury-muted">{scanResult.category}</span>
                    <span className="w-1 h-1 bg-luxury-gold rounded-full opacity-30" />
                    <span className="text-[10px] uppercase tracking-widest text-luxury-dark font-bold">Seat {scanResult.seatNumber}</span>
                </div>
              </div>

              <button
                onClick={handleCheckIn}
                disabled={checkingIn}
                className="w-full bg-luxury-gold hover:bg-[#7a654a] disabled:opacity-50 text-white font-bold py-5 rounded-sm transition-all duration-500 text-[13px] uppercase tracking-[0.3em] shadow-xl active:scale-95"
              >
                {checkingIn ? 'Processing…' : `Confirm Arrival`}
              </button>
            </div>
          )}

          {/* Arrived */}
          {(scanResult.status === 'arrived' || checkedIn) && (
            <div className="text-center space-y-6">
              <div className="w-28 h-28 rounded-full overflow-hidden mx-auto border-4 border-emerald-500/20 p-1 bg-white shadow-2xl">
                 {scanResult.portraitUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={scanResult.portraitUrl} alt={scanResult.name} className="w-full h-full object-cover rounded-full" />
                  ) : (
                    <div className="w-full h-full bg-emerald-50 flex items-center justify-center text-emerald-600 text-2xl font-cormorant">
                      {scanResult.name?.charAt(0)}
                    </div>
                  )}
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-[0.3em]">Arrived & Verified</p>
                <p className="text-2xl font-cormorant text-luxury-dark uppercase tracking-widest">{scanResult.name}</p>
                {scanResult.arrivedAt && (
                  <p className="text-[10px] text-luxury-muted uppercase tracking-widest mt-2">
                    Entry at {new Date(scanResult.arrivedAt).toLocaleTimeString()}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Refused */}
          {scanResult.status === 'refused' && (
            <div className="text-center space-y-3">
              <div className="text-5xl">⛔</div>
              <p className="text-xl font-bold text-red-300">Refused Invitation</p>
              <p className="text-sm text-gray-400">This guest responded that they cannot attend.</p>
              {scanResult.name && <p className="text-white font-medium">{scanResult.name || scanResult.email}</p>}
            </div>
          )}

          {/* Not found */}
          {scanResult.status === 'not_found' && (
            <div className="text-center space-y-3">
              <div className="text-5xl">❓</div>
              <p className="text-xl font-bold text-gray-300">Unknown QR Code</p>
              <p className="text-sm text-gray-500">{scanResult.error}</p>
            </div>
          )}

          <button
            onClick={resetScan}
            className="w-full mt-10 border border-gray-100 text-luxury-muted hover:text-luxury-dark hover:border-gray-300 py-4 rounded-sm transition-all duration-500 font-bold text-[10px] uppercase tracking-[0.3em]"
          >
            Scan Next Guest
          </button>
        </div>
      )}
    </div>
  );
}
