import { cumulativeGpa, percentToGpa, planRequired, SCALES } from './engine.js';

const form = document.getElementById('gpa-form');
const scale = document.getElementById('scale');
const scaleNote = document.getElementById('scale-note');
const rows = document.getElementById('rows');
const addButton = document.getElementById('add');
const output = document.getElementById('output');
const error = document.getElementById('error');
const percent = document.getElementById('percent');
const percentOut = document.getElementById('percent-out');

if (!(form instanceof HTMLFormElement) || !(scale instanceof HTMLSelectElement) ||
  !(addButton instanceof HTMLButtonElement) || !rows || !output || !error ||
  !(percent instanceof HTMLInputElement) || !(percentOut instanceof HTMLInputElement)) {
  throw new Error('The GPA tool could not start. Reload this page.');
}

function gradeOptions(scaleId) {
  const table = SCALES[scaleId] || SCALES.us40;
  return Object.keys(table.grades).map(grade => `<option value="${grade}">${grade} (${table.grades[grade]})</option>`).join('');
}

function addRow(code = '', grade = 'A', credits = '3') {
  const row = document.createElement('div');
  row.className = 'course';
  row.innerHTML = `<div><label>Course code, optional</label><input type="text" data-part="code" maxlength="20" value=""></div><div><label>Grade</label><select data-part="grade"></select></div><div><label>Credits</label><input type="number" data-part="credits" min="0" step="any" value="3"></div><button type="button" class="remove secondary" aria-label="Remove course">Remove</button>`;
  const codeInput = row.querySelector('[data-part="code"]');
  const gradeSelect = row.querySelector('[data-part="grade"]');
  const creditInput = row.querySelector('[data-part="credits"]');
  if (codeInput instanceof HTMLInputElement) codeInput.value = code;
  if (gradeSelect instanceof HTMLSelectElement) {
    gradeSelect.innerHTML = gradeOptions(scale.value);
    gradeSelect.value = grade;
  }
  if (creditInput instanceof HTMLInputElement) creditInput.value = credits;
  const remove = row.querySelector('.remove');
  if (remove instanceof HTMLButtonElement) {
    remove.addEventListener('click', () => {
      row.remove();
      if (!rows.querySelector('.course')) addRow();
    });
  }
  rows.append(row);
}

function refreshGrades() {
  const note = SCALES[scale.value];
  if (scaleNote && note) scaleNote.textContent = note.note;
  for (const select of rows.querySelectorAll('select[data-part="grade"]')) {
    if (select instanceof HTMLSelectElement) {
      const keep = select.value;
      select.innerHTML = gradeOptions(scale.value);
      if ([...select.options].some(option => option.value === keep)) select.value = keep;
    }
  }
}

function readCourses() {
  const courses = [];
  for (const row of rows.querySelectorAll('.course')) {
    const code = row.querySelector('[data-part="code"]');
    const grade = row.querySelector('[data-part="grade"]');
    const credits = row.querySelector('[data-part="credits"]');
    courses.push({
      code: code instanceof HTMLInputElement ? code.value : '',
      grade: grade instanceof HTMLSelectElement ? grade.value : '',
      credits: credits instanceof HTMLInputElement ? Number(credits.value) : NaN
    });
  }
  return courses;
}

function inputValue(id) {
  const element = document.getElementById(id);
  return element instanceof HTMLInputElement ? element.value.trim() : '';
}

addButton.addEventListener('click', () => addRow());
scale.addEventListener('change', refreshGrades);
percent.addEventListener('input', () => {
  try {
    percentOut.value = String(percentToGpa(Number(percent.value)));
  } catch {
    percentOut.value = '';
  }
});

form.addEventListener('submit', event => {
  event.preventDefault();
  error.textContent = '';
  output.replaceChildren();
  try {
    const priorCredits = Number(inputValue('prior-credits') || 0);
    const priorGpa = Number(inputValue('prior-gpa') || 0);
    const replace = document.getElementById('replace') instanceof HTMLInputElement &&
      document.getElementById('replace').checked;
    const result = cumulativeGpa(priorCredits, priorGpa, readCourses(), scale.value, replace);
    const termLine = document.createElement('p');
    termLine.className = 'stat';
    termLine.textContent = `Term GPA: ${result.term.gpa.toFixed(2)} over ${result.term.credits} credits`;
    const cumLine = document.createElement('p');
    cumLine.className = 'stat big';
    cumLine.textContent = priorCredits > 0
      ? `CGPA: ${result.cgpa.toFixed(2)} over ${result.credits} credits`
      : `GPA: ${result.cgpa.toFixed(2)} over ${result.credits} credits`;
    output.append(termLine, cumLine);
    const targetRaw = inputValue('target');
    const restRaw = inputValue('remaining');
    if (targetRaw || restRaw) {
      const plan = planRequired(result.credits, result.cgpa, Number(targetRaw), Number(restRaw), scale.value);
      const planLine = document.createElement('p');
      planLine.className = 'stat';
      planLine.textContent = plan.possible
        ? `To reach ${Number(targetRaw).toFixed(2)}, average ${plan.required.toFixed(2)} over the next ${Number(restRaw)} credits.`
        : `To reach ${Number(targetRaw).toFixed(2)} you would need ${plan.required.toFixed(2)}, above the ${plan.max} max. That target is out of reach on grades alone.`;
      output.append(planLine);
    }
  } catch (cause) {
    error.textContent = cause instanceof Error ? cause.message : 'Check your entries.';
  }
});

addRow('', 'A', '3');
addRow('', 'B', '3');
refreshGrades();
try {
  percentOut.value = String(percentToGpa(Number(percent.value)));
} catch {
  percentOut.value = '';
}
