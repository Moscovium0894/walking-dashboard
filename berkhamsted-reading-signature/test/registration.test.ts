import { describe, expect, it } from 'vitest';
import { isReservedSlug, slugify, validateRegistration } from '../src/worker/validate';

/** Build a registration form with sensible defaults. */
function form(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  const fields: Record<string, string> = {
    username: 'alice',
    slug: '',
    password: 'correct-horse-battery-staple',
    confirm: 'correct-horse-battery-staple',
    name: 'Alice Example',
    dateOfBirth: '2012-01-31',
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe('registration accepts a sensible signup', () => {
  it('returns the normalised values', () => {
    const result = validateRegistration(form());
    expect(result.ok).toBe(true);
    expect(result.value).toMatchObject({
      username: 'alice',
      slug: 'alice',
      name: 'Alice Example',
      dateOfBirth: '2012-01-31',
    });
  });

  it('falls back to the username when no address is given', () => {
    expect(validateRegistration(form({ username: 'Otto.P', slug: '' })).value?.slug).toBe('otto-p');
  });
});

describe('passwords', () => {
  it('rejects anything under 12 characters', () => {
    const result = validateRegistration(form({ password: 'short', confirm: 'short' }));
    expect(result.ok).toBe(false);
    expect(result.errors.password).toMatch(/at least 12/i);
  });

  it('accepts exactly 12', () => {
    expect(validateRegistration(form({ password: 'a'.repeat(12), confirm: 'a'.repeat(12) })).ok).toBe(true);
  });

  it('rejects a mismatched confirmation', () => {
    const result = validateRegistration(form({ confirm: 'something-else-entirely' }));
    expect(result.ok).toBe(false);
    expect(result.errors.confirm).toMatch(/do not match/i);
  });

  it('preserves spaces rather than normalising them away', () => {
    // A passphrase's spaces are characters, not formatting. Collapsing them
    // would silently change the password between signup and sign-in.
    const secret = '  four  random   words  ';
    expect(validateRegistration(form({ password: secret, confirm: secret })).ok).toBe(true);
  });
});

describe('usernames', () => {
  it.each(['ab', 'a'.repeat(33), 'has space', 'ünicode', '-leading', '', 'semi;colon'])(
    'rejects %j',
    (username) => {
      expect(validateRegistration(form({ username })).ok).toBe(false);
    },
  );

  it.each(['abc', 'otto.perowne', 'a_b-c.9', 'A'.repeat(32)])('accepts %j', (username) => {
    expect(validateRegistration(form({ username })).errors.username).toBeUndefined();
  });
});

describe('signature addresses', () => {
  it('strips anything that is not a letter or digit', () => {
    expect(slugify('Otto Perowne!')).toBe('otto-perowne');
    expect(slugify('  --Hello--  ')).toBe('hello');
    expect(slugify('ünïcode')).toBe('n-code');
  });

  it('caps the length', () => {
    expect(slugify('x'.repeat(100))).toHaveLength(32);
  });

  it.each(['admin', 'api', 'assets', 'signature', 'login', 'register', 'robots'])(
    'refuses the reserved address %j',
    (slug) => {
      expect(isReservedSlug(slug)).toBe(true);
      expect(validateRegistration(form({ slug })).errors.slug).toMatch(/reserved/i);
    },
  );

  it('refuses an address that collapses to nothing', () => {
    expect(validateRegistration(form({ username: 'abc', slug: '!!!' })).errors.slug).toBeDefined();
  });

  it('refuses an address under three characters', () => {
    expect(validateRegistration(form({ slug: 'ab' })).errors.slug).toMatch(/at least 3/i);
  });
});

describe('the rest of the form', () => {
  it('requires a display name', () => {
    expect(validateRegistration(form({ name: '' })).errors.name).toBeDefined();
  });

  it('requires a usable date of birth', () => {
    expect(validateRegistration(form({ dateOfBirth: '' })).errors.dateOfBirth).toBeDefined();
    expect(validateRegistration(form({ dateOfBirth: '31/01/2012' })).errors.dateOfBirth).toBeDefined();
    expect(validateRegistration(form({ dateOfBirth: '2013-02-29' })).errors.dateOfBirth).toBeDefined();
  });

  it('reports every problem at once rather than one at a time', () => {
    const result = validateRegistration(form({ username: 'a', password: 'x', confirm: 'y', name: '' }));
    expect(Object.keys(result.errors).length).toBeGreaterThanOrEqual(4);
  });
});
