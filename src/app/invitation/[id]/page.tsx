import { getAdminDb } from '@/lib/firebase-admin';
import { notFound } from 'next/navigation';
import LuxuryInvitation from '@/components/LuxuryInvitation';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function InvitationPage({ params }: Props) {
  const { id } = await params;
  const db = getAdminDb();
  
  let guest = null;

  try {
    const doc = await db.collection('guests').doc(id).get();
    if (doc.exists) {
      const data = doc.data()!;
      guest = {
        id: doc.id,
        name: data.name ?? '',
        email: data.email ?? '',
        status: data.status ?? 'invited',
        qrCodeUrl: data.qrCodeUrl ?? '',
      };
    }
  } catch (error) {
    console.error('Error fetching guest:', error);
  }

  // Allow "demo" as a special ID to see the elegant UI even without a database entry
  if (!guest && id === 'demo') {
    guest = {
      id: 'demo-id',
      name: 'Yann',
      email: 'yann@example.com',
      status: 'confirmed',
      qrCodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=EMANUEL-UNGARO-FW26-DEMO',
    };
  }

  if (!guest) {
    notFound();
  }

  return <LuxuryInvitation guest={guest} />;
}
