import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays, conceptionEstimate, conceptionFromDue, diffDays, dueDate, fertileWindow,
  formatDay, gestationalAge, nextPeriod, parseDay, trimesterForDays, trimesterForWeek,
  trimesterRanges
} from './engine.js';

test('Naegele rule: LMP 2024-01-01 gives due date 2024-10-07', () => {
  assert.equal(formatDay(dueDate('2024-01-01')), '2024-10-07');
});

test('leap day LMP 2024-02-29 gives due date 2024-12-05', () => {
  // Feb 29 + 280 days crosses a leap year: check by day count.
  const due = dueDate('2024-02-29');
  assert.equal(formatDay(due), '2024-12-05');
  assert.equal(diffDays(parseDay('2024-02-29'), due), 280);
});

test('year boundary: LMP 2023-12-01 gives due date 2024-09-06', () => {
  assert.equal(formatDay(dueDate('2023-12-01')), '2024-09-06');
});

test('conception estimate is LMP + 14 days, and 266 days before due date', () => {
  assert.equal(formatDay(conceptionEstimate('2024-01-01')), '2024-01-15');
  assert.equal(formatDay(conceptionFromDue('2024-10-07')), '2024-01-15');
  const lmp = parseDay('2024-02-29');
  assert.equal(diffDays(lmp, conceptionEstimate(lmp)), 14);
  assert.equal(diffDays(conceptionEstimate(lmp), dueDate(lmp)), 266);
});

test('gestational age: 2024-01-01 to 2024-03-01 is 8 weeks and 4 days', () => {
  // Jan 1 to Mar 1 2024 is 60 days = 8 full weeks + 4 days.
  const age = gestationalAge('2024-01-01', '2024-03-01');
  assert.equal(age.totalDays, 60);
  assert.equal(age.weeks, 8);
  assert.equal(age.days, 4);
  assert.equal(age.weekNumber, 9);
});

test('week number starts at 1 on the LMP date', () => {
  const age = gestationalAge('2024-01-01', '2024-01-01');
  assert.deepEqual(age, { weeks: 0, days: 0, totalDays: 0, weekNumber: 1 });
});

test('trimester cutoffs: week 13 in first, 14 in second, 27 in second, 28 in third', () => {
  assert.equal(trimesterForWeek(1), 1);
  assert.equal(trimesterForWeek(13), 1);
  assert.equal(trimesterForWeek(14), 2);
  assert.equal(trimesterForWeek(27), 2);
  assert.equal(trimesterForWeek(28), 3);
  assert.equal(trimesterForDays(97), 1); // 13w6d
  assert.equal(trimesterForDays(98), 2); // 14w0d
  assert.equal(trimesterForDays(195), 2); // 27w6d
  assert.equal(trimesterForDays(196), 3); // 28w0d
});

test('trimester date ranges for LMP 2024-01-01', () => {
  const ranges = trimesterRanges('2024-01-01');
  assert.equal(ranges.first.start, '2024-01-01');
  assert.equal(ranges.first.end, '2024-04-07'); // +97 days
  assert.equal(ranges.second.start, '2024-04-08'); // +98 days
  assert.equal(ranges.second.end, '2024-07-14'); // +195 days
  assert.equal(ranges.third.start, '2024-07-15'); // +196 days
  assert.equal(ranges.third.end, '2024-10-07'); // +280 days
});

test('cycle 28: LMP 2024-01-01 ovulates Jan 15, fertile Jan 10 to Jan 16', () => {
  const window = fertileWindow('2024-01-01', 28);
  assert.equal(window.ovulation, '2024-01-15');
  assert.equal(window.fertileStart, '2024-01-10');
  assert.equal(window.fertileEnd, '2024-01-16');
  assert.equal(nextPeriod('2024-01-01', 28), '2024-01-29');
});

test('cycle 21: LMP 2024-01-01 ovulates Jan 8, fertile Jan 3 to Jan 9', () => {
  const window = fertileWindow('2024-01-01', 21);
  assert.equal(window.ovulation, '2024-01-08');
  assert.equal(window.fertileStart, '2024-01-03');
  assert.equal(window.fertileEnd, '2024-01-09');
  assert.equal(nextPeriod('2024-01-01', 21), '2024-01-22');
});

test('cycle 35: LMP 2024-01-01 ovulates Jan 22, fertile Jan 17 to Jan 23', () => {
  const window = fertileWindow('2024-01-01', 35);
  assert.equal(window.ovulation, '2024-01-22');
  assert.equal(window.fertileStart, '2024-01-17');
  assert.equal(window.fertileEnd, '2024-01-23');
  assert.equal(nextPeriod('2024-01-01', 35), '2024-02-05');
});

test('fertile window always spans 7 calendar days', () => {
  for (const cycle of [21, 28, 35]) {
    const window = fertileWindow('2024-05-10', cycle);
    assert.equal(diffDays(parseDay(window.fertileStart), parseDay(window.fertileEnd)), 6);
  }
});

test('invalid dates and cycles are rejected', () => {
  assert.throws(() => parseDay('2023-02-29')); // not a leap year
  assert.throws(() => parseDay('not-a-date'));
  assert.throws(() => parseDay('2024-13-01'));
  assert.throws(() => gestationalAge('2024-03-01', '2024-01-01'));
  assert.throws(() => fertileWindow('2024-01-01', 14));
  assert.throws(() => fertileWindow('2024-01-01', 61));
  assert.throws(() => nextPeriod('2024-01-01', 10));
  assert.throws(() => trimesterForWeek(0));
  assert.throws(() => addDays(parseDay('2024-01-01'), 3001));
});
