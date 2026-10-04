import nodemailer from 'nodemailer';

/** Escapes a value for safe interpolation into HTML text or a quoted attribute. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Returns the URL escaped for an attribute, or '' unless it is http(s). */
export function safeImageUrl(value: unknown): string {
  const url = String(value ?? '').trim();
  return /^https?:\/\//i.test(url) ? escapeHtml(url) : '';
}

/**
 * SMTP transport with normal TLS verification. Port 587 uses STARTTLS, which
 * we require rather than allowing a silent downgrade to plain text.
 */
export function createMailTransport() {
  const secure = process.env.SMTP_SECURE === 'true';
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.office365.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure,
    requireTLS: !secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/**
 * Base URL used for links and images inside emails. `trustedHint` should only
 * be passed from authenticated routes (the dashboard's own origin); public
 * routes must not let the caller choose where email links point.
 */
export function getBaseUrl(trustedHint?: string | null): string {
  const hint = trustedHint && /^https?:\/\//i.test(trustedHint) ? trustedHint : '';
  const candidates = [
    hint,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`,
    process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
    'http://localhost:3000',
  ];
  return (candidates.find(Boolean) as string).replace(/\/+$/, '');
}
