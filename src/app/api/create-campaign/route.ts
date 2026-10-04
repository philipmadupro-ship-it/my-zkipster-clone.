import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAdmin, handleApiError } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const user = await requireAdmin(req);
    const { name, eventDate, eventTime, eventVenue, language, emailImageUrl, logoVariant, emailMessage } = await req.json();

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const db = getAdminDb();

    // Generate a short 7-character slug (alphanumeric, lowercase)
    const slug = Math.random().toString(36).substring(2, 9);

    // Create the new campaign via admin SDK
    const docRef = db.collection('campaigns').doc();

    const campaignData = {
      name: name.trim(),
      ownerEmail: user.email, // taken from the verified token, never from the request body
      slug: slug,
      eventDate: eventDate || '',
      eventTime: eventTime || '',
      eventVenue: eventVenue || '',
      language: language || 'en',
      emailImageUrl: emailImageUrl || '',
      logoVariant: logoVariant || 'black',
      emailMessage: emailMessage || '',
      createdAt: FieldValue.serverTimestamp(),
    };

    await docRef.set(campaignData);

    return NextResponse.json({
      id: docRef.id,
      ...campaignData,
      createdAt: new Date().toISOString()
    });

  } catch (err) {
    return handleApiError(err, 'create-campaign');
  }
}
