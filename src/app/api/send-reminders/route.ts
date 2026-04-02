import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import nodemailer from 'nodemailer';
import QRCode from 'qrcode';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { campaignId, origin } = await req.json();

    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId is required' }, { status: 400 });
    }

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return NextResponse.json({ error: 'Email service not configured on host.' }, { status: 500 });
    }

    const db = getAdminDb();
    
    // 1. Fetch Campaign Details
    const campaignDoc = await db.collection('campaigns').doc(campaignId).get();
    if (!campaignDoc.exists) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }
    const campaign = campaignDoc.data()!;

    // 2. Fetch Guests
    const guestsSnapshot = await db.collection('guests').where('campaignId', '==', campaignId).get();
    const guests = guestsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

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

    const host = origin || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    let sentCount = 0;
    
    // Theme setup based on campaign
    const isDark = campaign.logoVariant === 'white';
    const bgColor = isDark ? '#050505' : '#ffffff';
    const textColor = isDark ? '#ffffff' : '#1a1a1a';
    const borderColor = isDark ? '#222222' : '#eeeeee';
    const boxBg = isDark ? '#111111' : '#fafaf8';
    const boxBorder = isDark ? '#333333' : '#f0f0f0';
    const buttonBg = isDark ? '#ffffff' : '#1a1a1a';
    const buttonText = isDark ? '#000000' : '#ffffff';
    const logoColor = isDark ? '#ffffff' : '#000000';

    const isFr = campaign.language === 'fr';
    const poweredByText = isFr ? 'Communications événementielles par' : 'Event communications powered by';
    
    const decorativeImageHtml = campaign.emailImageUrl 
      ? `<div style="text-align: center; margin-top: 40px; margin-bottom: 20px;">
           <img src="${campaign.emailImageUrl}" alt="Event Decoration" style="max-width: 100%; height: auto; border-radius: 4px;" />
         </div>` 
      : '';

    for (const guest of guests) {
      try {
        if (guest.status === 'pending' || guest.status === 'invited') {
          // --- SEND PENDING REMINDER ---
          const rsvpLink = `${host}/rsvp/${guest.id}`;
          const greeting = isFr ? 'Cher/Chère' : 'Dear';
          const viewInviteText = isFr ? 'Accéder à l\'Invitation Numérique' : 'Access Digital Invitation';
          
          let defaultMessage = isFr
            ? `<p style="font-size: 15px; margin-bottom: 40px;">Veuillez noter que notre événement approche. Si vous ne l'avez pas encore fait, veuillez confirmer votre présence au défilé <strong>${campaign.name}</strong> le plus tôt possible.</p>`
            : `<p style="font-size: 15px; margin-bottom: 40px;">Please note that our event is approaching. If you have not done so already, please confirm your attendance for the <strong>${campaign.name}</strong> runway show at your earliest convenience.</p>`;

          // Render standard message or rich text message
          // If they used a custom message, append the reminder prefix.
          let messageBody = defaultMessage;
          if (campaign.emailMessage) {
              messageBody = isFr 
                ? `<p style="color: #ff3333; font-weight: bold; margin-bottom: 10px;">RAPPEL</p>` + campaign.emailMessage
                : `<p style="color: #ff3333; font-weight: bold; margin-bottom: 10px;">REMINDER</p>` + campaign.emailMessage;
          }

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
            from: `"Emanuel Ungaro Press" <${process.env.SMTP_USER}>`,
            to: guest.email,
            subject: isFr ? `RAPPEL: Invitation à ${campaign.name}` : `REMINDER: Invitation to ${campaign.name}`,
            html: htmlContent,
          });

          await db.collection('guests').doc(guest.id).update({
            remindedAt: new Date().toISOString(),
          });
          
          sentCount++;

        } else if (guest.status === 'confirmed' || guest.status === 'accepted') {
          // --- SEND CONFIRMED REMINDER (QR CODE AGAIN) ---
          const qrCodeBuffer = await QRCode.toBuffer(guest.id, {
            errorCorrectionLevel: 'H',
            margin: 1,
            width: 300,
            color: { dark: '#1a1a1a', light: '#ffffff' },
          });

          const titleText = isFr ? 'RAPPEL D\'ACCÈS À L\'ÉVÉNEMENT' : 'EVENT ACCESS REMINDER';
          const greeting = isFr ? 'Cher/Chère' : 'Dear';
          const thankYouMsg = isFr 
            ? `Ceci est un rappel que l'événement <strong>${campaign.name}</strong> approche. Veuillez trouver ci-joint votre pass d'accès numérique.` 
            : `This is a reminder that the <strong>${campaign.name}</strong> is approaching. Please find your digital access pass attached below.`;
          const guestSelection = isFr ? 'Sélection des Invités' : 'Guest Selection';
          const venueAccess = isFr ? 'Accès au Lieu' : 'Venue Access';
          const seeInvitation = isFr ? 'Voir l\'Invitation' : 'See Invitation';

          const htmlContent = `
            <div style="background-color: ${bgColor}; padding: 40px 10px;">
              <div style="background-color: ${bgColor}; font-family: 'Times New Roman', Times, serif; max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid ${borderColor}; color: ${textColor}; line-height: 1.6;">
                <h1 style="text-align: center; text-transform: uppercase; letter-spacing: 0.2em; color: #8b7355; font-weight: 300; margin-bottom: 40px; font-size: 20px;">${titleText}</h1>
                <p style="font-size: 16px; margin-bottom: 20px;">${greeting} ${guest.name},</p>
                <p style="font-size: 15px; margin-bottom: 30px;">${thankYouMsg}</p>
                
                <div style="background-color: ${boxBg}; padding: 40px; text-align: center; margin-bottom: 40px; border: 1px solid ${boxBorder};">
                  <img src="cid:qrcode" alt="Entry QR Code" style="width: 200px; height: 200px; margin-bottom: 20px;" />
                  <p style="text-transform: uppercase; font-size: 10px; letter-spacing: 0.2em; color: #8b7355; margin-bottom: 5px;">${guestSelection}</p>
                  <p style="font-size: 14px; font-weight: bold; margin-bottom: 20px;">${guest.name}</p>
                  <div style="display: inline-block; border-top: 1px solid ${borderColor}; padding-top: 15px;">
                    <p style="text-transform: uppercase; font-size: 9px; letter-spacing: 0.1em; color: #999;">${venueAccess}</p>
                    <p style="font-size: 12px; color: ${textColor};">${campaign.eventVenue || seeInvitation}</p>
                  </div>
                </div>

                ${decorativeImageHtml}

                <div style="border-top: 1px solid ${borderColor}; padding-top: 30px; text-align: center;">
                  <p style="font-size: 9px; color: #999; text-transform: uppercase; letter-spacing: 0.4em; margin-bottom: 15px;">${poweredByText}</p>
                  <p style="font-family: 'Futura', 'Century Gothic', 'Arial Black', sans-serif; font-size: 28px; color: ${logoColor}; font-weight: bold; text-transform: lowercase; letter-spacing: -0.02em; margin: 0; line-height: 1;">emanuel ungaro</p>
                </div>
              </div>
            </div>
          `;

          await transporter.sendMail({
            from: `"Emanuel Ungaro Press" <${process.env.SMTP_USER}>`,
            to: guest.email,
            subject: isFr ? `RAPPEL: Accès à ${campaign.name}` : `REMINDER: Access for ${campaign.name}`,
            html: htmlContent,
            attachments: [
              {
                filename: 'qr-code.png',
                content: qrCodeBuffer,
                cid: 'qrcode'
              }
            ]
          });

          await db.collection('guests').doc(guest.id).update({
            remindedAt: new Date().toISOString(),
          });
          
          sentCount++;
        }
        
        await new Promise(r => setTimeout(r, 100)); // Rate limit
      } catch (e) {
        console.error("Failed to send reminder to guest " + guest.id, e);
      }
    }

    return NextResponse.json({ success: true, sentCount });
  } catch (err) {
    console.error('send-reminders error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
