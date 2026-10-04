# my-zkipster-clone

An event guest-list, RSVP and check-in app built with **Next.js**, **Firebase Firestore** (as the database only), **Nodemailer** (Outlook / Microsoft 365 SMTP) and **QR codes**.

## Features

- **Guest list**: search by name, email or category (accent-insensitive), filter by Arrived / Not arrived / Confirmed / Invited, see who has arrived and when, and check guests in (or undo) by hand. The list refreshes every few seconds.
- **Couture Dispatch**: bulk invitation emails in batches of 100.
- **RSVP + digital pass**: guests confirm from a signed link and get a QR pass by email.
- **Hostess scanner**: scan a guest's QR code to check them in.
- **Import / manual entry / edit / delete** for every guest, with portraits and categories.
- **Branded RSVP and invitation pages**, in English or French.

## Tech stack

- Next.js 16 (App Router), React 19, Tailwind
- Database: Firebase Firestore, accessed **only from the server** (Admin SDK)
- Email: Nodemailer over SMTP (Outlook / Microsoft 365)
- QR codes: `qrcode`, scanning with `html5-qrcode`
- Login: a simple signed-cookie login (no external auth service)

## Local setup

```bash
npm install
cp .env.local.example .env.local   # then fill it in (see below)
npm run dev                        # http://localhost:3000
```

Environment variables (see `.env.local.example` for the full list):

| Variable | What it is |
|---|---|
| `ADMIN_LOGINS` | Who can sign in: JSON `{"email":"password"}` for 1 or 2 people |
| `SESSION_SECRET` | 32+ characters, signs the login cookie (`openssl rand -base64 48`) |
| `RSVP_LINK_SECRET` | 32+ characters, signs guest RSVP links (`openssl rand -base64 48`) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` *or* `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` | Firebase Admin credentials (Project Settings → Service accounts → Generate new private key) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_SECURE` | Outlook SMTP |
| `NEXT_PUBLIC_APP_URL` | The site's public address, used in emailed links |

The old `NEXT_PUBLIC_FIREBASE_*` and `ADMIN_EMAILS` variables are no longer used.

## Signing in

- Sign-in is **email + password**. There is no sign-up page, no emailed link and no "forgot password".
- The people allowed in, and their passwords, live in the **`ADMIN_LOGINS`** setting, e.g.
  `{"press@ungaro.com":"a-long-password","second@ungaro.com":"another-long-one"}`.
  To add someone, remove someone or change a password: edit it (Vercel → Settings → Environment
  Variables) and redeploy. Removing someone ends their session on their next request.
- Everyone listed sees the **same campaigns and guests** (it is meant for a small trusted team).
- Passwords are stored as plain text in that setting, so use long ones and keep Vercel access limited.
  Wrong-password attempts are rate-limited, but only per running server instance, so this slows
  guessing down; it does not stop it.
- The session is a signed, HttpOnly cookie that lasts 7 days. Changing `SESSION_SECRET` signs everyone out.
- Firestore rules (`firestore.rules`) refuse **all** direct access, because only the server uses the
  database. Deploy them with `firebase deploy --only firestore:rules` (or paste them into
  Firebase Console → Firestore → Rules).

## RSVP links

- Invitation and reminder emails link to `/rsvp/<guestId>.<signature>` (HMAC-SHA256 with
  `RSVP_LINK_SECRET`). The guest ID alone, which is also what the QR code holds, does not open an RSVP.
- Links sent **before signing existed** are bare guest IDs and keep working until you set
  `RSVP_ALLOW_LEGACY_LINKS=false`. Reminders go out with signed links, so re-send reminders first,
  then flip the switch.
- Rotating `RSVP_LINK_SECRET` invalidates every signed link already sent.
- Public by design: the RSVP/invitation pages, the `/c/<slug>` claim page, `/api/lookup-guest` and
  `/api/confirm-rsvp`. Everything else requires a login.

## Tests

`npm test` runs the unit tests for the login/session and RSVP-link code (Node's built-in test runner).
