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

- **Login** is email + password, or Google. There is **no sign-up page** and no magic-link sign-in:
  accounts are created by an administrator with `npm run create-user -- someone@ungaro.com` (prompts
  for a password; needs the Firebase Admin credentials in `.env.local`). The account is created
  already email-verified, so no email is sent. In Firebase Console → Authentication → Sign-in method,
  enable **Email/Password** and leave **Email link (passwordless sign-in)** switched off.
  - The API and Firestore rules only trust **verified** emails and the `ADMIN_EMAILS` list, so
    accounts created some other way (for example by calling Firebase's sign-up endpoint directly)
    can't use the app. If your Firebase project offers it, also turn off sign-up under
    Authentication → Settings → User actions.
  - "Forgot password?" still sends Firebase's reset email (from `noreply@<project>.firebaseapp.com`,
    check spam). Re-running `create-user` for an existing address resets the password directly.
- **Admin API routes** (campaigns, guests, imports, dispatch, reminders, check-in) require a signed-in
  Firebase user. The dashboard sends the user's ID token and the server verifies it.
- Set **`ADMIN_EMAILS`** to the people allowed in (full addresses and/or `@domain` entries). With it
  unset, all admin requests are refused. Anyone can create a Firebase account, so this list is what
  actually decides who can send email from your SMTP account.
- Campaign-level actions (edit, delete, import, send) also require that the caller **owns** the
  campaign; the owner is taken from the verified token, never from the request body.
- Public routes, by design: the RSVP/invitation pages, `/c/<slug>` claim page, `/api/lookup-guest`
  and `/api/confirm-rsvp`.
- **RSVP links are signed.** Invitation and reminder emails link to `/rsvp/<guestId>.<signature>`
  (HMAC-SHA256 with `RSVP_LINK_SECRET`; generate one with `openssl rand -base64 48`). The guest ID alone
  no longer opens an RSVP, which matters because it is also what the QR code encodes. The server
  recomputes the signature, so nothing extra is stored.
  - Links sent **before** this change are bare guest IDs. They keep working until you set
    `RSVP_ALLOW_LEGACY_LINKS=false`. Reminders go out with signed links, so re-send reminders first,
    then flip the switch.
  - Rotating `RSVP_LINK_SECRET` invalidates every signed link already sent.
  - Run the token tests with `npm test`.
- **Firestore rules** live in `firestore.rules`. Clients may only read their own campaigns and those
  campaigns' guests; all writes go through the API. Deploy them with
  `firebase deploy --only firestore:rules` (or paste them into Firebase Console → Firestore → Rules).

## Notes

- `FROM_EMAIL` must be a sender that Resend allows for your account/domain.
- Guest records are stored in Firestore collection: `guests`.
