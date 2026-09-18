// QR Code payload builders. Client only, no network.
// Wi-Fi escaping follows the common WIFI:S:...;T:...;P:...;; shape.

const MAX_CHARS = 2000;

export const MAX_CHARS_LIMIT = MAX_CHARS;

export function checkLength(text) {
  const value = String(text);
  if (value.length === 0) throw new Error('Enter some text before making a code.');
  if (value.length > MAX_CHARS) {
    throw new Error(`Keep the text at ${MAX_CHARS} characters or fewer.`);
  }
  return value;
}

function escapeWifi(value) {
  return String(value).replace(/([;,:\\])/g, '\\$1');
}

export function wifiPayload({ ssid, security, password }) {
  const name = String(ssid || '');
  const type = String(security || 'WPA').toUpperCase();
  const pass = String(password || '');
  if (!['WPA', 'WEP', 'NOPASS'].includes(type)) {
    throw new Error('Pick WPA, WEP, or no password for the Wi-Fi type.');
  }
  if (name.length === 0) throw new Error('Enter the Wi-Fi network name.');
  if (type === 'NOPASS') {
    return `WIFI:S:${escapeWifi(name)};T:nopass;;`;
  }
  if (pass.length === 0) throw new Error('Enter the Wi-Fi password or pick no password.');
  return `WIFI:S:${escapeWifi(name)};T:${type};P:${escapeWifi(pass)};;`;
}

export function urlPayload(url) {
  const value = checkLength(String(url || '').trim());
  if (!/^(https?:\/\/|mailto:|tel:|sms:)/i.test(value)) {
    throw new Error('Start the link with http:// or https://.');
  }
  return value;
}

export function vcardPayload({ name, phone, email, org }) {
  const lines = ['BEGIN:VCARD', 'VERSION:3.0'];
  const cleanName = String(name || '').trim();
  if (!cleanName) throw new Error('Enter a name for the contact.');
  lines.push(`FN:${cleanName}`);
  const cleanPhone = String(phone || '').trim();
  if (cleanPhone) lines.push(`TEL:${cleanPhone}`);
  const cleanEmail = String(email || '').trim();
  if (cleanEmail) lines.push(`EMAIL:${cleanEmail}`);
  const cleanOrg = String(org || '').trim();
  if (cleanOrg) lines.push(`ORG:${cleanOrg}`);
  lines.push('END:VCARD');
  return checkLength(lines.join('\n'));
}

export function emailPayload({ to, subject, body }) {
  const address = String(to || '').trim();
  if (!address || !address.includes('@')) throw new Error('Enter a valid email address.');
  const params = new URLSearchParams();
  if (String(subject || '').trim()) params.set('subject', String(subject).trim());
  if (String(body || '').trim()) params.set('body', String(body).trim());
  const query = params.toString();
  return checkLength(`mailto:${address}${query ? `?${query}` : ''}`);
}

export function phonePayload(number) {
  const value = String(number || '').trim();
  if (!value) throw new Error('Enter a phone number.');
  if (!/^[+()\-.\s\d]+$/.test(value)) throw new Error('Use digits and phone symbols only.');
  return checkLength(`tel:${value.replace(/\s+/g, '')}`);
}

export function smsPayload({ number, message }) {
  const value = String(number || '').trim();
  if (!value) throw new Error('Enter a phone number.');
  if (!/^[+()\-.\s\d]+$/.test(value)) throw new Error('Use digits and phone symbols only.');
  const text = String(message || '');
  const query = text ? `?body=${encodeURIComponent(text)}` : '';
  return checkLength(`sms:${value.replace(/\s+/g, '')}${query}`);
}

export function fileNameFor(kind) {
  const safe = String(kind || 'code').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'code';
  return `qr-${safe}.png`;
}

export function matrixSize(version) {
  const v = Number(version);
  if (!Number.isInteger(v) || v < 1 || v > 40) throw new Error('QR version must be 1 to 40.');
  return 21 + 4 * (v - 1);
}

// Format information bits for EC level and mask, per QR spec section 7.9.
// ecBits: L=01, M=00, Q=11, H=10. Returns the 15 bit format string.
export function formatInfoBits(ecLevel, mask) {
  const EC = { L: 0b01, M: 0b00, Q: 0b11, H: 0b10 };
  if (!(ecLevel in EC)) throw new Error('Pick an EC level of L, M, Q, or H.');
  const pattern = Number(mask);
  if (!Number.isInteger(pattern) || pattern < 0 || pattern > 7) {
    throw new Error('Mask must be 0 to 7.');
  }
  const data = (EC[ecLevel] << 3) | pattern;
  const generator = 0b10100110111;
  let bits = data << 10;
  for (let i = 14; i >= 11; i--) {
    if ((bits >> i) & 1) bits ^= generator << (i - 11);
  }
  const remainder = bits & 0x3ff;
  const raw = ((data << 10) | remainder) ^ 0b101010000010010;
  return raw.toString(2).padStart(15, '0');
}

// Reed-Solomon parity for one block over GF(256) with generator x pairing.
// Exposed so tests can check parity math without rendering a matrix.
export function reedSolomonParity(dataBytes, ecCount) {
  const data = Array.from(dataBytes);
  const count = Number(ecCount);
  if (!data.every(n => Number.isInteger(n) && n >= 0 && n <= 255)) {
    throw new Error('Data bytes must be 0 to 255.');
  }
  if (!Number.isInteger(count) || count < 1 || count > 255) {
    throw new Error('EC count must be 1 to 255.');
  }
  const exp = new Array(512);
  const log = new Array(256);
  let x = 1;
  for (let i = 0; i < 255; i++) {
    exp[i] = x;
    log[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) exp[i] = exp[i - 255];
  const mul = (a, b) => (a === 0 || b === 0 ? 0 : exp[log[a] + log[b]]);
  let generator = [1];
  for (let i = 0; i < count; i++) {
    const next = new Array(generator.length + 1).fill(0);
    for (let j = 0; j < generator.length; j++) {
      next[j] ^= mul(generator[j], exp[i]);
      next[j + 1] ^= generator[j];
    }
    generator = next;
  }
  const message = [...data, ...new Array(count).fill(0)];
  for (let i = 0; i < data.length; i++) {
    const factor = message[i];
    if (factor !== 0) {
      for (let j = 0; j < generator.length; j++) {
        message[i + j] ^= mul(generator[j], factor);
      }
    }
  }
  return message.slice(data.length);
}

export function finderPattern() {
  return [
    [1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 1, 1, 0, 1],
    [1, 0, 1, 1, 1, 0, 1],
    [1, 0, 1, 1, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1]
  ];
}
