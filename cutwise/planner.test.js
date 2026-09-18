import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planCuts } from './planner.js';

test('assigns pieces to one board on an exact fit', () => {
  const result = planCuts(100, 0, [50, 50]);
  assert.equal(result.boards.length, 1);
  assert.equal(result.waste, 0);
  assert.equal(result.efficiency, 100);
});

test('accounts for kerf between pieces on the same board', () => {
  const result = planCuts(100, 2, [50, 50]);
  assert.equal(result.boards.length, 2);
});

test('a full-length piece leaves zero remaining on its board', () => {
  const result = planCuts(96, 0.125, [96]);
  assert.equal(result.boards.length, 1);
  assert.equal(result.boards[0].remaining, 0);
});

test('rejects empty and invalid piece lists', () => {
  assert.throws(() => planCuts(96, 0.125, []));
  assert.throws(() => planCuts(96, 0.125, [0]));
  assert.throws(() => planCuts(96, 0.125, [-5]));
  assert.throws(() => planCuts(96, 0.125, [200]));
  assert.throws(() => planCuts(0, 0.125, [10]));
  assert.throws(() => planCuts(96, -1, [10]));
  assert.throws(() => planCuts(Infinity, 0.125, [10]));
});

test('supports up to 500 pieces', () => {
  const result = planCuts(96, 0.125, Array(500).fill(12));
  const expected = Math.ceil(500 / 7);
  assert.equal(result.boards.length, expected);
});

test('rejects more than 500 pieces', () => {
  assert.throws(() => planCuts(96, 0.125, Array(501).fill(12)));
});

test('longest-first ordering packs short leftovers efficiently', () => {
  const result = planCuts(96, 0, [30, 30, 30, 36]);
  assert.equal(result.boards.length, 2);
  assert.equal(result.boards[0].pieces.length, 3);
});

test('layout math exposes kerf and leftover consistently', () => {
  const result = planCuts(96, 1, [40, 40]);
  assert.equal(result.boards.length, 1);
  assert.equal(result.boards[0].remaining, 15);
  assert.equal(result.used, 80);
  assert.equal(result.waste, 16);
  assert.equal(result.efficiency, (80 / 96) * 100);
});

test('board remaining equals stock minus pieces minus internal kerfs', () => {
  const result = planCuts(96, 0.125, [20, 20, 20]);
  assert.equal(result.boards[0].pieces.length, 3);
  assert.equal(Math.abs(result.boards[0].remaining - (96 - 60 - 2 * 0.125)) < 1e-9, true);
});
