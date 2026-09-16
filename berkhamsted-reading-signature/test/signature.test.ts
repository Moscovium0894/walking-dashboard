import { describe, expect, it } from 'vitest';
import {
  buildCredentialLine,
  renderSignatureDocument,
  renderSignatureHtml,
  renderSignatureText,
  type SignatureOptions,
} from '../src/worker/signature';
import type { SignatureData } from '../src/shared/types';

const OPTIONS: SignatureOptions = {
  origin: 'https://sig.example.workers.dev',
  slug: 'otto',
  hasLogo: true,
  hasCover: true,
};

function makeData(overrides: Partial<SignatureData> = {}): SignatureData {
  return {
    profile: {
      name: 'Otto Perowne',
      dateOfBirth: '2012-01-31',
      house: 'Bartrum',
      school: 'Berkhamsted School',
      subtitle: '',
      showHouse: true,
      showYear: true,
      showSchool: true,
      showSubtitle: false,
      updatedAt: '2026-09-16T00:00:00.000Z',
    },
    book: {
      title: 'Wolf Hall',
      author: 'Hilary Mantel',
      coverUrl: 'https://covers.openlibrary.org/b/id/123-M.jpg',
      isbn: '9780007230204',
      publicationYear: 2009,
      source: 'open-library',
      updatedAt: '2026-09-16T00:00:00.000Z',
    },
    year: {
      label: 'Year 10',
      yearGroup: 10,
      academicYearLabel: '2026/27',
      status: 'at-school',
    },
    revision: 7,
    ...overrides,
  };
}

describe('the signature contains what it should', () => {
  const html = renderSignatureHtml(makeData(), OPTIONS);

  it.each([
    ['name', 'Otto Perowne'],
    ['house', 'Bartrum'],
    ['year group', 'Year 10'],
    ['school', 'Berkhamsted School'],
    ['book title', 'Wolf Hall'],
    ['author', 'Hilary Mantel'],
  ])('includes the %s', (_label, value) => {
    expect(html).toContain(value);
  });

  it('includes the logo and the cover', () => {
    expect(html).toContain('/signature/otto/logo.png');
    expect(html).toContain('/signature/otto/cover.jpg');
  });
});

describe('email client compatibility', () => {
  const html = renderSignatureHtml(makeData(), OPTIONS);

  it('contains no script of any kind', () => {
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/javascript:/i);
    // Inline event handlers would be stripped by clients and are a smell.
    expect(html).not.toMatch(/\son[a-z]+\s*=/i);
  });

  it('uses tables rather than modern layout systems', () => {
    expect(html).toContain('<table');
    expect(html).not.toMatch(/display:\s*flex/i);
    expect(html).not.toMatch(/display:\s*grid/i);
    expect(html).not.toMatch(/position:\s*(absolute|fixed)/i);
  });

  it('avoids external stylesheets and web fonts', () => {
    expect(html).not.toMatch(/<link/i);
    expect(html).not.toMatch(/@import/i);
    expect(html).not.toMatch(/fonts\.googleapis/i);
  });

  it('carries no class attributes, which clients routinely strip', () => {
    expect(html).not.toMatch(/\sclass=/i);
  });

  it('uses absolute image URLs, since an email has no base URL', () => {
    const sources = [...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map((match) => match[1]);
    expect(sources.length).toBeGreaterThan(0);
    for (const source of sources) {
      expect(source).toMatch(/^https:\/\//);
    }
  });

  it('marks presentational tables as such for screen readers', () => {
    const tableCount = (html.match(/<table/g) ?? []).length;
    const presentationCount = (html.match(/role="presentation"/g) ?? []).length;
    expect(presentationCount).toBe(tableCount);
  });

  it('gives every image alt text', () => {
    for (const tag of html.match(/<img[^>]*>/g) ?? []) {
      expect(tag).toMatch(/alt="/);
    }
  });
});

describe('cache busting', () => {
  it('puts the revision on every image URL', () => {
    const html = renderSignatureHtml(makeData({ revision: 42 }), OPTIONS);
    for (const tag of html.match(/<img[^>]+src="([^"]+)"/g) ?? []) {
      expect(tag).toContain('?v=42');
    }
  });

  it('changes the image URLs when the revision changes', () => {
    const before = renderSignatureHtml(makeData({ revision: 1 }), OPTIONS);
    const after = renderSignatureHtml(makeData({ revision: 2 }), OPTIONS);
    expect(before).not.toBe(after);
  });
});

describe('output escaping', () => {
  it('renders markup in a book title as text', () => {
    const data = makeData();
    const hostile = {
      ...data,
      book: { ...data.book!, title: '<script>alert(1)</script>', author: '" onerror="alert(2)' },
    };

    const html = renderSignatureHtml(hostile, OPTIONS);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');

    // The author string is designed to break out of an attribute. It cannot,
    // because its quotes are entity-encoded: the payload survives as inert
    // text, so assert on the quotes rather than on the word "onerror", which
    // legitimately appears as escaped body text.
    expect(html).toContain('&quot; onerror=&quot;alert(2)');
    expect(html).not.toContain('" onerror="alert(2)');
  });

  it('escapes a hostile name and school', () => {
    const data = makeData();
    const html = renderSignatureHtml(
      { ...data, profile: { ...data.profile, name: 'A<b>B', school: 'C"D' } },
      OPTIONS,
    );
    expect(html).toContain('A&lt;b&gt;B');
    expect(html).not.toContain('A<b>B');
  });
});

describe('missing data is handled gracefully', () => {
  it('omits the reading section when no book is set', () => {
    const html = renderSignatureHtml(makeData({ book: null }), OPTIONS);
    expect(html).not.toContain('Currently reading');
    expect(html).toContain('Otto Perowne');
  });

  it('shows a labelled placeholder when the logo is missing', () => {
    const html = renderSignatureHtml(makeData(), { ...OPTIONS, hasLogo: false });
    expect(html).toContain('LOGO');
    expect(html).not.toContain('/signature/otto/logo.png');
  });

  it('shows a labelled placeholder when the cover is missing', () => {
    const html = renderSignatureHtml(makeData(), { ...OPTIONS, hasCover: false });
    expect(html).toContain('NO COVER');
    expect(html).not.toContain('/signature/otto/cover.jpg');
  });

  it('omits the author line when the author is unknown', () => {
    const data = makeData();
    const html = renderSignatureHtml(
      { ...data, book: { ...data.book!, author: '' } },
      OPTIONS,
    );
    expect(html).toContain('Wolf Hall');
    expect(html).not.toContain('Hilary Mantel');
  });
});

describe('field visibility', () => {
  it('omits the year when showYear is off', () => {
    const data = makeData();
    const html = renderSignatureHtml(
      { ...data, profile: { ...data.profile, showYear: false } },
      OPTIONS,
    );
    expect(html).not.toContain('Year 10');
    expect(html).toContain('Bartrum');
  });

  it('omits the school when showSchool is off', () => {
    const data = makeData();
    const html = renderSignatureHtml(
      { ...data, profile: { ...data.profile, showSchool: false } },
      OPTIONS,
    );
    expect(html).not.toContain('Berkhamsted School');
  });

  it('hides the year for someone outside school years', () => {
    const data = makeData({
      year: { label: 'Left school', yearGroup: 14, academicYearLabel: '2030/31', status: 'left-school' },
    });
    expect(buildCredentialLine(data)).toBe('Bartrum');
  });

  it('joins year and house with a separator when both are shown', () => {
    expect(buildCredentialLine(makeData())).toBe('Year 10  ·  Bartrum');
  });
});

describe('the public document', () => {
  it('is a complete HTML document that asks not to be indexed', () => {
    const document = renderSignatureDocument(makeData(), OPTIONS);
    expect(document).toMatch(/^<!DOCTYPE html>/);
    expect(document).toContain('noindex');
    expect(document).not.toMatch(/<script/i);
  });
});

describe('the plain-text fallback', () => {
  it('lists the details without any markup', () => {
    const text = renderSignatureText(makeData());
    expect(text).toContain('Otto Perowne');
    expect(text).toContain('Year 10 | Bartrum');
    expect(text).toContain('Currently reading: Wolf Hall — Hilary Mantel');
    expect(text).not.toContain('<');
  });

  it('drops the reading line when there is no book', () => {
    expect(renderSignatureText(makeData({ book: null }))).not.toContain('Currently reading');
  });
});
