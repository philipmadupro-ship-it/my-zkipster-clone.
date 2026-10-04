# my-zkipster-clone

A full-stack event RSVP and ticketing app built with **Next.js**, **Firebase Firestore**, **Resend**, and **QR code generation**.

## Features

- **Couture Dispatch**: Mass invitation system with **Wave-Based Batching** (100 per wave) to ensure SMTP reliability.
- **Automated RSVP Confirmation**: Instant digital pass delivery with **embedded entry QR codes** sent directly to guest emails.
- **Unified Guest Registry**: Full **Edit/Delete** capabilities for every guest profile, including portraits and seat assignments.
- **Luxury Aesthetic**: Minimalist, branded RSVP and invitation views designed for high-society event management.
- **Integrated Web Scanner**: In-app QR verification with real-time guest profile lookups.
- **Outlook SMTP Integration**: Professional-grade email delivery via Microsoft 365 infrastructure.

## Tech Stack

- Frontend + Backend: Next.js 14 (App Router)
- Database: Firebase Firestore (Admin SDK)
- Email: Resend + React Email
- QR Code: `qrcode`

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create your local env file:

```bash
cp .env.local.example .env.local
```

3. Fill `.env.local` with:

```bash
FIREBASE_PROJECT_ID=guest-lsi
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@guest-lsi.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY_HERE\n-----END PRIVATE KEY-----\n"

RESEND_API_KEY=re_your_key_here
FROM_EMAIL=philipmadupro@gmail.com
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

4. Run the app:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000)

## Firebase Credentials

From Firebase Console -> Project Settings -> Service Accounts -> Generate new private key (JSON):

- `project_id` -> `FIREBASE_PROJECT_ID`
- `client_email` -> `FIREBASE_CLIENT_EMAIL`
- `private_key` -> `FIREBASE_PRIVATE_KEY`

## Access control

- **Admin API routes** (campaigns, guests, imports, dispatch, reminders, check-in) require a signed-in
  Firebase user. The dashboard sends the user's ID token and the server verifies it.
- Set **`ADMIN_EMAILS`** to the people allowed in (full addresses and/or `@domain` entries). With it
  unset, all admin requests are refused. Anyone can create a Firebase account, so this list is what
  actually decides who can send email from your SMTP account.
- Campaign-level actions (edit, delete, import, send) also require that the caller **owns** the
  campaign; the owner is taken from the verified token, never from the request body.
- Public routes, by design: the RSVP/invitation pages, `/c/<slug>` claim page, `/api/lookup-guest`
  and `/api/confirm-rsvp`.
- **Firestore rules** live in `firestore.rules`. Clients may only read their own campaigns and those
  campaigns' guests; all writes go through the API. Deploy them with
  `firebase deploy --only firestore:rules` (or paste them into Firebase Console → Firestore → Rules).

## Notes

- `FROM_EMAIL` must be a sender that Resend allows for your account/domain.
- Guest records are stored in Firestore collection: `guests`.
