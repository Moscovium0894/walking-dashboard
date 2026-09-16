import { describe, expect, it } from 'vitest';
import { SIGNATURE_IMAGE_JS, SIGNATURE_METRICS } from '../src/worker/ui/signatureImageScript';

/**
 * The signature image is what makes an already-pasted signature update itself,
 * so these tests guard the properties that make that work.
 */

describe('the signature image script', () => {
  it('is syntactically valid JavaScript', () => {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    expect(() => new Function(SIGNATURE_IMAGE_JS)).not.toThrow();
  });

  it('is an IIFE under strict mode', () => {
    expect(SIGNATURE_IMAGE_JS.trimStart()).toMatch(/^\(function \(\) \{/);
    expect(SIGNATURE_IMAGE_JS).toContain("'use strict'");
  });

  it('renders every field that must update after sending', () => {
    // If any of these stopped being drawn, that detail would silently freeze in
    // every signature already pasted into a mail client.
    for (const field of ['data.name', 'data.credentials', 'data.school', 'data.book.title', 'data.book.author']) {
      expect(SIGNATURE_IMAGE_JS).toContain(field);
    }
    expect(SIGNATURE_IMAGE_JS).toContain('CURRENTLY READING');
  });

  it('draws the logo and the cover into the same image', () => {
    expect(SIGNATURE_IMAGE_JS).toContain('loadImage(data.logoUrl)');
    expect(SIGNATURE_IMAGE_JS).toContain('loadImage(data.coverUrl)');
    expect(SIGNATURE_IMAGE_JS).toContain('ctx.drawImage(logo');
    expect(SIGNATURE_IMAGE_JS).toContain('ctx.drawImage(cover');
  });

  it('exports PNG on an opaque background', () => {
    // Transparency would show the mail client's own background through the
    // signature, which varies and is often not white.
    expect(SIGNATURE_IMAGE_JS).toContain("'image/png'");
    expect(SIGNATURE_IMAGE_JS).toContain("ctx.fillStyle = '#FFFFFF'");
    expect(SIGNATURE_IMAGE_JS).toContain('ctx.fillRect(0, 0, M.width, height)');
  });

  it('rebuilds itself when the stored image is stale', () => {
    expect(SIGNATURE_IMAGE_JS).toContain("root.getAttribute('data-stale') === 'true'");
  });

  it('stamps the upload with the revision it rendered from', () => {
    // Stamping with the current revision instead would mask a change that
    // landed mid-render, leaving a stale image marked fresh.
    expect(SIGNATURE_IMAGE_JS).toContain("form.append('revision', String(data.revision))");
  });

  it('sends a CSRF token with the upload', () => {
    expect(SIGNATURE_IMAGE_JS).toContain("form.append('csrf'");
    expect(SIGNATURE_IMAGE_JS).toContain("credentials: 'same-origin'");
  });

  it('ignores a placeholder pixel rather than scaling it into a blank band', () => {
    expect(SIGNATURE_IMAGE_JS).toContain('img.naturalWidth > 4 && img.naturalHeight > 4');
  });

  it('cache-busts only the preview, never the address used in email', () => {
    // The whole design rests on the email-facing URL never changing.
    expect(SIGNATURE_IMAGE_JS).toContain("'?preview=' + Date.now()");
    expect(SIGNATURE_IMAGE_JS).not.toMatch(/signature\/[^']*\.png\?v=/);
  });
});

describe('the layout metrics', () => {
  it('draws above 1x so the image stays sharp on high-DPI screens', () => {
    expect(SIGNATURE_METRICS.pixelRatio).toBeGreaterThanOrEqual(2);
  });

  it('matches the type sizes used by the HTML signature', () => {
    // The two renderings should not visibly diverge.
    expect(SIGNATURE_METRICS.nameSize).toBe(19);
    expect(SIGNATURE_METRICS.schoolSize).toBe(14);
    expect(SIGNATURE_METRICS.titleSize).toBe(14);
    expect(SIGNATURE_METRICS.authorSize).toBe(12);
    expect(SIGNATURE_METRICS.logoWidth).toBe(150);
    expect(SIGNATURE_METRICS.coverWidth).toBe(58);
  });

  it('is embedded in the script rather than duplicated in it', () => {
    expect(SIGNATURE_IMAGE_JS).toContain(JSON.stringify(SIGNATURE_METRICS));
  });
});
