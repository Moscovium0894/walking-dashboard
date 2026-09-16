import { describe, expect, it } from 'vitest';
import {
  ENGLAND_SCHOOL_YEAR_CONFIG,
  InvalidDateOfBirthError,
  calculateSchoolYear,
  schoolYearLabel,
  type SchoolYearConfig,
} from '../src/shared/schoolYear';

/** Build a UTC date without timezone ambiguity. */
const utc = (y: number, m: number, d: number): Date => new Date(Date.UTC(y, m - 1, d));

/** The default profile's date of birth: 31 January 2012. */
const OTTO = '2012-01-31';

describe('calculateSchoolYear - the specified example', () => {
  it('puts DOB 31/01/2012 in Year 10 in September 2026', () => {
    const result = calculateSchoolYear(OTTO, utc(2026, 9, 1));
    expect(result.yearGroup).toBe(10);
    expect(result.label).toBe('Year 10');
  });

  it('reports the cohort and academic year behind that answer', () => {
    const result = calculateSchoolYear(OTTO, utc(2026, 9, 1));
    // Born Jan 2012, so the 1 Sept on or before is 1 Sept 2011.
    expect(result.cohortStart).toBe(2011);
    expect(result.academicYearStart).toBe(2026);
    expect(result.academicYearLabel).toBe('2026/27');
    expect(result.status).toBe('at-school');
  });

  it('holds Year 10 for the whole of the 2026/27 academic year', () => {
    for (const date of [utc(2026, 9, 1), utc(2026, 12, 25), utc(2027, 1, 31), utc(2027, 8, 31)]) {
      expect(calculateSchoolYear(OTTO, date).yearGroup).toBe(10);
    }
  });
});

describe('the 31 August / 1 September boundary', () => {
  it('is still Year 9 on 31 August 2026', () => {
    expect(schoolYearLabel(OTTO, utc(2026, 8, 31))).toBe('Year 9');
  });

  it('becomes Year 10 on 1 September 2026', () => {
    expect(schoolYearLabel(OTTO, utc(2026, 9, 1))).toBe('Year 10');
  });

  it('advances by exactly one group across the boundary', () => {
    const before = calculateSchoolYear(OTTO, utc(2026, 8, 31)).yearGroup;
    const after = calculateSchoolYear(OTTO, utc(2026, 9, 1)).yearGroup;
    expect(after - before).toBe(1);
  });

  it('does not advance on the pupil\'s birthday', () => {
    const dayBefore = calculateSchoolYear(OTTO, utc(2027, 1, 30)).yearGroup;
    const birthday = calculateSchoolYear(OTTO, utc(2027, 1, 31)).yearGroup;
    expect(birthday).toBe(dayBefore);
  });
});

describe('birth dates either side of the cutoff', () => {
  // Two pupils born a single day apart sit a full year group apart.
  it('places 31 August 2012 a year ahead of 1 September 2012', () => {
    const asOf = utc(2026, 9, 1);
    const august = calculateSchoolYear('2012-08-31', asOf);
    const september = calculateSchoolYear('2012-09-01', asOf);

    expect(august.cohortStart).toBe(2011);
    expect(september.cohortStart).toBe(2012);
    expect(august.yearGroup - september.yearGroup).toBe(1);
    expect(august.label).toBe('Year 10');
    expect(september.label).toBe('Year 9');
  });

  it('treats a birthday before September as the same cohort as the January DOB', () => {
    const asOf = utc(2026, 9, 1);
    expect(calculateSchoolYear('2012-01-31', asOf).cohortStart).toBe(2011);
    expect(calculateSchoolYear('2012-05-15', asOf).cohortStart).toBe(2011);
    expect(calculateSchoolYear('2011-09-01', asOf).cohortStart).toBe(2011);
  });

  it('treats a birthday after September as the following cohort', () => {
    const asOf = utc(2026, 9, 1);
    expect(calculateSchoolYear('2012-09-01', asOf).cohortStart).toBe(2012);
    expect(calculateSchoolYear('2012-12-25', asOf).cohortStart).toBe(2012);
    expect(calculateSchoolYear('2013-08-31', asOf).cohortStart).toBe(2012);
  });
});

describe('progression through school', () => {
  it('walks Reception to Year 13 for the default profile', () => {
    // Cohort 2011 enters Reception in September 2016.
    const expected: Array<[number, string]> = [
      [2016, 'Reception'],
      [2017, 'Year 1'],
      [2021, 'Year 5'],
      [2025, 'Year 9'],
      [2026, 'Year 10'],
      [2027, 'Year 11'],
      [2028, 'Year 12'],
      [2029, 'Year 13'],
    ];

    for (const [septemberOf, label] of expected) {
      expect(schoolYearLabel(OTTO, utc(septemberOf, 9, 1))).toBe(label);
    }
  });

  it('advances exactly once per academic year with no gaps or repeats', () => {
    const groups = [];
    for (let year = 2016; year <= 2029; year += 1) {
      groups.push(calculateSchoolYear(OTTO, utc(year, 10, 1)).yearGroup);
    }
    expect(groups).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  });
});

describe('outside compulsory schooling', () => {
  it('reports pre-school before Reception', () => {
    const result = calculateSchoolYear(OTTO, utc(2015, 9, 1));
    expect(result.status).toBe('before-school');
    expect(result.label).toBe('Pre-school');
    expect(result.yearGroup).toBeLessThan(0);
  });

  it('reports left school after Year 13', () => {
    const result = calculateSchoolYear(OTTO, utc(2030, 9, 1));
    expect(result.status).toBe('left-school');
    expect(result.label).toBe('Left school');
    expect(result.yearGroup).toBe(14);
  });

  it('still reports Year 13 on the last day of the final year', () => {
    expect(schoolYearLabel(OTTO, utc(2030, 8, 31))).toBe('Year 13');
  });
});

describe('it is not age arithmetic', () => {
  // The trap this guards against: age on 1 September does not determine the
  // year group, because the cohort boundary and the birthday are unrelated.
  it('gives two pupils of the same age different year groups', () => {
    const asOf = utc(2026, 9, 1);
    const older = calculateSchoolYear('2012-08-31', asOf); // age 14
    const younger = calculateSchoolYear('2012-09-01', asOf); // age 14 the next day
    expect(older.yearGroup).not.toBe(younger.yearGroup);
  });

  it('gives two pupils of different ages the same year group', () => {
    const asOf = utc(2026, 9, 1);
    const autumn = calculateSchoolYear('2011-09-01', asOf); // age 15
    const summer = calculateSchoolYear('2012-08-31', asOf); // age 14
    expect(autumn.yearGroup).toBe(summer.yearGroup);
    expect(autumn.label).toBe('Year 10');
  });
});

describe('leap years', () => {
  it('accepts 29 February in a leap year', () => {
    expect(() => calculateSchoolYear('2012-02-29', utc(2026, 9, 1))).not.toThrow();
    expect(schoolYearLabel('2012-02-29', utc(2026, 9, 1))).toBe('Year 10');
  });

  it('rejects 29 February in a non-leap year', () => {
    expect(() => calculateSchoolYear('2013-02-29')).toThrow(InvalidDateOfBirthError);
  });

  it('is unaffected by a leap day falling inside the academic year', () => {
    expect(schoolYearLabel(OTTO, utc(2028, 2, 29))).toBe('Year 11');
  });
});

describe('input validation', () => {
  it.each(['', '31/01/2012', '2012-1-31', '2012-13-01', '2012-00-10', '2012-02-30', 'yesterday'])(
    'rejects %j',
    (value) => {
      expect(() => calculateSchoolYear(value)).toThrow(InvalidDateOfBirthError);
    },
  );

  it('tolerates surrounding whitespace', () => {
    expect(schoolYearLabel('  2012-01-31  ', utc(2026, 9, 1))).toBe('Year 10');
  });

  it('rejects an invalid asOf date', () => {
    expect(() => calculateSchoolYear(OTTO, new Date('nonsense'))).toThrow(TypeError);
  });
});

describe('configurability', () => {
  it('honours a different cutoff date', () => {
    // A system with a 1 August boundary moves the September DOB into the
    // earlier cohort, putting that pupil a year further on.
    const augustCutoff: SchoolYearConfig = { ...ENGLAND_SCHOOL_YEAR_CONFIG, cutoffMonth: 8 };
    const asOf = utc(2026, 9, 1);
    expect(calculateSchoolYear('2012-08-31', asOf, augustCutoff).cohortStart).toBe(2012);
    expect(calculateSchoolYear('2012-08-31', asOf, augustCutoff).label).toBe('Year 9');
  });

  it('honours a different reception offset', () => {
    const startAtSix: SchoolYearConfig = { ...ENGLAND_SCHOOL_YEAR_CONFIG, receptionOffset: 6 };
    expect(calculateSchoolYear(OTTO, utc(2026, 9, 1), startAtSix).yearGroup).toBe(9);
  });

  it('honours a different final year', () => {
    const endsAtEleven: SchoolYearConfig = { ...ENGLAND_SCHOOL_YEAR_CONFIG, maxYearGroup: 11 };
    expect(calculateSchoolYear(OTTO, utc(2028, 9, 1), endsAtEleven).status).toBe('left-school');
  });
});

describe('timezone independence', () => {
  it('does not shift the year group across a UTC day boundary', () => {
    // Late on 31 August UTC is still the old academic year, wherever the
    // server happens to be.
    const lateAugust = new Date('2026-08-31T23:59:59Z');
    const earlySeptember = new Date('2026-09-01T00:00:01Z');
    expect(schoolYearLabel(OTTO, lateAugust)).toBe('Year 9');
    expect(schoolYearLabel(OTTO, earlySeptember)).toBe('Year 10');
  });
});
