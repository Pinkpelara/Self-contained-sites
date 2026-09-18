import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emi, firstYear, flatRateCompare, loanTotals, monthlyPayment, schedule, yearlyRollup
} from './engine.js';

test('known vector: $100,000 at 6 percent for 30 years is about $599.55', () => {
  const payment = monthlyPayment(100000, 6, 30);
  assert.ok(Math.abs(payment - 599.55) < 0.02, `got ${payment}`);
});

test('known vector: $10,000 at 5 percent for 5 years is about $188.71', () => {
  const payment = monthlyPayment(10000, 5, 5);
  assert.ok(Math.abs(payment - 188.71) < 0.02, `got ${payment}`);
});

test('EMI with months matches the yearly formula', () => {
  assert.ok(Math.abs(emi(100000, 6, 360) - monthlyPayment(100000, 6, 30)) < 1e-9);
  assert.ok(Math.abs(emi(12000, 12, 12) - 1066.19) < 0.02);
});

test('zero rate divides principal evenly', () => {
  assert.equal(monthlyPayment(12000, 0, 1), 1000);
  assert.equal(emi(6000, 0, 6), 1000);
  const totals = loanTotals(12000, 0, 1);
  assert.equal(totals.totalInterest, 0);
  assert.equal(totals.totalPaid, 12000);
});

test('totals hand check: 30 year vector pays about $115,838 in interest', () => {
  const totals = loanTotals(100000, 6, 30);
  assert.equal(totals.months, 360);
  assert.ok(Math.abs(totals.totalPaid - 599.55 * 360) < 8);
  assert.ok(Math.abs(totals.totalInterest - 115838) < 10, `got ${totals.totalInterest}`);
});

test('amortization principal sums back to the loan amount', () => {
  const result = schedule(100000, 6, 30);
  assert.equal(result.months, 360);
  const principalSum = result.rows.reduce((sum, row) => sum + row.principal, 0);
  assert.ok(Math.abs(principalSum - 100000) < 0.05);
  const interestSum = result.rows.reduce((sum, row) => sum + row.interest, 0);
  assert.ok(Math.abs(interestSum - result.totalInterest) < 0.05);
  assert.ok(result.rows.at(-1).balance < 0.01);
});

test('first payment splits about $500 interest and $99.55 principal', () => {
  const result = schedule(100000, 6, 30);
  const first = result.rows[0];
  assert.ok(Math.abs(first.interest - 500) < 0.01);
  assert.ok(Math.abs(first.principal - 99.55) < 0.05);
  assert.equal(firstYear(result).length, 12);
});

test('yearly rollup first row matches the first 12 schedule rows', () => {
  const result = schedule(12000, 5, 2);
  const rollup = yearlyRollup(result);
  const first12 = result.rows.slice(0, 12);
  const interest = first12.reduce((sum, row) => sum + row.interest, 0);
  const principal = first12.reduce((sum, row) => sum + row.principal, 0);
  assert.ok(Math.abs(rollup[0].interest - interest) < 1e-6);
  assert.ok(Math.abs(rollup[0].principal - principal) < 1e-6);
  const allPrincipal = rollup.reduce((sum, row) => sum + row.principal, 0);
  assert.ok(Math.abs(allPrincipal - 12000) < 0.05);
});

test('extra $200 a month shortens a 30 year loan by over 8 years', () => {
  const base = schedule(100000, 6, 30);
  const faster = schedule(100000, 6, 30, 200);
  assert.ok(faster.months < base.months - 96, `base ${base.months}, faster ${faster.months}`);
  assert.ok(faster.totalInterest < base.totalInterest - 20000);
});

test('flat rate compare: $10,000 at 5 percent flat for 5 years', () => {
  // Flat interest = 10000 * 0.05 * 5 = 2500. Monthly = 12500 / 60 = 208.33.
  const flat = flatRateCompare(10000, 5, 5);
  assert.equal(flat.totalInterest, 2500);
  assert.ok(Math.abs(flat.monthly - 208.33) < 0.01);
  // Reducing balance cost for the same loan is about $1322.74 in interest.
  const reducing = loanTotals(10000, 5, 5);
  assert.ok(reducing.totalInterest < flat.totalInterest);
});

test('invalid inputs are rejected', () => {
  assert.throws(() => monthlyPayment(0, 6, 30));
  assert.throws(() => monthlyPayment(100000, -1, 30));
  assert.throws(() => monthlyPayment(100000, 6, 0));
  assert.throws(() => monthlyPayment(100000, 6, 51));
  assert.throws(() => emi(1000, 6, 0));
  assert.throws(() => emi(1000, 6, 601));
  assert.throws(() => schedule(10000, 6, 10, -5));
  assert.throws(() => flatRateCompare(10000, 101, 5));
});
