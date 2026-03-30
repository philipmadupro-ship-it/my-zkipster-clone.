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
    <div className="min-h-screen bg-black flex items-center justify-center p-6 selection:bg-white selection:text-black">
      <div className="fixed inset-0 pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-white/5 blur-[120px] rounded-full" />
      </div>

      <div className="w-full max-w-xl relative animate-in fade-in zoom-in-95 duration-1000">
        <div className="bg-white/[0.02] border border-white/5 backdrop-blur-3xl rounded-[3rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)] p-12 md:p-16 text-center space-y-8">
          <div className="space-y-4">
            <p className="text-[10px] text-gray-500 uppercase tracking-[0.4em] font-bold">Exclusive Access</p>
            <h1 className="font-display text-4xl font-bold text-white tracking-tighter">{campaign.name}</h1>
            <div className="h-px w-12 bg-white/20 mx-auto" />
          </div>
          
          <p className="text-gray-500 text-sm font-medium leading-relaxed max-w-xs mx-auto">
            Please verify your identity to securely retrieve your digital authentication credentials.
          </p>
          
          <div className="pt-4">
            <ClaimForm campaignId={campaign.id} />
          </div>
        </div>
        
        <p className="text-center mt-12 text-[9px] text-gray-800 uppercase tracking-[0.5em] font-bold">POWERED BY ANTGRAVITY SYSTEM</p>
      </div>
    </div>
  );
}
