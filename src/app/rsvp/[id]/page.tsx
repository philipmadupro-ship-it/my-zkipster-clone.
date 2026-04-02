import { getAdminDb } from '@/lib/firebase-admin';
import { notFound } from 'next/navigation';
import LuxuryRSVPClient from '@/components/LuxuryRSVPClient';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function RSVPPage({ params }: Props) {
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

      if (guest.campaignId) {
        const campDoc = await db.collection('campaigns').doc(guest.campaignId).get();
        if (campDoc.exists) {
          const campData = campDoc.data()!;
          campaign = {
            id: campDoc.id,
            name: campData.name,
            eventDate: campData.eventDate,
            eventTime: campData.eventTime,
            eventEndTime: campData.eventEndTime || '',
            eventVenue: campData.eventVenue,
            language: campData.language || 'en',
            logoVariant: campData.logoVariant || 'black',
            emailImageUrl: campData.emailImageUrl || '',
          };
        }
      }
    }
  } catch (err) {
    console.error('Error fetching RSVP data:', err);
  }

  if (!guest) notFound();

  return <LuxuryRSVPClient guest={guest} campaign={campaign} />;
}
