/**
 * Email signature rendering.
 *
 * Constraints this file exists to satisfy:
 *
 *  * No JavaScript. Email clients do not run it, and many strip it entirely.
 *  * Tables for layout. Outlook's desktop clients render through Word's HTML
 *    engine, which has no support for flexbox or grid and unreliable support
 *    for float, so nested tables with width attributes remain the only layout
 *    mechanism that behaves consistently.
 *  * Inline styles only. Gmail strips <style> blocks in several contexts, so
 *    every declaration is on the element it applies to.
 *  * Absolute image URLs on our own origin, carrying the revision number, so a
 *    changed book cannot leave a stale cover cached in a client.
 *  * No web fonts. Only fonts likely to exist locally, with a documented
 *    fallback chain.
 */

import { escapeHtml } from '../shared/sanitize';
import type { SignatureData } from '../shared/types';

/** Palette taken from the supplied logo and the specified brand navy. */
export const BRAND = {
  navy: '#0A2142',
  gold: '#EFC486',
  rose: '#C1272D',
  cream: '#F7F4ED',
  ink: '#1F2937',
  muted: '#5A6473',
  rule: '#D9D3C7',
  white: '#FFFFFF',
} as const;

const SERIF = "Georgia, 'Times New Roman', Times, serif";
const SANS = "Arial, 'Helvetica Neue', Helvetica, sans-serif";

export interface SignatureOptions {
  /** Absolute origin, e.g. https://example.workers.dev. Required for email. */
  origin: string;
  /** Path segment identifying the signature. */
  slug: string;
  /** Whether a logo has been uploaded; drives the placeholder. */
  hasLogo: boolean;
  /** Whether a stored cover exists; drives the placeholder. */
  hasCover: boolean;
}

/** Stable URL for the logo, versioned so a replacement is picked up at once. */
export function logoUrl(options: SignatureOptions, revision: number): string {
  return `${options.origin}/signature/${options.slug}/logo.png?v=${revision}`;
}

/** Stable URL for the cover, versioned so a changed book busts caches. */
export function coverUrl(options: SignatureOptions, revision: number): string {
  return `${options.origin}/signature/${options.slug}/cover.jpg?v=${revision}`;
}

/** Build the "Year 10 · Bartrum" line, honouring the per-field visibility flags. */
export function buildCredentialLine(data: SignatureData): string {
  const parts: string[] = [];
  if (data.profile.showYear && data.year.status === 'at-school') parts.push(data.year.label);
  if (data.profile.showHouse && data.profile.house !== '') parts.push(data.profile.house);
  return parts.join('  ·  ');
}

/**
 * Render the signature as an HTML fragment suitable for pasting into an email
 * signature editor.
 */
export function renderSignatureHtml(data: SignatureData, options: SignatureOptions): string {
  const { profile, book, revision } = data;

  const credentials = buildCredentialLine(data);
  const showSchool = profile.showSchool && profile.school !== '';
  const showSubtitle = profile.showSubtitle && profile.subtitle !== '';

  // The alt text names the school only when the school is itself shown. A
  // hidden field must not reappear in an attribute.
  const logoAlt = showSchool ? profile.school : 'School crest';

  const logoCell = options.hasLogo
    ? `<img src="${escapeHtml(logoUrl(options, revision))}" width="150" alt="${escapeHtml(
        logoAlt,
      )}" style="display:block;border:0;outline:none;text-decoration:none;width:150px;max-width:150px;height:auto;" />`
    : placeholderBox(150, 68, 'LOGO');

  const coverCell = book
    ? options.hasCover
      ? `<img src="${escapeHtml(coverUrl(options, revision))}" width="58" alt="${escapeHtml(
          `Cover of ${book.title}`,
        )}" style="display:block;border:0;outline:none;text-decoration:none;width:58px;max-width:58px;height:auto;border-radius:2px;" />`
      : placeholderBox(58, 86, 'NO COVER')
    : '';

  // Outlook ignores CSS margins on tables, so vertical rhythm is created with
  // spacer rows and cell padding rather than margin.
  const rows: string[] = [];

  rows.push(`
      <tr>
        <td style="padding:0 0 14px 0;">${logoCell}</td>
      </tr>`);

  rows.push(`
      <tr>
        <td style="padding:0;font-family:${SERIF};font-size:19px;line-height:24px;font-weight:bold;color:${BRAND.navy};letter-spacing:0.2px;">
          ${escapeHtml(profile.name)}
        </td>
      </tr>`);

  if (credentials !== '') {
    rows.push(`
      <tr>
        <td style="padding:5px 0 0 0;font-family:${SANS};font-size:12px;line-height:16px;color:${BRAND.rose};letter-spacing:1.4px;text-transform:uppercase;font-weight:bold;">
          ${escapeHtml(credentials)}
        </td>
      </tr>`);
  }

  if (showSchool) {
    rows.push(`
      <tr>
        <td style="padding:5px 0 0 0;font-family:${SERIF};font-size:14px;line-height:19px;color:${BRAND.muted};">
          ${escapeHtml(profile.school)}
        </td>
      </tr>`);
  }

  if (showSubtitle) {
    rows.push(`
      <tr>
        <td style="padding:3px 0 0 0;font-family:${SANS};font-size:12px;line-height:17px;color:${BRAND.muted};font-style:italic;">
          ${escapeHtml(profile.subtitle)}
        </td>
      </tr>`);
  }

  if (book) {
    rows.push(`
      <tr>
        <td style="padding:16px 0 0 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
            <tr>
              <td height="1" style="height:1px;line-height:1px;font-size:0;background-color:${BRAND.gold};width:56px;">&nbsp;</td>
            </tr>
          </table>
        </td>
      </tr>`);

    rows.push(`
      <tr>
        <td style="padding:14px 0 0 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
            <tr>
              ${
                coverCell === ''
                  ? ''
                  : `<td valign="top" style="padding:0 14px 0 0;">${coverCell}</td>`
              }
              <td valign="top" style="padding:0;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                  <tr>
                    <td style="padding:0 0 4px 0;font-family:${SANS};font-size:10px;line-height:13px;color:${BRAND.muted};letter-spacing:1.6px;text-transform:uppercase;">
                      Currently reading
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0;font-family:${SERIF};font-size:14px;line-height:19px;color:${BRAND.navy};font-style:italic;font-weight:bold;">
                      ${escapeHtml(book.title)}
                    </td>
                  </tr>
                  ${
                    book.author === ''
                      ? ''
                      : `<tr>
                    <td style="padding:2px 0 0 0;font-family:${SANS};font-size:12px;line-height:17px;color:${BRAND.muted};">
                      ${escapeHtml(book.author)}
                    </td>
                  </tr>`
                  }
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>`);
  }

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background-color:${BRAND.white};">
  <tr>
    <td style="padding:0;border-left:3px solid ${BRAND.navy};">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
        <tr>
          <td style="padding:2px 0 2px 18px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${rows.join(
              '',
            )}
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

/**
 * A bordered box standing in for a missing image.
 *
 * Rendered as a table rather than a styled div so it survives Outlook, and
 * labelled so the cause is obvious rather than appearing as a broken image.
 */
function placeholderBox(width: number, height: number, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="${width}" style="border-collapse:collapse;width:${width}px;">
                <tr>
                  <td align="center" valign="middle" height="${height}" style="height:${height}px;border:1px dashed ${BRAND.rule};background-color:${BRAND.cream};font-family:${SANS};font-size:9px;letter-spacing:1px;color:${BRAND.muted};">
                    ${escapeHtml(label)}
                  </td>
                </tr>
              </table>`;
}

/**
 * Wrap the signature in a complete HTML document for the public endpoint.
 *
 * This is what /signature/<slug> serves. Some email clients can consume a URL
 * directly, and it doubles as the page you copy from.
 */
export function renderSignatureDocument(
  data: SignatureData,
  options: SignatureOptions,
): string {
  const title = `${data.profile.name} — email signature`;

  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:24px;background-color:${BRAND.cream};">
${renderSignatureHtml(data, options)}
</body>
</html>`;
}

/**
 * Plain-text fallback, for clients composing in plain text.
 */
export function renderSignatureText(data: SignatureData): string {
  const lines: string[] = [data.profile.name];

  const credentials = buildCredentialLine(data);
  if (credentials !== '') lines.push(credentials.replace(/\s+·\s+/g, ' | '));
  if (data.profile.showSchool && data.profile.school !== '') lines.push(data.profile.school);
  if (data.profile.showSubtitle && data.profile.subtitle !== '') lines.push(data.profile.subtitle);

  if (data.book) {
    lines.push('');
    lines.push(
      data.book.author === ''
        ? `Currently reading: ${data.book.title}`
        : `Currently reading: ${data.book.title} — ${data.book.author}`,
    );
  }

  return lines.join('\n');
}
