import {
  conceptionEstimate, dueDate, fertileWindow, formatDay, gestationalAge,
  nextPeriod, parseDay, trimesterRanges
} from './engine.js';

const form = document.getElementById('dates-form');
const output = document.getElementById('output');
const error = document.getElementById('error');

if (!(form instanceof HTMLFormElement) || !output || !error) {
  throw new Error('The date tool could not start. Reload this page.');
}

function inputValue(id) {
  const element = document.getElementById(id);
  return element instanceof HTMLInputElement ? element.value.trim() : '';
}

function stat(label, value) {
  const line = document.createElement('p');
  line.className = 'stat';
  const name = document.createElement('strong');
  name.textContent = `${label}: `;
  line.append(name, document.createTextNode(value));
  return line;
}

form.addEventListener('submit', event => {
  event.preventDefault();
  error.textContent = '';
  output.replaceChildren();
  try {
    const lmpRaw = inputValue('lmp');
    if (!lmpRaw) throw new Error('Enter the first day of the last period.');
    const lmp = parseDay(lmpRaw);
    const due = dueDate(lmp);
    const conceived = conceptionEstimate(lmp);
    const ranges = trimesterRanges(lmp);
    output.append(stat('Due date estimate', `${formatDay(due)} (last period + 280 days)`));
    output.append(stat('Conception estimate', `${formatDay(conceived)} (last period + 14 days)`));
    output.append(stat('First trimester', `${ranges.first.start} to ${ranges.first.end} (weeks 1 to 13)`));
    output.append(stat('Second trimester', `${ranges.second.start} to ${ranges.second.end} (weeks 14 to 27)`));
    output.append(stat('Third trimester', `${ranges.third.start} to ${formatDay(due)} (week 28 on)`));
    const onRaw = inputValue('ondate');
    if (onRaw) {
      const age = gestationalAge(lmp, parseDay(onRaw));
      output.append(stat(
        `On ${onRaw}`,
        `${age.weeks} weeks and ${age.days} days, week ${age.weekNumber} of the count`
      ));
    }
    const cycleRaw = inputValue('cycle');
    if (cycleRaw) {
      const window = fertileWindow(lmp, Number(cycleRaw));
      output.append(stat(
        'Fertile window',
        `${window.fertileStart} to ${window.fertileEnd}, ovulation around ${window.ovulation}`
      ));
      output.append(stat('Next period estimate', nextPeriod(lmp, Number(cycleRaw))));
    }
  } catch (cause) {
    error.textContent = cause instanceof Error ? cause.message : 'Check your dates.';
  }
});
