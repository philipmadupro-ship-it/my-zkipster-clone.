'use client';

import { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';

interface ScanResult {
  status: 'confirmed' | 'arrived' | 'invited' | 'pending' | 'accepted' | 'refused' | 'not_found' | null;
  name?: string;
  email?: string;
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
            className={`flex-1 py-3 rounded-lg text-sm font-medium transition ${mode === m
              ? 'bg-violet-600 text-white'
              : 'text-gray-400 hover:text-white'}`}
          >
            {m === 'camera' ? '📷 Camera Scan' : '🖼️ Photo Upload'}
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
            <div className="p-8 text-center">
              <div id="qr-reader-file" className="hidden" />
              <div className="w-20 h-20 bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4 text-4xl">
                🖼️
              </div>
              <p className="text-gray-400 text-sm mb-4">Upload a photo containing a QR code</p>
              <label className="cursor-pointer inline-block bg-violet-600 hover:bg-violet-500 text-white font-medium px-6 py-3 rounded-xl transition">
                Choose Photo
                <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
          )}
        </div>
      )}

      {/* Scan Result */}
      {scanResult.status && (
        <div className={`rounded-2xl border p-6 ${
          checkedIn || scanResult.status === 'arrived' ? 'bg-emerald-900/30 border-emerald-700' :
          ['confirmed', 'accepted', 'invited', 'pending'].includes(scanResult.status) ? 'bg-violet-900/30 border-violet-700' :
          scanResult.status === 'refused' ? 'bg-red-900/30 border-red-700' :
          'bg-gray-900 border-gray-800'
        }`}>
          {/* Not Arrived Yet — show check-in button */}
          {['confirmed', 'accepted', 'invited', 'pending'].includes(scanResult.status) && !checkedIn && (
            <div className="text-center space-y-4">
              <div className="text-5xl">🎟️</div>
              <div>
                <p className="text-xl font-semibold text-white">{scanResult.name}</p>
                <p className="text-sm text-gray-400">{scanResult.email}</p>
              </div>
              <div className="inline-block bg-violet-500/20 border border-violet-600 rounded-full px-3 py-1 text-violet-300 text-xs uppercase tracking-wide">
                {scanResult.status === 'invited' || scanResult.status === 'pending' ? 'Not RSVP\'d — Ready to check in' : 'Confirmed — Ready to check in'}
              </div>
              <button
                onClick={handleCheckIn}
                disabled={checkingIn}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-4 rounded-xl transition text-lg"
              >
                {checkingIn ? 'Checking in…' : `✓ Check in ${scanResult.name}`}
              </button>
            </div>
          )}

          {/* Arrived */}
          {(scanResult.status === 'arrived' || checkedIn) && (
            <div className="text-center space-y-3">
              <div className="text-6xl">✅</div>
              <p className="text-3xl font-bold text-emerald-300">Arrived</p>
              <p className="text-xl font-semibold text-white">{scanResult.name}</p>
              {scanResult.arrivedAt && (
                <p className="text-sm text-gray-400">
                  Checked in at {new Date(scanResult.arrivedAt).toLocaleTimeString()}
                </p>
              )}
              {checkedIn && <p className="text-sm text-gray-400">
                Checked in just now
              </p>}
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
            className="w-full mt-6 border border-gray-700 text-gray-400 hover:text-white py-3 rounded-xl transition font-medium"
          >
            Scan next guest →
          </button>
        </div>
      )}
    </div>
  );
}
