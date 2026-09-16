/** Types shared between the Worker and the admin dashboard. */

export interface Profile {
  name: string;
  dateOfBirth: string; // ISO YYYY-MM-DD
  house: string;
  school: string;
  subtitle: string;
  showHouse: boolean;
  showYear: boolean;
  showSchool: boolean;
  showSubtitle: boolean;
  updatedAt: string;
}

export interface Book {
  title: string;
  author: string;
  coverUrl: string | null;
  isbn: string | null;
  publicationYear: number | null;
  source: BookSource;
  updatedAt: string;
}

export type BookSource = 'google-books' | 'open-library' | 'manual';

/** A candidate returned by a book search, before it is made current. */
export interface BookSearchResult {
  /** Stable within a single result set; used as a list key and selection token. */
  id: string;
  title: string;
  author: string;
  coverUrl: string | null;
  isbn: string | null;
  publicationYear: number | null;
  source: BookSource;
}

/** The read model behind both the dashboard and the public signature. */
export interface SignatureData {
  profile: Profile;
  book: Book | null;
  year: {
    label: string;
    yearGroup: number;
    academicYearLabel: string;
    status: string;
  };
  /** Increments whenever the profile or book changes; used for cache busting. */
  revision: number;
}

export interface ApiError {
  error: string;
  /** Present when validation failed, keyed by field name. */
  fields?: Record<string, string>;
}

export interface SessionInfo {
  authenticated: boolean;
  username: string | null;
  csrfToken: string | null;
}
