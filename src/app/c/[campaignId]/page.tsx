import { getAdminDb } from '@/lib/firebase-admin';
import { notFound } from 'next/navigation';
import ClaimForm from './ClaimForm';

export const dynamic = 'force-dynamic';

export default async function CampaignPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const db = getAdminDb();
  
  // Try finding by direct ID first (legacy)
  let doc = await db.collection('campaigns').doc(campaignId).get();

  // If not found, try finding by "slug" field
  if (!doc.exists) {
    const q = await db.collection('campaigns').where('slug', '==', campaignId).get();
    if (!q.empty) doc = q.docs[0];
  }

  if (!doc.exists) {
    notFound();
  }

  const campaign = { id: doc.id, ...doc.data() } as { id: string; name: string };

  return (
    <div className="min-h-screen bg-luxury-off-white flex flex-col items-center justify-center p-6 sm:p-12 font-sans text-luxury-dark selection:bg-luxury-gold selection:text-white relative">
      {/* Background Gradient */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(255,251,240,1)_0%,_rgba(250,250,250,1)_100%)] pointer-events-none" />
      
      <main className="relative w-full max-w-[600px] bg-white shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-gray-100 rounded-sm overflow-hidden animate-fade-up">
        <div className="p-12 sm:p-16 flex flex-col items-center text-center">
          
          <header className="mb-16 animate-fade-up delay-100">
            <p className="text-[10px] text-luxury-muted uppercase tracking-[0.4em] font-bold mb-4">Exclusive Access</p>
            <h1 className="font-cormorant text-4xl sm:text-5xl uppercase tracking-[0.2em] text-luxury-gold font-light decoration-luxury-gold/30">
              {campaign.name}
            </h1>
            <div className="h-px w-12 bg-luxury-gold/20 mx-auto mt-8" />
          </header>
          
          <p className="text-luxury-muted text-sm font-light leading-relaxed max-w-xs mx-auto mb-12 animate-fade-up delay-200">
            Please verify your identity to securely retrieve your digital authentication credentials for this exclusive event.
          </p>
          
          <div className="w-full animate-fade-up delay-300">
            <ClaimForm campaignId={campaign.id} />
          </div>
        </div>
        
        <footer className="w-full border-t border-gray-100 py-12 px-12 text-center space-y-3 bg-white animate-fade-up delay-400">
          <p className="text-[10px] uppercase tracking-[0.4em] text-luxury-muted font-light">Event communications powered by</p>
          <p className="font-cormorant text-2xl uppercase tracking-[0.3em] text-gray-400 font-light translate-y-1">Emanuel Ungaro</p>
        </footer>
      </main>
    </div>
  );
}
