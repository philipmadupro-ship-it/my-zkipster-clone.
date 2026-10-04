/** Rules for the free-text guest fields (tag and notes). Shared by the API routes and the forms. */

export const DEFAULT_TAGS = ['Standard', 'VIP', 'Press', 'Influencer', 'Buyer', 'Staff', 'Speaker', 'Family', 'Friends'];

export const MAX_TAG_LENGTH = 30;
export const MAX_NOTES_LENGTH = 500;

/**
 * Tidies a tag: trims, collapses spaces, limits the length, and uses the usual
 * spelling for the built-in ones ("vip" -> "VIP"). Empty means "Standard".
 */
export function canonicalTag(input: unknown): string {
  const tag = typeof input === 'string' ? input.replace(/\s+/g, ' ').trim().slice(0, MAX_TAG_LENGTH) : '';
  if (!tag) return 'Standard';
  return DEFAULT_TAGS.find((known) => known.toLowerCase() === tag.toLowerCase()) ?? tag;
}

/** Tidies a note: normal line breaks, trimmed, limited in length. */
export function cleanNotes(input: unknown): string {
  return typeof input === 'string' ? input.replace(/\r\n?/g, '\n').trim().slice(0, MAX_NOTES_LENGTH) : '';
}
