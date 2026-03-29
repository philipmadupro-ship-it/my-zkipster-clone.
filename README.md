# my-zkipster-clone

A full-stack event RSVP and ticketing app built with **Next.js**, **Firebase Firestore**, **Resend**, and **QR code generation**.

## Features

- Admin dashboard with live guest statuses
- Add guests from the dashboard
- Personalized invite email with unique RSVP link
- RSVP accept/decline flow
- QR ticket generation on acceptance
- Ticket email delivery with QR attachment

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

## Notes

- `FROM_EMAIL` must be a sender that Resend allows for your account/domain.
- Guest records are stored in Firestore collection: `guests`.
