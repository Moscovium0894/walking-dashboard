/**
 * UK (England) school-year calculation.
 *
 * The year group is NOT derived from age. A pupil's year group is fixed by the
 * cohort they were born into, and that cohort is defined by the 1 September
 * boundary, so two pupils of identical age can sit in different year groups.
 *
 * The rules, stated precisely:
 *
 *   1. A pupil born between 1 September of year Y and 31 August of year Y+1
 *      belongs to the cohort labelled Y. Call this the *cohort start*.
 *   2. That cohort begins Reception in the academic year starting
 *      September (Y + RECEPTION_OFFSET) - they turn 5 during that year.
 *   3. Each subsequent academic year advances the group by one.
 *
 * Therefore:
 *
 *   yearGroup = academicYearStart - cohortStart - receptionOffset
 *
 * where Reception is 0, Year 1 is 1, and so on.
 *
 * Worked example (the default profile):
 *
 *   DOB 31 January 2012  -> the 1 September on or before it is 1 Sept 2011,
 *                           so cohortStart = 2011.
 *   On 1 September 2026  -> academicYearStart = 2026.
 *   yearGroup            -> 2026 - 2011 - 5 = 10, i.e. Year 10.
 *
 * Everything that encodes policy lives in SchoolYearConfig below, so if the
 * school-year system ever changes, change the config rather than the maths.
 */

/** Policy knobs. Change these, not the arithmetic, if the system changes. */
export interface SchoolYearConfig {
  /** Month of the academic-year boundary, 1-indexed. England uses September. */
  readonly cutoffMonth: number;
  /** Day of month of the academic-year boundary. England uses the 1st. */
  readonly cutoffDay: number;
  /**
   * Academic years between a cohort's label and the year it enters Reception.
   * England: a child born in cohort Y starts Reception in September Y+5.
   */
  readonly receptionOffset: number;
  /** Lowest year group treated as "at school". 0 = Reception. */
  readonly minYearGroup: number;
  /** Highest year group treated as "at school". 13 = upper sixth. */
  readonly maxYearGroup: number;
}

export const ENGLAND_SCHOOL_YEAR_CONFIG: SchoolYearConfig = {
  cutoffMonth: 9,
  cutoffDay: 1,
  receptionOffset: 5,
  minYearGroup: 0,
  maxYearGroup: 13,
};

/** Where a pupil sits relative to compulsory schooling. */
export type SchoolYearStatus = 'before-school' | 'at-school' | 'left-school';

export interface SchoolYearResult {
  /** Reception is 0, Year 1 is 1 ... Year 13 is 13. May fall outside that range. */
  readonly yearGroup: number;
  /** Calendar year in which the current academic year began. */
  readonly academicYearStart: number;
  /** Human label for the academic year, e.g. "2026/27". */
  readonly academicYearLabel: string;
  /** The 1-September cohort the date of birth falls into. */
  readonly cohortStart: number;
  readonly status: SchoolYearStatus;
  /** Display string: "Year 10", "Reception", "Pre-school", "Left school". */
  readonly label: string;
}

/** Thrown when a date of birth cannot be interpreted. */
export class InvalidDateOfBirthError extends Error {
  constructor(value: string) {
    super(`Invalid date of birth: ${JSON.stringify(value)}`);
    this.name = 'InvalidDateOfBirthError';
  }
}

/**
 * Parse an ISO `YYYY-MM-DD` date into UTC calendar parts.
 *
 * Deliberately strict and timezone-free: we compare calendar dates, never
 * instants, so a pupil's year group cannot flip because of a server's offset.
 */
function parseIsoDate(value: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) throw new InvalidDateOfBirthError(value);

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw new InvalidDateOfBirthError(value);
  }

  // Reject dates that do not exist, e.g. 2011-02-30 or 2013-02-29.
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    throw new InvalidDateOfBirthError(value);
  }

  return { year, month, day };
}

/**
 * The calendar year in which the academic year containing `date` began.
 *
 * On or after 1 September this is the current calendar year; before it, the
 * previous one. 31 August and 1 September therefore land in different academic
 * years, which is the whole point of the cutoff.
 */
function academicYearStartFor(
  month: number,
  day: number,
  year: number,
  config: SchoolYearConfig,
): number {
  const onOrAfterCutoff =
    month > config.cutoffMonth || (month === config.cutoffMonth && day >= config.cutoffDay);
  return onOrAfterCutoff ? year : year - 1;
}

function formatAcademicYear(start: number): string {
  const end = (start + 1) % 100;
  return `${start}/${end.toString().padStart(2, '0')}`;
}

function labelFor(yearGroup: number, status: SchoolYearStatus): string {
  if (status === 'before-school') return 'Pre-school';
  if (status === 'left-school') return 'Left school';
  return yearGroup === 0 ? 'Reception' : `Year ${yearGroup}`;
}

/**
 * Calculate the school year group for a date of birth, as at a given date.
 *
 * @param dateOfBirth ISO `YYYY-MM-DD`.
 * @param asOf        The date to evaluate against. Defaults to now.
 * @param config      Policy overrides. Defaults to the England rules.
 */
export function calculateSchoolYear(
  dateOfBirth: string,
  asOf: Date = new Date(),
  config: SchoolYearConfig = ENGLAND_SCHOOL_YEAR_CONFIG,
): SchoolYearResult {
  const dob = parseIsoDate(dateOfBirth);

  if (Number.isNaN(asOf.getTime())) {
    throw new TypeError('asOf must be a valid Date');
  }

  // The cohort a birth date belongs to is the academic year it falls inside.
  const cohortStart = academicYearStartFor(dob.month, dob.day, dob.year, config);

  const academicYearStart = academicYearStartFor(
    asOf.getUTCMonth() + 1,
    asOf.getUTCDate(),
    asOf.getUTCFullYear(),
    config,
  );

  const yearGroup = academicYearStart - cohortStart - config.receptionOffset;

  const status: SchoolYearStatus =
    yearGroup < config.minYearGroup
      ? 'before-school'
      : yearGroup > config.maxYearGroup
        ? 'left-school'
        : 'at-school';

  return {
    yearGroup,
    academicYearStart,
    academicYearLabel: formatAcademicYear(academicYearStart),
    cohortStart,
    status,
    label: labelFor(yearGroup, status),
  };
}

/** Convenience wrapper returning just the display label, e.g. "Year 10". */
export function schoolYearLabel(
  dateOfBirth: string,
  asOf: Date = new Date(),
  config: SchoolYearConfig = ENGLAND_SCHOOL_YEAR_CONFIG,
): string {
  return calculateSchoolYear(dateOfBirth, asOf, config).label;
}
