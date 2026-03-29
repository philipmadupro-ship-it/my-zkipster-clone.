'use client';

export const dynamic = 'force-dynamic';


import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import QRScanner from '@/components/QRScanner';

export default function ScanPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <a href="/" className="text-gray-400 hover:text-white transition text-sm">← Dashboard</a>
          <h1 className="font-display text-lg font-bold text-white">Check-In Scanner</h1>
          <div className="w-20" />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8">
        <p className="text-gray-400 text-sm text-center mb-6">
          Scan a guest&apos;s QR code to check them in. Use your camera or upload a photo.
        </p>
        <QRScanner />
      </main>
    </div>
  );
}
