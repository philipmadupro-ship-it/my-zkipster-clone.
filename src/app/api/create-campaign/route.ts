import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
  try {
    const { name, ownerEmail, eventDate, eventTime, eventVenue, language, emailImageUrl, logoVariant, emailMessage } = await req.json();

    if (!name || !ownerEmail) {
      return NextResponse.json({ error: 'name and ownerEmail are required' }, { status: 400 });
    }

    const db = getAdminDb();
    
    // Generate a short 7-character slug (alphanumeric, lowercase)
    const slug = Math.random().toString(36).substring(2, 9);
    
    // Create the new campaign via admin SDK
    const docRef = db.collection('campaigns').doc();
    
    const campaignData = {
      name: name.trim(),
      ownerEmail: ownerEmail.toLowerCase().trim(),
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
    console.error('create-campaign error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
