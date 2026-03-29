import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getAdminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { guestId, campaignName, appUrl } = await req.json();

    if (!guestId) {
      return NextResponse.json({ error: 'guestId is required' }, { status: 400 });
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'RESEND_API_KEY is not configured' }, { status: 500 });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    const db = getAdminDb();
    const guestDoc = await db.collection('guests').doc(guestId).get();
    
    if (!guestDoc.exists) {
      return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
    }

    const guest = guestDoc.data();
    if (!guest?.email) {
      return NextResponse.json({ error: 'Guest has no email address' }, { status: 400 });
    }

    const rsvpLink = `${appUrl}/c/${guest.campaignId}`;
    const guestName = guest.firstName || guest.name || 'Guest';

    const { data, error } = await resend.emails.send({
      from: 'Antgravity Events <onboarding@resend.dev>', // Note: in production use a verified domain
      to: [guest.email],
      subject: `Exclusive Invitation: ${campaignName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="width: 40px; hieght: 40px; background-color: #7c3aed; color: white; display: inline-block; padding: 10px; border-radius: 8px; font-weight: bold; font-size: 20px;">A</div>
            <h1 style="color: #1e293b; margin-top: 10px;">Antgravity</h1>
          </div>
          
          <h2 style="color: #1e293b;">You're Invited!</h2>
          <p style="color: #475569; font-size: 16px; line-height: 1.6;">
            Hello ${guestName},<br/><br/>
            We are pleased to invite you to <strong>${campaignName}</strong>.
          </p>
          
          <div style="text-align: center; margin: 40px 0;">
            <a href="${rsvpLink}" style="background-color: #7c3aed; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
              Confirm Your Attendance
            </a>
          </div>
          
          <p style="color: #64748b; font-size: 13px; text-align: center;">
            Please click the button above to confirm your RSVP and receive your personal entry QR code.
          </p>
          
          <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 40px 0;" />
          <p style="color: #94a3b8; font-size: 12px; text-align: center;">
            Sent via Antgravity Event Management
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('[Resend Error]:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data?.id });
  } catch (err) {
    console.error('send-invitation error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
