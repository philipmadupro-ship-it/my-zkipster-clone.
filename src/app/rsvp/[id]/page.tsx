import { getAdminDb } from '@/lib/firebase-admin';
import { notFound } from 'next/navigation';
import RSVPClient from '@/components/RSVPClient';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function RSVPPage({ params }: Props) {
  const { id } = await params;
  const db = getAdminDb();
  const doc = await db.collection('guests').doc(id).get();

  if (!doc.exists) notFound();

  const data = doc.data()!;
  const guest = {
    id: doc.id,
    name: data.name ?? '',
    email: data.email ?? '',
    status: data.status ?? 'invited',
    qrCodeUrl: data.qrCodeUrl ?? '',
    rsvpLink: data.rsvpLink ?? '',
  };

  return <RSVPClient guest={guest} />;
}
