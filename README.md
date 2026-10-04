# my-zkipster-clone

An event guest-list, RSVP and check-in app built with **Next.js**, **Firebase Firestore** (as the database only), **Nodemailer** (Outlook / Microsoft 365 SMTP) and **QR codes**.

## Features

- **Guest list** (dashboard)
  - Search by name, email, tag or note (accent-insensitive; every word must match). Filter by Arrived / Not arrived / Confirmed / Invited and by **tag**; sort by newest, name, arrival time or status.
  - **Arrival column**: when each guest arrived and **who checked them in**, with Check in / Undo on every row.
  - **Plus-ones sit under the guest who brought them**, with "+3 · 1/3 arrived" on the host and a "Plus-ones arrived" total.
  - Select several guests and check them all in, or use **Check in whole party** on a host.
  - **Notes** per guest (e.g. "seat near the front"), and **tags** beyond Standard/VIP (type any tag, with suggestions).
  - **Export Excel**: the whole list with arrival time, who checked them in, plus-one of, tag and notes.
  - Refreshes by itself every few seconds.
- **Door mode** (`/door`, built for a phone): one big search box, big result cards with notes in a highlighted box, one-tap **CHECK IN**, **Check in whole party**, an UNDO bar after every check-in, a live "arrived / expected" counter, and a Scan QR button. If a guest is already checked in it says **when and by whom**, including when someone else checked them in a moment earlier.
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

## Importing plus-ones, notes and tags

In a spreadsheet import, a column named like `parent`, `host`, `plus one` holds the host of a plus-one,
written as the host's **email or name** (any order, accents and capitals don't matter; the host may
be further down the file). A `notes` / `comment` / `remarque` column becomes the guest's note, and
`tag` / `category` / `group` becomes their tag. Plus-ones whose host can't be found are kept as typed
and linked automatically once a matching guest exists.

## Tests

`npm test` runs the unit tests (login/session, RSVP links, guest-list logic, check-in rules, export).
