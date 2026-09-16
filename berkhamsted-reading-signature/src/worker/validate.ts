/**
 * Input validation for form submissions.
 *
 * Everything that reaches the database passes through here first. The rules are
 * deliberately conservative about length, because these values are rendered
 * into an email signature and an absurdly long title would wreck the layout
 * long before it threatened anything.
 */

import { normaliseWhitespace, safeHttpUrl } from '../shared/sanitize';
import { InvalidDateOfBirthError, calculateSchoolYear } from '../shared/schoolYear';
import type { Book, Profile } from '../shared/types';

export interface ValidationResult<T> {
  ok: boolean;
  value?: T;
  errors: Record<string, string>;
}

const LIMITS = {
  name: 80,
  house: 40,
  school: 100,
  subtitle: 100,
  title: 200,
  author: 160,
  isbn: 20,
  query: 120,
} as const;

function text(form: FormData, field: string): string {
  const raw = form.get(field);
  return typeof raw === 'string' ? normaliseWhitespace(raw) : '';
}

/**
 * Read a field verbatim, without whitespace collapsing.
 *
 * Passwords must not be normalised: leading, trailing and repeated spaces are
 * legitimate characters in a passphrase.
 */
function rawText(form: FormData, field: string): string {
  const value = form.get(field);
  return typeof value === 'string' ? value : '';
}

function checkbox(form: FormData, field: string): boolean {
  return form.get(field) !== null;
}

/** Validate the profile form. */
export function validateProfile(form: FormData): ValidationResult<Omit<Profile, 'updatedAt'>> {
  const errors: Record<string, string> = {};

  const name = text(form, 'name');
  if (name === '') errors.name = 'Name is required.';
  else if (name.length > LIMITS.name) errors.name = `Name must be ${LIMITS.name} characters or fewer.`;

  const dateOfBirth = text(form, 'dateOfBirth');
  if (dateOfBirth === '') {
    errors.dateOfBirth = 'Date of birth is required.';
  } else {
    try {
      // Reuse the calculator's own parser so the two can never disagree about
      // what counts as a valid date.
      calculateSchoolYear(dateOfBirth);
    } catch (error) {
      errors.dateOfBirth =
        error instanceof InvalidDateOfBirthError
          ? 'Enter a valid date of birth.'
          : 'Date of birth could not be interpreted.';
    }
  }

  const house = text(form, 'house');
  if (house.length > LIMITS.house) errors.house = `House must be ${LIMITS.house} characters or fewer.`;

  const school = text(form, 'school');
  if (school.length > LIMITS.school)
    errors.school = `School must be ${LIMITS.school} characters or fewer.`;

  const subtitle = text(form, 'subtitle');
  if (subtitle.length > LIMITS.subtitle)
    errors.subtitle = `Subtitle must be ${LIMITS.subtitle} characters or fewer.`;

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    errors: {},
    value: {
      name,
      dateOfBirth,
      house,
      school,
      subtitle,
      showHouse: checkbox(form, 'showHouse'),
      showYear: checkbox(form, 'showYear'),
      showSchool: checkbox(form, 'showSchool'),
      showSubtitle: checkbox(form, 'showSubtitle'),
    },
  };
}

/** Normalise an ISBN to digits and a trailing X, or null if unusable. */
export function normaliseIsbn(value: string): string | null {
  const cleaned = value.replace(/[^0-9Xx]/g, '').toUpperCase();
  if (cleaned.length !== 10 && cleaned.length !== 13) return null;
  return cleaned;
}

/** Validate the book form, used for both manual entry and search selection. */
export function validateBook(form: FormData): ValidationResult<Omit<Book, 'updatedAt'>> {
  const errors: Record<string, string> = {};

  const title = text(form, 'title');
  if (title === '') errors.title = 'Title is required.';
  else if (title.length > LIMITS.title)
    errors.title = `Title must be ${LIMITS.title} characters or fewer.`;

  const author = text(form, 'author');
  if (author.length > LIMITS.author)
    errors.author = `Author must be ${LIMITS.author} characters or fewer.`;

  const rawIsbn = text(form, 'isbn');
  const isbn = rawIsbn === '' ? null : normaliseIsbn(rawIsbn);
  if (rawIsbn !== '' && isbn === null) {
    errors.isbn = 'Enter a 10 or 13 digit ISBN, or leave it blank.';
  }

  const rawYear = text(form, 'publicationYear');
  let publicationYear: number | null = null;
  if (rawYear !== '') {
    const parsed = Number.parseInt(rawYear, 10);
    const thisYear = new Date().getUTCFullYear();
    if (!Number.isFinite(parsed) || parsed < 1000 || parsed > thisYear + 2) {
      errors.publicationYear = 'Enter a four digit year, or leave it blank.';
    } else {
      publicationYear = parsed;
    }
  }

  // Rejected rather than silently dropped, so a mistyped URL is visible.
  const rawCover = text(form, 'coverUrl');
  const coverUrl = rawCover === '' ? null : safeHttpUrl(rawCover);
  if (rawCover !== '' && coverUrl === null) {
    errors.coverUrl = 'Cover URL must be a valid http or https address.';
  }

  const rawSource = text(form, 'source');
  const source =
    rawSource === 'google-books' || rawSource === 'open-library' ? rawSource : 'manual';

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    errors: {},
    value: { title, author, coverUrl, isbn, publicationYear, source },
  };
}

/** Validate a book search query. */
export function validateSearchQuery(raw: string | null): ValidationResult<string> {
  const query = normaliseWhitespace(raw ?? '');

  if (query === '') {
    return { ok: false, errors: { query: 'Enter a title, author or ISBN to search for.' } };
  }
  if (query.length > LIMITS.query) {
    return { ok: false, errors: { query: `Search must be ${LIMITS.query} characters or fewer.` } };
  }
  return { ok: true, errors: {}, value: query };
}

/** Largest logo upload accepted, in bytes. */
export const MAX_LOGO_BYTES = 1_500_000;

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] as const;

export interface ValidatedUpload {
  contentType: string;
  bytes: ArrayBuffer;
}

/**
 * Validate an uploaded image.
 *
 * The content type is checked against the file's magic bytes rather than the
 * browser-supplied type, because that header is attacker-controlled and we go
 * on to serve these bytes back with a Content-Type of our own.
 */
export async function validateImageUpload(file: unknown): Promise<ValidationResult<ValidatedUpload>> {
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, errors: { logo: 'Choose an image file to upload.' } };
  }

  if (file.size > MAX_LOGO_BYTES) {
    const mb = (MAX_LOGO_BYTES / 1_000_000).toFixed(1);
    return { ok: false, errors: { logo: `Image must be smaller than ${mb}MB.` } };
  }

  const bytes = await file.arrayBuffer();
  const detected = detectImageType(new Uint8Array(bytes));

  if (detected === null) {
    return {
      ok: false,
      errors: { logo: 'That file is not a PNG, JPEG, GIF or WebP image.' },
    };
  }

  return { ok: true, errors: {}, value: { contentType: detected, bytes } };
}

/** Identify an image format from its leading bytes. */
export function detectImageType(bytes: Uint8Array): string | null {
  const startsWith = (...signature: number[]): boolean =>
    signature.every((byte, index) => bytes[index] === byte);

  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
  if (startsWith(0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (startsWith(0x47, 0x49, 0x46, 0x38)) return 'image/gif';

  // WebP is "RIFF" .... "WEBP".
  if (
    startsWith(0x52, 0x49, 0x46, 0x46) &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }

  return null;
}

export function isAllowedImageType(contentType: string): boolean {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(contentType);
}


// --- Registration --------------------------------------------------------

export interface RegistrationInput {
  username: string;
  slug: string;
  password: string;
  name: string;
  dateOfBirth: string;
}

/** Path segments that must never become a person's signature address. */
const RESERVED_SLUGS = new Set([
  'admin', 'api', 'assets', 'signature', 'login', 'logout', 'register',
  'signup', 'static', 'js', 'css', 'robots', 'favicon', 'well-known', 'new',
  'account', 'settings', 'help', 'about', 'support', 'root', 'system',
]);

/** Turn a username into a candidate URL slug. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug);
}

/**
 * Validate a registration form.
 *
 * Password length is the only strength rule. Composition rules (a digit, a
 * symbol) push people towards predictable substitutions without adding much
 * entropy, whereas length reliably does, and logins are rate limited anyway.
 */
export function validateRegistration(form: FormData): ValidationResult<RegistrationInput> {
  const errors: Record<string, string> = {};

  const username = text(form, 'username');
  if (username === '') {
    errors.username = 'Choose a username.';
  } else if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,31}$/.test(username)) {
    errors.username =
      'Use 3 to 32 characters: letters, numbers, full stops, hyphens or underscores.';
  }

  const slugSource = text(form, 'slug') || username;
  const slug = slugify(slugSource);
  if (slug === '') {
    errors.slug = 'Choose a web address made of letters and numbers.';
  } else if (slug.length < 3) {
    errors.slug = 'The web address must be at least 3 characters.';
  } else if (isReservedSlug(slug)) {
    errors.slug = 'That web address is reserved. Please choose another.';
  }

  const password = rawText(form, 'password');
  if (password.length < 12) {
    errors.password = 'Use at least 12 characters. A few random words works well.';
  } else if (password.length > 200) {
    errors.password = 'That password is unreasonably long.';
  }

  const confirm = rawText(form, 'confirm');
  if (confirm !== password) {
    errors.confirm = 'The two passwords do not match.';
  }

  const name = text(form, 'name');
  if (name === '') errors.name = 'Enter the name to show in your signature.';
  else if (name.length > LIMITS.name) errors.name = `Name must be ${LIMITS.name} characters or fewer.`;

  const dateOfBirth = text(form, 'dateOfBirth');
  if (dateOfBirth === '') {
    errors.dateOfBirth = 'Enter your date of birth so your year group can be worked out.';
  } else {
    try {
      calculateSchoolYear(dateOfBirth);
    } catch {
      errors.dateOfBirth = 'Enter a valid date of birth.';
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return { ok: true, errors: {}, value: { username, slug, password, name, dateOfBirth } };
}
