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

      const isDark = campaign.logoVariant === 'white' || campaign.logoVariant === 'img-white';
      const bgColor = isDark ? '#050505' : '#ffffff';
      const textColor = isDark ? '#ffffff' : '#1a1a1a';
      const borderColor = isDark ? '#222222' : '#eeeeee';
      const boxBg = isDark ? '#111111' : '#fafaf8';
      const boxBorder = isDark ? '#333333' : '#f0f0f0';
      const logoColor = isDark ? '#ffffff' : '#000000';

      const isFr = campaign.language === 'fr';
      const titleText = isFr ? 'RSVP CONFIRMÉ' : 'RSVP CONFIRMED';
      const greeting = isFr ? 'Cher/Chère' : 'Dear';
      const thankYouMsg = isFr ? `Merci d'avoir confirmé votre présence au défilé <strong>${campaign.name}</strong>. Votre pass d'accès numérique est joint ci-dessous.` : `Thank you for confirming your attendance at the <strong>${campaign.name}</strong>. Your digital access pass is attached below.`;
      const guestSelection = isFr ? 'Sélection des Invités' : 'Guest Selection';
      const venueAccess = isFr ? 'Accès au Lieu' : 'Venue Access';
      const poweredByText = isFr ? 'Communications événementielles par' : 'Event communications powered by';
      const seeInvitation = isFr ? 'Voir l\'Invitation' : 'See Invitation';

      const decorativeImageHtml = campaign.emailImageUrl 
        ? `<div style="text-align: center; margin-top: 40px; margin-bottom: 20px;">
             <img src="${campaign.emailImageUrl}" alt="Event Decoration" style="max-width: 100%; height: auto; border-radius: 4px;" />
           </div>` 
        : '';

      const origin = req.headers.get('origin');
      const host = origin || process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

      // Footer Logo Logic
      let footerLogoHtml = `<p style="font-family: 'Futura', 'Century Gothic', 'Arial Black', sans-serif; font-size: 28px; color: ${logoColor}; font-weight: bold; text-transform: lowercase; letter-spacing: -0.02em; margin: 0; line-height: 1;">emanuel ungaro</p>`;
      const isImgVariant = ['img-pink', 'img-black', 'img-white'].includes(campaign.logoVariant || '');
      if (isImgVariant) {
         const variantName = (campaign.logoVariant || '').replace('img-', '');
         footerLogoHtml = `<img src="${host}/email-logos/ungaro-${variantName}.png" alt="Emanuel Ungaro" style="height: 40px; width: auto; max-width: 100%; border: 0;" />`;
      }

      // Header Logo Logic (top of email)
      let headerLogoHtml = `<h1 style="text-align: center; text-transform: uppercase; letter-spacing: 0.3em; color: ${logoColor}; font-weight: 300; margin-bottom: 40px;">${titleText}</h1>`;
      const isImgVariantHeader = ['img-pink', 'img-black', 'img-white'].includes(campaign.logoVariant || '');
      if (isImgVariantHeader) {
         const variantNameH = (campaign.logoVariant || '').replace('img-', '');
         headerLogoHtml = `<div style="text-align: center; margin-bottom: 40px;"><img src="${host}/email-logos/ungaro-${variantNameH}.png" alt="Emanuel Ungaro" style="height: 50px; width: auto; max-width: 80%; border: 0;" /><p style="text-align: center; text-transform: uppercase; letter-spacing: 0.3em; color: #8b7355; font-weight: 300; margin-top: 20px; font-size: 16px;">${titleText}</p></div>`;
      }

      const emailHtml = `
        <div style="background-color: ${bgColor}; padding: 40px 10px;">
          <div style="background-color: ${bgColor}; font-family: 'Times New Roman', Times, serif; max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid ${borderColor}; color: ${textColor}; line-height: 1.6;">
            ${headerLogoHtml}
            <p style="font-size: 16px; margin-bottom: 20px;">${greeting} ${name.trim()},</p>
            <p style="font-size: 15px; margin-bottom: 40px;">${thankYouMsg}</p>
            
            <div style="background-color: ${boxBg}; padding: 40px; text-align: center; margin-bottom: 40px; border: 1px solid ${boxBorder};">
              <img src="cid:qrcode" alt="Entry QR Code" style="width: 200px; height: 200px; margin-bottom: 20px;" />
              <p style="text-transform: uppercase; font-size: 10px; letter-spacing: 0.2em; color: #8b7355; margin-bottom: 5px;">${guestSelection}</p>
              <p style="font-size: 14px; font-weight: bold; margin-bottom: 20px;">${name.trim()}</p>
              <div style="display: inline-block; border-top: 1px solid ${borderColor}; padding-top: 15px;">
                <p style="text-transform: uppercase; font-size: 9px; letter-spacing: 0.1em; color: #999;">${venueAccess}</p>
                <p style="font-size: 12px; color: ${textColor};">${campaign.eventVenue || seeInvitation}</p>
              </div>
            </div>

            ${decorativeImageHtml}

            <div style="border-top: 1px solid ${borderColor}; padding-top: 30px; text-align: center;">
              <p style="font-size: 9px; color: #999; text-transform: uppercase; letter-spacing: 0.4em; margin-bottom: 25px;">${poweredByText}</p>
              ${footerLogoHtml}
            </div>
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
