import { CITIES, decodeShare, encodeShare, meetingTable } from './engine.js';

const form = document.getElementById('tz-form');
const cityList = document.getElementById('city-list');
const rows = document.getElementById('rows');
const error = document.getElementById('error');
const count = document.getElementById('count');
const share = document.getElementById('share');
const shareOut = document.getElementById('share-out');

if (!(form instanceof HTMLFormElement) || !cityList || !(rows instanceof HTMLElement) ||
  !error || !count || !(share instanceof HTMLButtonElement) || !shareOut) {
  throw new Error('The time tool could not start. Reload this page.');
}

function inputValue(id) {
  const element = document.getElementById(id);
  return element instanceof HTMLInputElement ? element.value : '';
}

const DEFAULT_ZONES = ['America/New_York', 'Europe/London', 'Asia/Tokyo', 'Australia/Sydney'];

function buildList(selected) {
  cityList.replaceChildren();
  for (const city of CITIES) {
    const label = document.createElement('label');
    label.className = 'city';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.value = city.zone;
    box.checked = selected.includes(city.zone);
    const text = document.createElement('span');
    text.textContent = `${city.label} (${city.zone})`;
    label.append(box, text);
    cityList.append(label);
  }
}

function pickedZones() {
  return [...cityList.querySelectorAll('input[type="checkbox"]:checked')]
    .map(box => (box instanceof HTMLInputElement ? box.value : ''))
    .filter(Boolean)
    .slice(0, 24);
}

function instantFromInputs() {
  const date = inputValue('date');
  const time = inputValue('time');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Pick a meeting date.');
  if (!/^\d{2}:\d{2}$/.test(time)) throw new Error('Pick a meeting time.');
  const instant = new Date(`${date}T${time}:00`);
  if (Number.isNaN(instant.getTime())) throw new Error('That date and time could not be read.');
  return { instant, date, time };
}

function render() {
  error.textContent = '';
  rows.replaceChildren();
  try {
    const { instant, date, time } = instantFromInputs();
    const zones = pickedZones();
    if (!zones.length) throw new Error('Tick at least one city.');
    const table = meetingTable(instant, zones);
    const inHours = table.filter(row => row.inWorkHours).length;
    for (const row of table) {
      const line = document.createElement('tr');
      if (row.inWorkHours) line.className = 'in-hours';
      const city = document.createElement('td');
      city.textContent = row.fallback ? `${row.city} (UTC fallback)` : row.city;
      const local = document.createElement('td');
      local.textContent = `${row.label}, ${row.time}`;
      const offset = document.createElement('td');
      offset.textContent = row.offsetLabel;
      const work = document.createElement('td');
      work.textContent = row.inWorkHours ? 'In hours' : 'Outside';
      line.append(city, local, offset, work);
      rows.append(line);
    }
    count.textContent = `${inHours} of ${table.length} in 9 to 5 hours. Time shown from ${date} ${time} in your zone.`;
    const hash = encodeShare({ date, time, zones });
    shareOut.textContent = `Share link ready: ${`${location.pathname}#${hash}`.slice(0, 140)}`;
    shareOut.dataset.hash = hash;
  } catch (cause) {
    const line = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 4;
    cell.textContent = 'Pick a date and time, then press Show local times.';
    line.append(cell);
    rows.append(line);
    if (cause instanceof Error) error.textContent = cause.message;
  }
}

form.addEventListener('submit', event => {
  event.preventDefault();
  render();
});

share.addEventListener('click', async () => {
  render();
  const hash = shareOut.dataset.hash || '';
  if (!hash) return;
  const url = `${location.href.split('#')[0]}#${hash}`;
  try {
    await navigator.clipboard.writeText(url);
    shareOut.textContent = 'Share link copied. Send it to your guests.';
  } catch {
    shareOut.textContent = `Copy this link: ${url}`;
  }
});

try {
  const shared = decodeShare(location.hash);
  const dateInput = document.getElementById('date');
  const timeInput = document.getElementById('time');
  if (dateInput instanceof HTMLInputElement) dateInput.value = shared.date;
  if (timeInput instanceof HTMLInputElement) timeInput.value = shared.time;
  buildList(shared.zones.length ? shared.zones : DEFAULT_ZONES);
} catch {
  buildList(DEFAULT_ZONES);
}
render();
