import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import nodemailer from 'nodemailer';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { campaignId, guestIds, subject, customMessage } = await req.json();

    if (!campaignId || !guestIds || !Array.isArray(guestIds)) {
      return NextResponse.json({ error: 'campaignId and guestIds are required' }, { status: 400 });
    }

    const db = getAdminDb();
    
    // 1. Fetch Campaign Details
    const campaignDoc = await db.collection('campaigns').doc(campaignId).get();
    if (!campaignDoc.exists) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }
    const campaign = campaignDoc.data()!;

    // 2. Setup Nodemailer (Encourage user to set these in .env.local)
    // For now, we use a fallback or placeholder. 
    // IMPORTANT: In production, these must be real credentials.
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.office365.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // false for 587
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        ciphers: 'SSLv3',
        rejectUnauthorized: false
      }
    });

    const results = {
      success: 0,
      failed: 0,
    };

    const host = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // 3. Iterate and send
    for (const guestId of guestIds) {
      try {
        const guestDoc = await db.collection('guests').doc(guestId).get();
        if (!guestDoc.exists) continue;
        const guest = guestDoc.data()!;

        const rsvpLink = `${host}/rsvp/${guestId}`;
        
        const htmlContent = `
          <div style="font-family: 'Times New Roman', Times, serif; max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #eee; color: #1a1a1a; line-height: 1.6;">
            <h1 style="text-align: center; text-transform: uppercase; letter-spacing: 0.3em; color: #8b7355; font-weight: 300; margin-bottom: 40px;">EMANUEL UNGARO</h1>
            <p style="font-size: 16px; margin-bottom: 30px;">Dear ${guest.firstName || guest.name || 'Guest'},</p>
            <p style="font-size: 15px; margin-bottom: 40px; white-space: pre-wrap;">${customMessage}</p>
            <div style="text-align: center; margin-bottom: 50px;">
              <a href="${rsvpLink}" style="display: inline-block; background-color: #1a1a1a; color: #fff; padding: 20px 40px; text-decoration: none; text-transform: uppercase; font-size: 12px; letter-spacing: 0.3em; font-weight: bold;">Access Digital Invitation</a>
            </div>
            <p style="font-size: 12px; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 30px; letter-spacing: 0.1em; text-transform: uppercase;">
              ${campaign.name} &bull; ${campaign.eventVenue || 'Paris Fashion Center'}
            </p>
          </div>
        `;

        await transporter.sendMail({
          from: `"Emanuel Ungaro Press" <${process.env.SMTP_USER || 'pressoffice@ungaro.com'}>`,
          to: guest.email,
          subject: subject,
          html: htmlContent,
        });

        // 4. Update guest status if it was pending
        if (guest.status === 'pending') {
          await db.collection('guests').doc(guestId).update({
            status: 'invited',
            invitedAt: new Date().toISOString(),
          });
        }

        results.success++;
      } catch (err) {
        console.error(`Failed to send to ${guestId}:`, err);
        results.failed++;
      }
    }

    return NextResponse.json({ 
      success: true, 
      count: results.success, 
      failed: results.failed 
    });

  } catch (err) {
    console.error('send-bulk-invitation error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
