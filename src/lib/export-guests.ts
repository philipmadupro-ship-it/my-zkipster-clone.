/**
 * Builds the spreadsheet for "Export". The xlsx library is passed in (the page
 * loads it on demand) so this stays easy to test.
 *
 * Guest names can come from the public RSVP page, so a name like `=HYPERLINK(...)`
 * is possible. In an .xlsx file every value here is stored as plain text, which
 * a spreadsheet never runs as a formula (unlike CSV), so no escaping is needed.
 */

interface XlsxLike {
  utils: {
    json_to_sheet(rows: object[]): Record<string, unknown>;
    book_new(): unknown;
    book_append_sheet(workbook: unknown, sheet: unknown, name: string): void;
  };
}

export function buildWorkbook(XLSX: XlsxLike, rows: Record<string, string>[]): unknown {
  const sheet = XLSX.utils.json_to_sheet(rows);

  // Column widths that roughly fit the content (capped), so it opens readable.
  const keys = rows.length > 0 ? Object.keys(rows[0]) : [];
  sheet['!cols'] = keys.map((key) => ({
    wch: Math.min(48, Math.max(key.length, ...rows.map((r) => String(r[key] ?? '').length)) + 2),
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Guest list');
  return workbook;
}

/** e.g. "Ungaro-FW26-Show-guest-list-2026-10-04.xlsx" */
export function exportFileName(campaignName: string, now: Date = new Date()): string {
  const slug =
    campaignName
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'event';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${slug}-guest-list-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.xlsx`;
}
