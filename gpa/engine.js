// Grade point math for the GPA planner. All scales use plain lookup tables.
// No school policy is assumed. Check your own school handbook.

export const SCALES = {
  us40: {
    name: 'US 4.0',
    max: 4.0,
    note: 'Common US scale. A and A+ both count 4.0.',
    grades: {
      'A+': 4.0, A: 4.0, 'A-': 3.7,
      'B+': 3.3, B: 3.0, 'B-': 2.7,
      'C+': 2.3, C: 2.0, 'C-': 1.7,
      'D+': 1.3, D: 1.0, F: 0.0
    }
  },
  us43: {
    name: 'US 4.3',
    max: 4.3,
    note: 'Used by some schools that count A+ as 4.3. Check your school policy.',
    grades: {
      'A+': 4.3, A: 4.0, 'A-': 3.7,
      'B+': 3.3, B: 3.0, 'B-': 2.7,
      'C+': 2.3, C: 2.0, 'C-': 1.7,
      'D+': 1.3, D: 1.0, F: 0.0
    }
  },
  india10: {
    name: 'India 10 point',
    max: 10,
    note: 'One common 10 point mapping. Grading rules vary by board and university.',
    grades: { O: 10, 'A+': 9, A: 8, 'B+': 7, B: 6, C: 5, P: 4, F: 0 }
  },
  ects: {
    name: 'ECTS guide',
    max: 4.0,
    note: 'Rough guide only. ECTS publishes no official 4.0 table.',
    grades: { A: 4.0, B: 3.0, C: 2.0, D: 1.0, E: 0.7, F: 0.0 }
  }
};

export function listScales() {
  return Object.entries(SCALES).map(([id, scale]) => ({ id, name: scale.name, max: scale.max, note: scale.note }));
}

export function normalizeGrade(grade) {
  return String(grade).trim().toUpperCase();
}

export function gradePoints(scaleId, grade) {
  const scale = SCALES[scaleId];
  if (!scale) throw new Error('Pick a grade scale from the list.');
  const key = normalizeGrade(grade);
  const points = scale.grades[key];
  if (points === undefined) throw new Error(`Grade ${key} is not part of the ${scale.name} scale.`);
  return points;
}

// Percentage lookup to a 4.0 scale. Boundaries are inclusive at the top end.
const PERCENT_STEPS = [
  [93, 4.0], [90, 3.7], [87, 3.3], [83, 3.0], [80, 2.7],
  [77, 2.3], [73, 2.0], [70, 1.7], [67, 1.3], [65, 1.0]
];

export function percentToGpa(percent) {
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new Error('Enter a percentage from 0 to 100.');
  }
  for (const [floor, points] of PERCENT_STEPS) {
    if (percent >= floor) return points;
  }
  return 0.0;
}

function checkCredits(credits) {
  if (!Number.isFinite(credits) || credits <= 0 || credits > 60) {
    throw new Error('Give each course credits from 0 to 60, not counting zero.');
  }
}

export function semesterGpa(courses, scaleId) {
  if (!SCALES[scaleId]) throw new Error('Pick a grade scale from the list.');
  if (!Array.isArray(courses) || courses.length === 0) throw new Error('Add at least one course.');
  if (courses.length > 200) throw new Error('Keep the list at 200 courses or fewer.');
  let credits = 0;
  let points = 0;
  for (const course of courses) {
    const creditValue = Number(course.credits);
    checkCredits(creditValue);
    const gp = gradePoints(scaleId, course.grade);
    credits += creditValue;
    points += gp * creditValue;
  }
  if (credits === 0) throw new Error('Total credits must be above zero.');
  return { gpa: points / credits, credits, points };
}

// Repeat policy: when replace is on, only the highest attempt per course
// code counts. Courses without a code always count. Ties keep the latest row.
export function applyReplace(courses, scaleId) {
  if (!SCALES[scaleId]) throw new Error('Pick a grade scale from the list.');
  const best = new Map();
  const plain = [];
  courses.forEach((course, index) => {
    const code = String(course.code || '').trim().toUpperCase();
    if (!code) {
      plain.push(course);
      return;
    }
    const gp = gradePoints(scaleId, course.grade);
    const current = best.get(code);
    if (!current || gp > current.points || (gp === current.points && index > current.index)) {
      best.set(code, { course, points: gp, index });
    }
  });
  return [...plain, ...[...best.values()].map(entry => entry.course)];
}

export function cumulativeGpa(priorCredits, priorGpa, courses, scaleId, replace = false) {
  const earned = Number(priorCredits);
  const start = Number(priorGpa);
  if (!Number.isFinite(earned) || earned < 0 || earned > 1000) {
    throw new Error('Enter prior credits from 0 to 1000.');
  }
  const scale = SCALES[scaleId];
  if (!scale) throw new Error('Pick a grade scale from the list.');
  if (earned > 0 && (!Number.isFinite(start) || start < 0 || start > scale.max)) {
    throw new Error(`Enter a prior GPA from 0 to ${scale.max}.`);
  }
  const counted = replace ? applyReplace(courses, scaleId) : courses;
  const term = semesterGpa(counted, scaleId);
  const totalCredits = earned + term.credits;
  if (totalCredits === 0) throw new Error('Total credits must be above zero.');
  const totalPoints = (earned > 0 ? start * earned : 0) + term.points;
  return { cgpa: totalPoints / totalCredits, credits: totalCredits, points: totalPoints, term };
}

// Planner: average needed over remaining credits to reach a target.
// required = (target * (earned + rest) - current * earned) / rest
export function planRequired(priorCredits, priorGpa, targetGpa, remainingCredits, scaleId) {
  const earned = Number(priorCredits);
  const current = Number(priorGpa);
  const target = Number(targetGpa);
  const rest = Number(remainingCredits);
  const scale = SCALES[scaleId];
  if (!scale) throw new Error('Pick a grade scale from the list.');
  if (!Number.isFinite(earned) || earned < 0 || earned > 1000) {
    throw new Error('Enter prior credits from 0 to 1000.');
  }
  if (!Number.isFinite(current) || current < 0 || current > scale.max) {
    throw new Error(`Enter a current GPA from 0 to ${scale.max}.`);
  }
  if (!Number.isFinite(target) || target < 0 || target > scale.max) {
    throw new Error(`Enter a target GPA from 0 to ${scale.max}.`);
  }
  if (!Number.isFinite(rest) || rest <= 0 || rest > 1000) {
    throw new Error('Enter remaining credits above zero, up to 1000.');
  }
  const required = (target * (earned + rest) - current * earned) / rest;
  return { required, possible: required <= scale.max, max: scale.max };
}
