import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requireAdmin, getCampaign, handleApiError } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const LOGO_VARIANTS = ['black', 'white', 'img-pink', 'img-black', 'img-white'];
const LANGUAGES = ['en', 'fr'];

// Saves the email branding settings edited in the Couture Dispatch modal.
export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const { campaignId, language, logoVariant, emailImageUrl, emailMessage } = await req.json();

    if (!campaignId || typeof campaignId !== 'string') {
      return NextResponse.json({ error: 'campaignId is required' }, { status: 400 });
    }
    if (!LANGUAGES.includes(language)) {
      return NextResponse.json({ error: 'Invalid language' }, { status: 400 });
    }
    if (!LOGO_VARIANTS.includes(logoVariant)) {
      return NextResponse.json({ error: 'Invalid logo variant' }, { status: 400 });
    }

    const db = getAdminDb();
    await getCampaign(db, campaignId);

    await db.collection('campaigns').doc(campaignId).update({
      language,
      logoVariant,
      emailImageUrl: typeof emailImageUrl === 'string' ? emailImageUrl.trim() : '',
      emailMessage: typeof emailMessage === 'string' ? emailMessage : '',
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err, 'update-campaign');
  }
}
