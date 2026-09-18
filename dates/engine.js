// Pregnancy date arithmetic only. No diagnosis, no advice.
// All dates are plain calendar days in UTC to avoid time zone drift.

export function parseDay(input) {
  const text = String(input).trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error('Use a date like 2024-02-29.');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) throw new Error('Month must be 01 to 12.');
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`${text} is not a real calendar date.`);
  }
  if (year < 1900 || year > 2100) throw new Error('Enter a year from 1900 to 2100.');
  return date;
}

export function formatDay(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(date, days) {
  if (!Number.isInteger(days) || Math.abs(days) > 3000) {
    throw new Error('Day offset must be a whole number within 3000.');
  }
  const out = new Date(date.getTime());
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

export function diffDays(from, to) {
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

function checkCycle(cycle) {
  const value = Number(cycle);
  if (!Number.isInteger(value) || value < 15 || value > 60) {
    throw new Error('Enter a cycle length from 15 to 60 days.');
  }
  return value;
}

// Naegele rule: due date = first day of last period + 280 days.
export function dueDate(lmpInput) {
  const lmp = lmpInput instanceof Date ? lmpInput : parseDay(lmpInput);
  return addDays(lmp, 280);
}

// Conception estimate for a 28 day cycle: about 14 days after LMP,
// which is also 266 days before the due date.
export function conceptionEstimate(lmpInput) {
  const lmp = lmpInput instanceof Date ? lmpInput : parseDay(lmpInput);
  return addDays(lmp, 14);
}

export function conceptionFromDue(dueInput) {
  const due = dueInput instanceof Date ? dueInput : parseDay(dueInput);
  return addDays(due, -266);
}

export function gestationalAge(lmpInput, onInput) {
  const lmp = lmpInput instanceof Date ? lmpInput : parseDay(lmpInput);
  const on = onInput instanceof Date ? onInput : parseDay(onInput);
  const totalDays = diffDays(lmp, on);
  if (totalDays < 0) throw new Error('The date is before the last period date.');
  if (totalDays > 320) throw new Error('That date is more than 320 days past the last period.');
  const weeks = Math.floor(totalDays / 7);
  const days = totalDays % 7;
  return { weeks, days, totalDays, weekNumber: weeks + 1 };
}

// First trimester: weeks 1 to 13. Second: weeks 14 to 27. Third: week 28 on.
export function trimesterForWeek(weekNumber) {
  const week = Number(weekNumber);
  if (!Number.isInteger(week) || week < 1 || week > 46) {
    throw new Error('Enter a week number from 1 to 46.');
  }
  if (week <= 13) return 1;
  if (week <= 27) return 2;
  return 3;
}

export function trimesterForDays(totalDays) {
  if (!Number.isInteger(totalDays) || totalDays < 0 || totalDays > 320) {
    throw new Error('Enter days from 0 to 320.');
  }
  if (totalDays <= 97) return 1; // through 13w6d
  if (totalDays <= 195) return 2; // 14w0d through 27w6d
  return 3; // 28w0d on
}

export function trimesterRanges(lmpInput) {
  const lmp = lmpInput instanceof Date ? lmpInput : parseDay(lmpInput);
  return {
    first: { start: formatDay(lmp), end: formatDay(addDays(lmp, 97)) },
    second: { start: formatDay(addDays(lmp, 98)), end: formatDay(addDays(lmp, 195)) },
    third: { start: formatDay(addDays(lmp, 196)), end: formatDay(addDays(lmp, 280)) }
  };
}

// Ovulation day = cycle length minus 14, counted from LMP.
// Fertile window covers 5 days before through 1 day after ovulation.
export function fertileWindow(lmpInput, cycleLength) {
  const lmp = lmpInput instanceof Date ? lmpInput : parseDay(lmpInput);
  const cycle = checkCycle(cycleLength);
  const ovulation = addDays(lmp, cycle - 14);
  return {
    ovulation: formatDay(ovulation),
    fertileStart: formatDay(addDays(ovulation, -5)),
    fertileEnd: formatDay(addDays(ovulation, 1)),
    cycle
  };
}

export function nextPeriod(lmpInput, cycleLength) {
  const lmp = lmpInput instanceof Date ? lmpInput : parseDay(lmpInput);
  const cycle = checkCycle(cycleLength);
  return formatDay(addDays(lmp, cycle));
}
