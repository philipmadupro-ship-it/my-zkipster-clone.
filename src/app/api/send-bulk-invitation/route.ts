import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requireAdmin, getOwnedCampaign, handleApiError } from '@/lib/auth';
import { createMailTransport, escapeHtml, getBaseUrl, safeImageUrl } from '@/lib/email';
import { requireRsvpSecret, signGuestToken } from '@/lib/rsvp-token';

export const dynamic = 'force-dynamic';

const MAX_GUESTS_PER_REQUEST = 500;

export async function POST(req: NextRequest) {
  try {
    const user = await requireAdmin(req);
    const { campaignId, guestIds, subject, customMessage, origin } = await req.json();

    // SMTP Diagnostic Check for Vercel
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.error('[API] Critical Error: SMTP_USER or SMTP_PASS is missing. Check Vercel Env Vars.');
      return NextResponse.json({ 
        error: 'Email service not configured on host.', 
        details: 'Ensure SMTP_USER and SMTP_PASS are set in Vercel Dashboard.' 
      }, { status: 500 });
    }

    if (!campaignId || !Array.isArray(guestIds)) {
      return NextResponse.json({ error: 'campaignId and guestIds are required' }, { status: 400 });
    }
    if (guestIds.length > MAX_GUESTS_PER_REQUEST) {
      return NextResponse.json({ error: `Send at most ${MAX_GUESTS_PER_REQUEST} guests per request.` }, { status: 400 });
    }

    // Fail before sending anything rather than emailing links we can't sign.
    requireRsvpSecret();

    const db = getAdminDb();

    // 1. Fetch Campaign Details (and confirm the caller owns it)
    const { data: campaign } = await getOwnedCampaign(db, campaignId, user);

    // 2. Setup Nodemailer
    const transporter = createMailTransport();

    const results = {
      success: 0,
      failed: 0,
    };

    // The dashboard passes its own origin so links point at the deployment being used.
    const host = getBaseUrl(origin);

    // 3. Process guests strictly sequentially (as requested by user: 'not at the same time')
    for (const guestId of guestIds) {
      try {
        const guestDoc = await db.collection('guests').doc(String(guestId)).get();
        // Only email guests that belong to this campaign.
        if (!guestDoc.exists || guestDoc.data()!.campaignId !== campaignId) {
          results.failed++;
          continue;
        }
        const guest = guestDoc.data()!;

        const rsvpLink = `${host}/rsvp/${signGuestToken(guestDoc.id)}`;
        
        const isDark = campaign.logoVariant === 'white' || campaign.logoVariant === 'img-white';
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
          : `<p style="font-size: 15px; margin-bottom: 40px; white-space: pre-wrap;">${escapeHtml(customMessage)}</p>`;

        // Decorative Image Logic
        const decorativeImageUrl = safeImageUrl(campaign.emailImageUrl);
        const decorativeImageHtml = decorativeImageUrl
          ? `<div style="text-align: center; margin-top: 40px; margin-bottom: 20px;">
               <img src="${decorativeImageUrl}" alt="Event Decoration" style="max-width: 100%; height: auto; border-radius: 4px;" />
             </div>` 
          : '';

        // Header Logo Logic (top of email)
        let headerLogoHtml = `<h1 style="text-align: center; text-transform: uppercase; letter-spacing: 0.3em; color: ${logoColor}; font-weight: 300; margin-bottom: 40px;">EMANUEL UNGARO</h1>`;
        const isImgVariantHeader = ['img-pink', 'img-black', 'img-white'].includes(campaign.logoVariant || '');
        if (isImgVariantHeader) {
           const variantNameH = (campaign.logoVariant || '').replace('img-', '');
           headerLogoHtml = `<div style="text-align: center; margin-bottom: 40px;"><img src="${host}/email-logos/ungaro-${variantNameH}.png" alt="Emanuel Ungaro" style="height: 50px; width: auto; max-width: 80%; border: 0;" /></div>`;
        }

        // Footer Logo Logic
        let footerLogoHtml = `<p style="font-family: 'Futura', 'Century Gothic', 'Arial Black', sans-serif; font-size: 28px; color: ${logoColor}; font-weight: bold; text-transform: lowercase; letter-spacing: -0.02em; margin: 0; line-height: 1;">emanuel ungaro</p>`;
        const isImgVariant = ['img-pink', 'img-black', 'img-white'].includes(campaign.logoVariant || '');
        if (isImgVariant) {
           const variantName = (campaign.logoVariant || '').replace('img-', '');
           footerLogoHtml = `<img src="${host}/email-logos/ungaro-${variantName}.png" alt="Emanuel Ungaro" style="height: 40px; width: auto; max-width: 100%; border: 0;" />`;
        }

        const htmlContent = `
          <div style="background-color: ${bgColor}; padding: 40px 10px;">
            <div style="background-color: ${bgColor}; font-family: 'Times New Roman', Times, serif; max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid ${borderColor}; color: ${textColor}; line-height: 1.6;">
              ${headerLogoHtml}
              <p style="font-size: 16px; margin-bottom: 30px;">${greeting} ${escapeHtml(guest.firstName || guest.name || '')},</p>
              
              <div style="margin-bottom: 40px;">
                ${messageBody}
              </div>
              
              <div style="text-align: center; margin-bottom: 30px;">
                <a href="${rsvpLink}" style="display: inline-block; background-color: ${buttonBg}; color: ${buttonText}; padding: 20px 40px; text-decoration: none; text-transform: uppercase; font-size: 12px; letter-spacing: 0.3em; font-weight: bold;">${viewInviteText}</a>
              </div>
              
              ${decorativeImageHtml}

              <div style="border-top: 1px solid ${borderColor}; padding-top: 30px; margin-top: 50px; text-align: center;">
                <p style="font-size: 9px; color: #999; text-transform: uppercase; letter-spacing: 0.4em; margin-bottom: 25px;">${poweredByText}</p>
                ${footerLogoHtml}
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
    return handleApiError(err, 'send-bulk-invitation');
  }
}
