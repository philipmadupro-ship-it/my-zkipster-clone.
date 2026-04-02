import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import nodemailer from 'nodemailer';
import QRCode from 'qrcode';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { guestId, name, dietary, carService } = await req.json();

    if (!guestId || !name) {
      return NextResponse.json({ error: 'guestId and name are required' }, { status: 400 });
    }

    const db = getAdminDb();
    const docRef = db.collection('guests').doc(guestId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
    }

    const data = doc.data()!;

    if (data.status === 'confirmed' || data.status === 'accepted' || data.status === 'arrived') {
      return NextResponse.json({ error: 'Guest has already confirmed', qrCodeUrl: data.qrCodeUrl }, { status: 409 });
    }

    await docRef.update({
      name: name.trim(),
      status: 'confirmed',
      confirmedAt: FieldValue.serverTimestamp(),
    });

    // 4. Send Confirmation Email with QR Code
    try {
      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.warn('[API] Warning: SMTP_USER or SMTP_PASS is missing. Confirmation email skipped.');
        return NextResponse.json({ success: true, qrCodeUrl: data.qrCodeUrl, warning: 'Email not configured' });
      }

      const campaignId = data.campaignId;
      const campaignDoc = await db.collection('campaigns').doc(campaignId).get();
      const campaign = campaignDoc.exists ? campaignDoc.data()! : { name: 'Emanuel Ungaro FW26' };

      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.office365.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        tls: {
          ciphers: 'SSLv3',
          rejectUnauthorized: false
        }
      });

      const qrCodeBuffer = await QRCode.toBuffer(guestId, {
        errorCorrectionLevel: 'H',
        margin: 1,
        width: 300,
        color: { dark: '#1a1a1a', light: '#ffffff' },
      });

      const emailHtml = `
        <div style="font-family: 'Times New Roman', Times, serif; max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #eee; color: #1a1a1a; line-height: 1.6;">
          <h1 style="text-align: center; text-transform: uppercase; letter-spacing: 0.3em; color: #8b7355; font-weight: 300; margin-bottom: 40px;">RSVP CONFIRMED</h1>
          <p style="font-size: 16px; margin-bottom: 20px;">Dear ${name.trim()},</p>
          <p style="font-size: 15px; margin-bottom: 30px;">Thank you for confirming your attendance at the <strong>${campaign.name}</strong>. Your digital access pass is attached below.</p>
          
          <div style="background-color: #fafaf8; padding: 40px; text-align: center; margin-bottom: 40px; border: 1px solid #f0f0f0;">
            <img src="cid:qrcode" alt="Entry QR Code" style="width: 200px; height: 200px; margin-bottom: 20px;" />
            <p style="text-transform: uppercase; font-size: 10px; letter-spacing: 0.2em; color: #8b7355; margin-bottom: 5px;">Guest Selection</p>
            <p style="font-size: 14px; font-weight: bold; margin-bottom: 20px;">${name.trim()}</p>
            <div style="display: inline-block; border-top: 1px solid #eee; padding-top: 15px;">
              <p style="text-transform: uppercase; font-size: 9px; letter-spacing: 0.1em; color: #999;">Venue Access</p>
              <p style="font-size: 12px;">${campaign.eventVenue || 'See Invitation'}</p>
            </div>
          </div>

          <p style="font-size: 13px; color: #666; text-align: center; margin-bottom: 30px;">
            Please present this QR code at the entrance 30 minutes prior to the show start.
          </p>

          <div style="border-top: 1px solid #eee; padding-top: 30px; text-align: center;">
            <p style="font-size: 9px; color: #999; text-transform: uppercase; letter-spacing: 0.4em; margin-bottom: 15px;">Event communications powered by</p>
            <p style="font-family: 'Futura', 'Century Gothic', 'Arial Black', sans-serif; font-size: 28px; color: #000000; font-weight: bold; text-transform: lowercase; letter-spacing: -0.02em; margin: 0; line-height: 1;">emanuel ungaro</p>
          </div>
        </div>
      `;

      await transporter.sendMail({
        from: `"Emanuel Ungaro Press" <${process.env.SMTP_USER}>`,
        to: data.email,
        subject: `RSVP Confirmed: ${campaign.name}`,
        html: emailHtml,
        attachments: [
          {
            filename: 'qr-code.png',
            content: qrCodeBuffer,
            cid: 'qrcode'
          }
        ]
      });
    } catch (mailErr) {
      console.error('Failed to send confirmation email:', mailErr);
      // We don't fail the RSVP if the email fails, but we log it
    }

    return NextResponse.json({ success: true, qrCodeUrl: data.qrCodeUrl });
  } catch (err) {
    console.error('confirm-rsvp error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
