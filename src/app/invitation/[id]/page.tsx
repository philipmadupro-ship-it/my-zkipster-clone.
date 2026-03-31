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
  let campaign = null;

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
        seatNumber: data.seatNumber ?? '',
        campaignId: data.campaignId,
      };

      // Fetch campaign details
      if (guest.campaignId) {
        const campDoc = await db.collection('campaigns').doc(guest.campaignId).get();
        if (campDoc.exists) {
          const campData = campDoc.data()!;
          campaign = {
            id: campDoc.id,
            name: campData.name,
            eventDate: campData.eventDate,
            eventTime: campData.eventTime,
            eventVenue: campData.eventVenue,
          };
        }
      }
    }
  } catch (error) {
    console.error('Error fetching data:', error);
  }

  // Allow "demo" as a special ID to see the elegant UI even without a database entry
  if (!guest && id === 'demo') {
    guest = {
      id: 'demo-id',
      name: 'Yann',
      email: 'yann@example.com',
      status: 'confirmed',
      qrCodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=EMANUEL-UNGARO-FW26-DEMO',
      seatNumber: 'E 2',
      campaignId: 'demo-camp',
    };
    campaign = {
      id: 'demo-camp',
      name: 'Emanuel Ungaro FW26',
      eventDate: 'Tuesday, 3 March, 2026',
      eventTime: '9h30 AM',
      eventVenue: 'The Opéra Garnier, Place de l\'Opéra, 75009 Paris',
    };
  }

  if (!guest) {
    notFound();
  }

  return <LuxuryInvitation guest={guest} campaign={campaign} />;
}
