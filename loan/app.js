import { firstYear, flatRateCompare, loanTotals, schedule, yearlyRollup } from './engine.js';

const form = document.getElementById('loan-form');
const output = document.getElementById('output');
const error = document.getElementById('error');

if (!(form instanceof HTMLFormElement) || !output || !error) {
  throw new Error('The loan tool could not start. Reload this page.');
}

const SYMBOLS = { USD: '$', EUR: '€', GBP: '£', INR: '₹', CAD: 'C$' };

function inputValue(id) {
  const element = document.getElementById(id);
  return element instanceof HTMLInputElement || element instanceof HTMLSelectElement ? element.value.trim() : '';
}

function money(value) {
  const code = inputValue('currency') || 'USD';
  const symbol = SYMBOLS[code] || '$';
  const number = Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${symbol}${number} ${code}`;
}

function stat(label, value) {
  const line = document.createElement('p');
  line.className = 'stat';
  const name = document.createElement('strong');
  name.textContent = `${label}: `;
  line.append(name, document.createTextNode(value));
  return line;
}

function table(headers, rowsData) {
  const wrap = document.createElement('div');
  wrap.className = 'table-wrap';
  const tableElement = document.createElement('table');
  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  for (const header of headers) {
    const cell = document.createElement('th');
    cell.scope = 'col';
    cell.textContent = header;
    headRow.append(cell);
  }
  head.append(headRow);
  const body = document.createElement('tbody');
  for (const rowData of rowsData) {
    const line = document.createElement('tr');
    for (const cellData of rowData) {
      const cell = document.createElement('td');
      cell.textContent = cellData;
      line.append(cell);
    }
    body.append(line);
  }
  tableElement.append(head, body);
  wrap.append(tableElement);
  return wrap;
}

form.addEventListener('submit', event => {
  event.preventDefault();
  error.textContent = '';
  output.replaceChildren();
  try {
    const principal = Number(inputValue('principal'));
    const rate = Number(inputValue('rate'));
    const years = Number(inputValue('years'));
    const extra = Number(inputValue('extra') || 0);
    const totals = loanTotals(principal, rate, years);
    const full = schedule(principal, rate, years, extra);
    output.append(stat('Monthly payment', `${money(totals.payment)} for ${totals.months} months`));
    output.append(stat('Total interest', money(totals.totalInterest)));
    output.append(stat('Total paid', money(totals.totalPaid)));
    if (extra > 0) {
      const saved = totals.totalInterest - full.totalInterest;
      output.append(stat(
        `With ${money(extra)} extra a month`,
        `${full.months} months instead of ${totals.months}, saving ${money(saved)} in interest`
      ));
    }
    const first = firstYear(full);
    const head = document.createElement('h3');
    head.textContent = 'First 12 months';
    output.append(head);
    output.append(table(
      ['Month', 'Payment', 'Interest', 'Principal', 'Balance'],
      first.map(row => [
        String(row.month), money(row.payment), money(row.interest),
        money(row.principal), money(row.balance)
      ])
    ));
    const rollHead = document.createElement('h3');
    rollHead.textContent = 'Yearly rollup';
    output.append(rollHead);
    output.append(table(
      ['Year', 'Paid', 'Interest', 'Principal', 'Balance'],
      yearlyRollup(full).map(row => [
        String(row.year), money(row.payment), money(row.interest),
        money(row.principal), money(row.balance)
      ])
    ));
    const flat = flatRateCompare(principal, rate, years);
    output.append(stat(
      'Flat rate comparison',
      `At a ${rate}% flat rate the same loan would charge ${money(flat.totalInterest)} in interest at ${money(flat.monthly)} a month, versus ${money(totals.totalInterest)} on a reducing balance.`
    ));
  } catch (cause) {
    error.textContent = cause instanceof Error ? cause.message : 'Check your numbers.';
  }
});
