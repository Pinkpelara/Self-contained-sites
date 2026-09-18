import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyReplace, cumulativeGpa, gradePoints, percentToGpa, planRequired, semesterGpa
} from './engine.js';

test('weighted GPA matches a hand check: A(4x3) + B(3x3) = 3.5', () => {
  const result = semesterGpa(
    [{ grade: 'A', credits: 3 }, { grade: 'B', credits: 3 }],
    'us40'
  );
  assert.equal(result.credits, 6);
  assert.equal(result.points, 4.0 * 3 + 3.0 * 3);
  assert.equal(result.gpa, 3.5);
});

test('credit weight changes the answer: A in 4 credits vs F in 1 credit', () => {
  const result = semesterGpa(
    [{ grade: 'A', credits: 4 }, { grade: 'F', credits: 1 }],
    'us40'
  );
  // (16 + 0) / 5 = 3.2
  assert.equal(result.gpa, 3.2);
});

test('US 4.0 letter map covers every step', () => {
  const expected = {
    'A+': 4.0, A: 4.0, 'A-': 3.7, 'B+': 3.3, B: 3.0, 'B-': 2.7,
    'C+': 2.3, C: 2.0, 'C-': 1.7, 'D+': 1.3, D: 1.0, F: 0.0
  };
  for (const [grade, points] of Object.entries(expected)) {
    assert.equal(gradePoints('us40', grade), points);
  }
});

test('4.3 variant counts A+ as 4.3 and matches 4.0 elsewhere', () => {
  assert.equal(gradePoints('us43', 'A+'), 4.3);
  assert.equal(gradePoints('us43', 'A'), 4.0);
  assert.equal(gradePoints('us43', 'B'), 3.0);
});

test('India 10 point map: O=10 down to P=4, F=0', () => {
  assert.equal(gradePoints('india10', 'O'), 10);
  assert.equal(gradePoints('india10', 'A+'), 9);
  assert.equal(gradePoints('india10', 'A'), 8);
  assert.equal(gradePoints('india10', 'B+'), 7);
  assert.equal(gradePoints('india10', 'B'), 6);
  assert.equal(gradePoints('india10', 'C'), 5);
  assert.equal(gradePoints('india10', 'P'), 4);
  assert.equal(gradePoints('india10', 'F'), 0);
});

test('ECTS guide map: A=4.0, B=3.0, C=2.0, D=1.0, E=0.7, F=0', () => {
  assert.equal(gradePoints('ects', 'A'), 4.0);
  assert.equal(gradePoints('ects', 'B'), 3.0);
  assert.equal(gradePoints('ects', 'C'), 2.0);
  assert.equal(gradePoints('ects', 'D'), 1.0);
  assert.equal(gradePoints('ects', 'E'), 0.7);
  assert.equal(gradePoints('ects', 'F'), 0.0);
});

test('percentage lookup respects boundaries: 93=4.0, 90=3.7, 80=2.7, 65=1.0, 64=0', () => {
  assert.equal(percentToGpa(100), 4.0);
  assert.equal(percentToGpa(93), 4.0);
  assert.equal(percentToGpa(92.9), 3.7);
  assert.equal(percentToGpa(90), 3.7);
  assert.equal(percentToGpa(87), 3.3);
  assert.equal(percentToGpa(80), 2.7);
  assert.equal(percentToGpa(73), 2.0);
  assert.equal(percentToGpa(65), 1.0);
  assert.equal(percentToGpa(64.9), 0.0);
  assert.equal(percentToGpa(0), 0.0);
});

test('replace policy keeps only the best attempt per course code', () => {
  const courses = [
    { code: 'MATH101', grade: 'F', credits: 3 },
    { code: 'MATH101', grade: 'B', credits: 3 },
    { code: 'ENG101', grade: 'A', credits: 3 }
  ];
  const kept = applyReplace(courses, 'us40');
  assert.equal(kept.length, 2);
  const result = semesterGpa(kept, 'us40');
  // (3.0*3 + 4.0*3) / 6 = 3.5
  assert.equal(result.gpa, 3.5);
});

test('without replace both attempts count', () => {
  const courses = [
    { code: 'MATH101', grade: 'F', credits: 3 },
    { code: 'MATH101', grade: 'B', credits: 3 }
  ];
  const result = semesterGpa(courses, 'us40');
  assert.equal(result.gpa, 1.5);
});

test('cumulative GPA hand check: 30 credits at 3.0 plus 15 credits at 4.0', () => {
  // (90 + 60) / 45 = 150 / 45 = 3.333...
  const result = cumulativeGpa(30, 3.0, [{ grade: 'A', credits: 15 }], 'us40');
  assert.equal(result.credits, 45);
  assert.ok(Math.abs(result.cgpa - 3.3333333333) < 1e-9);
});

test('planner formula: 60 credits at 3.0, target 3.2, 60 left needs 3.4', () => {
  // (3.2 * 120 - 3.0 * 60) / 60 = (384 - 180) / 60 = 3.4
  const plan = planRequired(60, 3.0, 3.2, 60, 'us40');
  assert.ok(Math.abs(plan.required - 3.4) < 1e-9);
  assert.equal(plan.possible, true);
});

test('planner flags an impossible target above the scale max', () => {
  const plan = planRequired(90, 2.0, 4.0, 30, 'us40');
  // (4.0*120 - 2.0*90)/30 = (480-180)/30 = 10
  assert.equal(plan.required, 10);
  assert.equal(plan.possible, false);
});

test('planner with no prior credits returns the target itself', () => {
  const plan = planRequired(0, 0, 3.5, 15, 'us40');
  assert.equal(plan.required, 3.5);
});

test('invalid inputs are rejected', () => {
  assert.throws(() => semesterGpa([], 'us40'));
  assert.throws(() => semesterGpa([{ grade: 'A', credits: 0 }], 'us40'));
  assert.throws(() => semesterGpa([{ grade: 'A', credits: -3 }], 'us40'));
  assert.throws(() => semesterGpa([{ grade: 'Z', credits: 3 }], 'us40'));
  assert.throws(() => semesterGpa([{ grade: 'A', credits: 3 }], 'nope'));
  assert.throws(() => percentToGpa(-1));
  assert.throws(() => percentToGpa(101));
  assert.throws(() => percentToGpa(NaN));
  assert.throws(() => cumulativeGpa(-1, 3, [{ grade: 'A', credits: 3 }], 'us40'));
  assert.throws(() => cumulativeGpa(10, 5, [{ grade: 'A', credits: 3 }], 'us40'));
  assert.throws(() => planRequired(10, 3, 3.5, 0, 'us40'));
  assert.throws(() => gradePoints('us40', 'E'));
});

test('grade input is case and space tolerant', () => {
  assert.equal(gradePoints('us40', ' a- '), 3.7);
  assert.equal(gradePoints('us43', 'a+'), 4.3);
});
