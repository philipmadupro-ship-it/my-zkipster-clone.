import { getAdminDb } from '@/lib/firebase-admin';
import { notFound } from 'next/navigation';
import ClaimForm from './ClaimForm';

export const dynamic = 'force-dynamic';

export default async function CampaignPage({ params }: { params: { campaignId: string } }) {
  const db = getAdminDb();
  const doc = await db.collection('campaigns').doc(params.campaignId).get();

  if (!doc.exists) {
    notFound();
  }

  const campaign = { id: doc.id, ...doc.data() } as { id: string; name: string };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="bg-gray-900 border border-gray-800 rounded-3xl w-full max-w-md p-8 shadow-2xl text-center">
        <p className="text-violet-400 text-xs font-bold tracking-widest uppercase mb-4">You&apos;re Invited</p>
        <h1 className="text-3xl font-display font-bold text-white mb-2">{campaign.name}</h1>
        <p className="text-sm text-gray-400 mb-8">
          Enter your first and last name below to find your invitation and secure your QR code ticket.
        </p>
        
        <ClaimForm campaignId={campaign.id} />
      </div>
    </div>
  );
}
