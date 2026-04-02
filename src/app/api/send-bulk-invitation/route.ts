import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import nodemailer from 'nodemailer';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { campaignId, guestIds, subject, customMessage, origin } = await req.json();

    // SMTP Diagnostic Check for Vercel
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.error('[API] Critical Error: SMTP_USER or SMTP_PASS is missing. Check Vercel Env Vars.');
      return NextResponse.json({ 
        error: 'Email service not configured on host.', 
        details: 'Ensure SMTP_USER and SMTP_PASS are set in Vercel Dashboard.' 
      }, { status: 500 });
    }

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

    // Use the origin passed from the browser (most reliable), then env var, then headers
    const host = origin || process.env.NEXT_PUBLIC_APP_URL || `${req.headers.get('x-forwarded-proto') || 'https'}://${req.headers.get('host') || 'localhost:3000'}`;

    // 3. Process guests strictly sequentially (as requested by user: 'not at the same time')
    for (const guestId of guestIds) {
      try {
        const guestDoc = await db.collection('guests').doc(guestId).get();
        if (!guestDoc.exists) {
          results.failed++;
          continue;
        }
        const guest = guestDoc.data()!;

        const rsvpLink = `${host}/rsvp/${guestId}`;
        
        const isDark = campaign.logoVariant === 'white';
        const bgColor = isDark ? '#050505' : '#ffffff';
        const textColor = isDark ? '#ffffff' : '#1a1a1a';
        const borderColor = isDark ? '#222222' : '#eeeeee';
        const buttonBg = isDark ? '#ffffff' : '#1a1a1a';
        const buttonText = isDark ? '#000000' : '#ffffff';
        const logoColor = isDark ? '#ffffff' : '#000000';
        
        // Define translations
        const isFr = campaign.language === 'fr';
        const greeting = isFr ? 'Cher/Chère' : 'Dear';
        const viewInviteText = isFr ? 'Accéder à l\'Invitation Numérique' : 'Access Digital Invitation';
        const poweredByText = isFr ? 'Communications événementielles par' : 'Event communications powered by';

        // Render standard message or rich text message
        const messageBody = campaign.emailMessage 
          ? campaign.emailMessage // Rich Text
          : `<p style="font-size: 15px; margin-bottom: 40px; white-space: pre-wrap;">${customMessage}</p>`;

        // Decorative Image Logic
        const decorativeImageHtml = campaign.emailImageUrl 
          ? `<div style="text-align: center; margin-top: 40px; margin-bottom: 20px;">
               <img src="${campaign.emailImageUrl}" alt="Event Decoration" style="max-width: 100%; height: auto; border-radius: 4px;" />
             </div>` 
          : '';

        const htmlContent = `
          <div style="background-color: ${bgColor}; padding: 40px 10px;">
            <div style="background-color: ${bgColor}; font-family: 'Times New Roman', Times, serif; max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid ${borderColor}; color: ${textColor}; line-height: 1.6;">
              <h1 style="text-align: center; text-transform: uppercase; letter-spacing: 0.3em; color: #8b7355; font-weight: 300; margin-bottom: 40px;">EMANUEL UNGARO</h1>
              <p style="font-size: 16px; margin-bottom: 30px;">${greeting} ${guest.firstName || guest.name || ''},</p>
              
              <div style="margin-bottom: 40px;">
                ${messageBody}
              </div>
              
              <div style="text-align: center; margin-bottom: 30px;">
                <a href="${rsvpLink}" style="display: inline-block; background-color: ${buttonBg}; color: ${buttonText}; padding: 20px 40px; text-decoration: none; text-transform: uppercase; font-size: 12px; letter-spacing: 0.3em; font-weight: bold;">${viewInviteText}</a>
              </div>
              
              ${decorativeImageHtml}

              <div style="border-top: 1px solid ${borderColor}; padding-top: 30px; margin-top: 50px; text-align: center;">
                <p style="font-size: 9px; color: #999; text-transform: uppercase; letter-spacing: 0.4em; margin-bottom: 15px;">${poweredByText}</p>
                <p style="font-family: 'Futura', 'Century Gothic', 'Arial Black', sans-serif; font-size: 28px; color: ${logoColor}; font-weight: bold; text-transform: lowercase; letter-spacing: -0.02em; margin: 0; line-height: 1;">emanuel ungaro</p>
              </div>
            </div>
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
        // Optional: Adding a tiny delay to ensure Outlook doesn't throttle
        await new Promise(r => setTimeout(r, 100)); 
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
