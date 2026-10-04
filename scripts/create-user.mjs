// Creates (or resets) an admin login. There is no public sign-up page, so this is
// how accounts get made. The account is created already email-verified, which
// the API and Firestore rules require.
//
//   npm run create-user -- press@ungaro.com
//
// Reads Firebase Admin credentials from the environment or .env.local
// (FIREBASE_SERVICE_ACCOUNT_JSON, or FIREBASE_PROJECT_ID / CLIENT_EMAIL / PRIVATE_KEY).
// The password is prompted for (hidden), or taken from ADMIN_USER_PASSWORD.
//
// Remember: signing in is not enough. The address must also be in ADMIN_EMAILS.
import readline from 'node:readline';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const MIN_PASSWORD_LENGTH = 8;

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      // Echo the prompt itself, but not what is typed.
      rl._writeToOutput = (text) => {
        if (text.startsWith(question)) rl.output.write(text);
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer);
    });
  });
}

function getCredential() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json) {
    try {
      return cert(JSON.parse(json));
    } catch {
      fail('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.');
    }
  }
  const { FIREBASE_PROJECT_ID: projectId, FIREBASE_CLIENT_EMAIL: clientEmail } = process.env;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) {
    fail('Firebase Admin credentials not found. Set them in .env.local (see .env.local.example).');
  }
  return cert({ projectId, clientEmail, privateKey });
}

try {
  process.loadEnvFile('.env.local');
} catch {
  // No .env.local; rely on the real environment.
}

const email = (process.argv[2] ?? (await ask('Email: '))).trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Please give a valid email address.');

const password = process.env.ADMIN_USER_PASSWORD ?? (await ask('Password (hidden): ', { hidden: true }));
if (password.length < MIN_PASSWORD_LENGTH) fail(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);

const app = getApps()[0] ?? initializeApp({ credential: getCredential() });
const auth = getAuth(app);

try {
  const existing = await auth.getUserByEmail(email);
  await auth.updateUser(existing.uid, { password, emailVerified: true, disabled: false });
  console.log(`Updated ${email}: password reset and marked verified.`);
} catch (err) {
  if (err?.code !== 'auth/user-not-found') fail(err?.message ?? String(err));
  try {
    await auth.createUser({ email, password, emailVerified: true });
    console.log(`Created ${email} (already verified).`);
  } catch (createErr) {
    fail(createErr?.message ?? String(createErr));
  }
}

if (!process.env.ADMIN_EMAILS?.toLowerCase().split(',').some((e) => e.trim() === email || (e.trim().startsWith('@') && email.endsWith(e.trim())))) {
  console.log(`Note: ${email} is not in ADMIN_EMAILS in this environment. Add it in Vercel or the account can sign in but not use the app.`);
}
