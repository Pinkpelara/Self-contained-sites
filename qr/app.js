import qrcode from './qrcode-vendor.js';
import {
  emailPayload, fileNameFor, phonePayload, smsPayload, urlPayload,
  vcardPayload, wifiPayload
} from './engine.js';

const form = document.getElementById('qr-form');
const kind = document.getElementById('kind');
const canvas = document.getElementById('qr-canvas');
const download = document.getElementById('download');
const meta = document.getElementById('meta');
const payloadLine = document.getElementById('payload');
const error = document.getElementById('error');
const count = document.getElementById('count');

if (!(form instanceof HTMLFormElement) || !(kind instanceof HTMLSelectElement) ||
  !(canvas instanceof HTMLCanvasElement) || !(download instanceof HTMLAnchorElement) ||
  !meta || !payloadLine || !error || !count) {
  throw new Error('The QR tool could not start. Reload this page.');
}

function field(id) {
  return document.getElementById(id);
}

function value(id) {
  const element = field(id);
  return element instanceof HTMLInputElement || element instanceof HTMLSelectElement ? element.value : '';
}

function showGroup() {
  const current = kind.value;
  for (const name of ['url', 'wifi', 'vcard', 'email', 'phone', 'sms']) {
    const group = field(`group-${name}`);
    if (group instanceof HTMLElement) group.hidden = name !== current;
  }
  updateCount();
}

function payloadLength() {
  try {
    return buildPayload().length;
  } catch {
    return 0;
  }
}

function updateCount() {
  count.textContent = `${payloadLength()} of 2000 characters.`;
}

function buildPayload() {
  switch (kind.value) {
    case 'wifi':
      return wifiPayload({ ssid: value('ssid'), security: value('security'), password: value('password') });
    case 'vcard':
      return vcardPayload({ name: value('vname'), phone: value('vphone'), email: value('vemail'), org: value('vorg') });
    case 'email':
      return emailPayload({ to: value('eto'), subject: value('esubject'), body: value('ebody') });
    case 'phone':
      return phonePayload(value('phone'));
    case 'sms':
      return smsPayload({ number: value('sms-number'), message: value('sms-text') });
    default:
      return urlPayload(value('url'));
  }
}

function draw(text) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const modules = qr.getModuleCount();
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Your browser cannot draw on a canvas.');
  const quiet = 4;
  const total = modules + quiet * 2;
  const scale = Math.max(2, Math.floor(1160 / total));
  const edge = 8;
  canvas.width = total * scale + edge * 2;
  canvas.height = total * scale + edge * 2;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#111322';
  for (let row = 0; row < modules; row++) {
    for (let col = 0; col < modules; col++) {
      if (qr.isDark(row, col)) {
        context.fillRect(edge + (col + quiet) * scale, edge + (row + quiet) * scale, scale, scale);
      }
    }
  }
  canvas.setAttribute('aria-label', `QR code for ${text.slice(0, 120)}`);
  canvas.toBlob(blob => {
    if (download instanceof HTMLAnchorElement) {
      if (download.href.startsWith('blob:')) URL.revokeObjectURL(download.href);
      if (blob) {
        const url = URL.createObjectURL(blob);
        download.href = url;
        download.download = fileNameFor(kind.value === 'url' ? 'link' : kind.value);
      }
    }
  }, 'image/png');
  meta.textContent = `${modules} by ${modules} modules, version ${(modules - 21) / 4 + 1}. Quiet zone of 4 modules included.`;
  payloadLine.textContent = text;
}

kind.addEventListener('change', showGroup);
form.addEventListener('input', updateCount);
form.addEventListener('submit', event => {
  event.preventDefault();
  error.textContent = '';
  try {
    const text = buildPayload();
    draw(text);
  } catch (cause) {
    error.textContent = cause instanceof Error ? cause.message : 'Check your entries.';
  }
  updateCount();
});

showGroup();
try {
  draw(buildPayload());
} catch {
  meta.textContent = 'Pick a type and press Make QR code. The PNG saves as qr-link, qr-wifi, and so on.';
}
