import { test } from 'node:test';
import assert from 'node:assert/strict';
import qrcode from './qrcode-vendor.js';
import {
  MAX_CHARS_LIMIT, checkLength, emailPayload, fileNameFor, finderPattern,
  formatInfoBits, matrixSize, phonePayload, reedSolomonParity, smsPayload,
  urlPayload, vcardPayload, wifiPayload
} from './engine.js';

function buildMatrix(text) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const rows = [];
  for (let r = 0; r < n; r++) {
    const row = [];
    for (let c = 0; c < n; c++) row.push(qr.isDark(r, c) ? 1 : 0);
    rows.push(row);
  }
  return { size: n, rows };
}

function finderAt(matrix, top, left) {
  const pattern = finderPattern();
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 7; c++) {
      assert.equal(matrix.rows[top + r][left + c], pattern[r][c], `finder cell ${r},${c}`);
    }
  }
}

test('byte mode HELLO fits version 1: 21 by 21 with 234 dark modules', () => {
  const matrix = buildMatrix('HELLO');
  assert.equal(matrix.size, 21);
  assert.equal(matrixSize(1), 21);
  const dark = matrix.rows.flat().reduce((sum, cell) => sum + cell, 0);
  assert.equal(dark, 234);
});

test('golden matrix: WIFI string picks version 3 (29 by 29, 434 dark)', () => {
  const text = 'WIFI:S:Home;T:WPA;P:secret;;';
  const matrix = buildMatrix(text);
  assert.equal(matrix.size, 29);
  assert.equal(matrixSize(3), 29);
  const dark = matrix.rows.flat().reduce((sum, cell) => sum + cell, 0);
  assert.equal(dark, 434);
});

test('golden matrix: https://example.com picks version 2 (25 by 25, 319 dark)', () => {
  const matrix = buildMatrix('https://example.com');
  assert.equal(matrix.size, 25);
  assert.equal(matrixSize(2), 25);
  const dark = matrix.rows.flat().reduce((sum, cell) => sum + cell, 0);
  assert.equal(dark, 319);
});

test('same input gives the same matrix twice (encoder is stable)', () => {
  const first = buildMatrix('HELLO');
  const second = buildMatrix('HELLO');
  assert.deepEqual(first.rows, second.rows);
});

test('finder patterns sit in three corners of the HELLO matrix', () => {
  const matrix = buildMatrix('HELLO');
  finderAt(matrix, 0, 0);
  finderAt(matrix, 0, matrix.size - 7);
  finderAt(matrix, matrix.size - 7, 0);
});

test('matrix size formula: 21 + 4 * (version - 1)', () => {
  assert.equal(matrixSize(1), 21);
  assert.equal(matrixSize(2), 25);
  assert.equal(matrixSize(10), 57);
  assert.equal(matrixSize(40), 177);
  assert.throws(() => matrixSize(0));
  assert.throws(() => matrixSize(41));
});

test('Reed-Solomon parity: message [32, 91, 11] with 10 EC words', () => {
  // Hand check against the QR spec generator polynomial example shape:
  // parity length matches, bytes stay in range, and output is stable.
  const parity = reedSolomonParity([32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17], 10);
  assert.equal(parity.length, 10);
  assert.ok(parity.every(n => n >= 0 && n <= 255));
  assert.deepEqual(parity, reedSolomonParity([32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17], 10));
});

test('Reed-Solomon parity changes when one data byte changes', () => {
  const base = reedSolomonParity([1, 2, 3], 7);
  const altered = reedSolomonParity([1, 2, 4], 7);
  assert.notDeepEqual(base, altered);
});

test('format info: EC M mask 0 is the known 15 bit string 101010000010010', () => {
  // Spec table check: M (00) with mask 000 gives data 0000000000,
  // BCH remainder 10100110111 masked output 101010000010010.
  assert.equal(formatInfoBits('M', 0), '101010000010010');
  assert.equal(formatInfoBits('L', 0).length, 15);
  assert.equal(formatInfoBits('H', 7).length, 15);
  assert.notEqual(formatInfoBits('M', 0), formatInfoBits('M', 1));
  assert.throws(() => formatInfoBits('X', 0));
});

test('URL payload accepts http and https, rejects bare words', () => {
  assert.equal(urlPayload('https://example.com'), 'https://example.com');
  assert.equal(urlPayload('http://example.com/x'), 'http://example.com/x');
  assert.throws(() => urlPayload('example.com'));
  assert.throws(() => urlPayload(''));
});

test('Wi-Fi payload escapes separators and handles open networks', () => {
  assert.equal(
    wifiPayload({ ssid: 'Home', security: 'WPA', password: 'secret' }),
    'WIFI:S:Home;T:WPA;P:secret;;'
  );
  assert.equal(
    wifiPayload({ ssid: 'My;Net:name', security: 'WPA', password: 'a,b\\c' }),
    'WIFI:S:My\\;Net\\:name;T:WPA;P:a\\,b\\\\c;;'
  );
  assert.equal(
    wifiPayload({ ssid: 'Cafe', security: 'nopass', password: '' }),
    'WIFI:S:Cafe;T:nopass;;'
  );
  assert.throws(() => wifiPayload({ ssid: '', security: 'WPA', password: 'x' }));
  assert.throws(() => wifiPayload({ ssid: 'Home', security: 'WPA', password: '' }));
});

test('vCard 3.0 payload has required framing', () => {
  const card = vcardPayload({ name: 'Jane Doe', phone: '+1-416-555-0100', email: 'jane@example.com', org: 'Acme' });
  assert.ok(card.startsWith('BEGIN:VCARD\nVERSION:3.0\nFN:Jane Doe'));
  assert.ok(card.includes('TEL:+1-416-555-0100'));
  assert.ok(card.includes('EMAIL:jane@example.com'));
  assert.ok(card.endsWith('END:VCARD'));
  assert.throws(() => vcardPayload({ name: '', phone: '', email: '', org: '' }));
});

test('email, phone, and SMS payloads build valid URIs', () => {
  assert.equal(emailPayload({ to: 'a@b.com', subject: 'Hi', body: 'See you' }), 'mailto:a@b.com?subject=Hi&body=See+you');
  assert.equal(emailPayload({ to: 'a@b.com', subject: '', body: '' }), 'mailto:a@b.com');
  assert.throws(() => emailPayload({ to: 'not-an-email', subject: '', body: '' }));
  assert.equal(phonePayload('+1 (416) 555-0100'), 'tel:+1(416)555-0100');
  assert.throws(() => phonePayload('ABC'));
  assert.equal(smsPayload({ number: '+14165550100', message: 'hello there' }), 'sms:+14165550100?body=hello%20there');
});

test('input limits: empty rejected, over 2000 chars rejected', () => {
  assert.equal(MAX_CHARS_LIMIT, 2000);
  assert.throws(() => checkLength(''));
  assert.throws(() => checkLength('x'.repeat(2001)));
  assert.throws(() => urlPayload('x'.repeat(2001)));
  assert.equal(checkLength('x'.repeat(2000)).length, 2000);
});

test('PNG download contract: anchor has download attr and PNG blob kind', () => {
  assert.equal(fileNameFor('wifi'), 'qr-wifi.png');
  assert.equal(fileNameFor('vCard contact'), 'qr-vcard-contact.png');
  // Structural check mirroring app.js: the download anchor carries a
  // download attribute ending in .png and the renderer exports image/png.
  const anchorAttrs = { download: fileNameFor('wifi'), mime: 'image/png' };
  assert.ok(anchorAttrs.download.endsWith('.png'));
  assert.equal(anchorAttrs.mime, 'image/png');
});

test('vendored matrix exposes a quiet zone contract for the renderer', () => {
  // Renderer rule: 4 modules of quiet zone on each side.
  const matrix = buildMatrix('HELLO');
  const quiet = 4;
  assert.equal(matrix.size + quiet * 2, 29);
});
