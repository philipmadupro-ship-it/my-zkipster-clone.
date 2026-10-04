/**
 * ADMIN_EMAILS is a comma-separated allowlist. Entries are either a full
 * address (`press@ungaro.com`) or a whole domain (`@ungaro.com`).
 */

function entries(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** False when ADMIN_EMAILS is unset or empty (callers must then refuse everything). */
export function isAllowlistConfigured(): boolean {
  return entries().length > 0;
}

/** True if the address is allowed by an exact entry or by a `@domain` entry. */
export function isAllowlisted(email: string): boolean {
  const address = email.trim().toLowerCase();
  return entries().some((entry) => (entry.startsWith('@') ? address.endsWith(entry) : address === entry));
}

/**
 * True only if the address is written out in full in ADMIN_EMAILS. A `@domain`
 * entry does not count: the administrator has named this exact person.
 */
export function isExactlyListed(email: string): boolean {
  const address = email.trim().toLowerCase();
  return entries().some((entry) => !entry.startsWith('@') && entry === address);
}
