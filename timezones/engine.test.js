import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bestOverlap, CITIES, decodeShare, encodeShare, formatOffset, isValidZone,
  meetingTable, overlapScore
} from './engine.js';

test('city list holds 24 entries with valid IANA zones', () => {
  assert.equal(CITIES.length, 24);
  const zones = new Set(CITIES.map(city => city.zone));
  assert.equal(zones.size, 24);
  for (const city of CITIES) {
    assert.equal(isValidZone(city.zone), true);
  }
});

test('offset formatting covers whole, half, and negative offsets', () => {
  assert.equal(formatOffset(0), 'UTC+00:00');
  assert.equal(formatOffset(-300), 'UTC-05:00');
  assert.equal(formatOffset(330), 'UTC+05:30');
  assert.equal(formatOffset(345), 'UTC+05:45');
  assert.equal(formatOffset(-210), 'UTC-03:30');
});

test('DST boundary: New York shifts from UTC-5 to UTC-4 on 2026-03-08', () => {
  // Spring forward at 2:00 local on 2026-03-08.
  const before = meetingTable(new Date('2026-03-08T06:59:00Z'), ['America/New_York'])[0];
  const after = meetingTable(new Date('2026-03-08T07:01:00Z'), ['America/New_York'])[0];
  assert.equal(before.offsetLabel, 'UTC-05:00');
  assert.equal(after.offsetLabel, 'UTC-04:00');
});

test('fixed instant: 2026-01-15 15:00 UTC reads 10:00 in New York and 16:00 in Berlin', () => {
  const rows = meetingTable(new Date('2026-01-15T15:00:00Z'), ['America/New_York', 'Europe/Berlin']);
  const york = rows.find(row => row.zone === 'America/New_York');
  const berlin = rows.find(row => row.zone === 'Europe/Berlin');
  assert.equal(york.time, '10:00');
  assert.equal(york.offsetLabel, 'UTC-05:00');
  assert.equal(berlin.time, '16:00'); // Berlin is UTC+1 in January
  assert.equal(berlin.offsetLabel, 'UTC+01:00');
});

test('Mumbai half hour offset reads UTC+05:30', () => {
  const rows = meetingTable(new Date('2026-01-15T15:00:00Z'), ['Asia/Kolkata']);
  assert.equal(rows[0].offsetLabel, 'UTC+05:30');
  assert.equal(rows[0].time, '20:30');
});

test('overlap logic: 9 to 17 local counts, edges excluded at 17:00', () => {
  const rows = meetingTable(new Date('2026-01-15T14:00:00Z'), ['America/New_York', 'Europe/London', 'Asia/Tokyo']);
  // 09:00 New York in, 14:00 London in, 23:00 Tokyo out.
  const byZone = Object.fromEntries(rows.map(row => [row.zone, row.inWorkHours]));
  assert.equal(byZone['America/New_York'], true);
  assert.equal(byZone['Europe/London'], true);
  assert.equal(byZone['Asia/Tokyo'], false);
  assert.equal(overlapScore(new Date('2026-01-15T14:00:00Z'), ['America/New_York', 'Europe/London', 'Asia/Tokyo']), 2);
});

test('best overlap picks the candidate with the highest in-hours count', () => {
  const zones = ['America/New_York', 'Europe/London'];
  const early = new Date('2026-01-15T02:00:00Z'); // 21:00 NY prev day, 02:00 London
  const mid = new Date('2026-01-15T14:00:00Z'); // 09:00 NY, 14:00 London
  const best = bestOverlap([early, mid], zones);
  assert.equal(best.instant.getTime(), mid.getTime());
  assert.equal(best.score, 2);
});

test('share hash round trip keeps date, time, and zones', () => {
  const state = { date: '2026-04-02', time: '14:30', zones: ['America/New_York', 'Asia/Tokyo'] };
  const hash = encodeShare(state);
  assert.ok(!hash.includes('+') && !hash.includes('/') && !hash.includes('='));
  const back = decodeShare(`#${hash}`);
  assert.deepEqual(back, state);
});

test('invalid zone falls back to UTC and is flagged', () => {
  const rows = meetingTable(new Date('2026-01-15T15:00:00Z'), ['Not/AZone']);
  assert.equal(rows[0].fallback, true);
  assert.equal(rows[0].offsetLabel, 'UTC+00:00');
  assert.equal(isValidZone('Not/AZone'), false);
});

test('bad inputs are rejected', () => {
  assert.throws(() => meetingTable(new Date('nope'), ['America/New_York']));
  assert.throws(() => meetingTable(new Date(), []));
  assert.throws(() => bestOverlap([], ['America/New_York']));
  assert.throws(() => decodeShare('#!!!'));
  assert.throws(() => decodeShare(''));
});
