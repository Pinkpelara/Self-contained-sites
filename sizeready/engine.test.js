import test from 'node:test';
import assert from 'node:assert/strict';
import { downloadName, fitBudget, fitDimensions, validateFiles, validateSettings } from './engine.js';

const encode = async (width, height, quality) => ({ size: Math.ceil(width * height * quality) + 100 });

test('fits within both dimensions without upscaling', () => {
  assert.deepEqual(fitDimensions(4000, 2000, 1600, 1600), { width: 1600, height: 800 });
  assert.deepEqual(fitDimensions(50, 100, 1600, 1600), { width: 50, height: 100 });
  assert.deepEqual(fitDimensions(1, 24000, 1600, 1600), { width: 1, height: 1600 });
});

test('rejects invalid dimensions and uses decimal kilobytes', () => {
  assert.throws(() => fitDimensions(0, 1, 2, 3));
  assert.throws(() => validateSettings(0, 1600, 1600));
  assert.throws(() => validateSettings(20, Infinity, 1600));
  assert.throws(() => validateSettings(20, 2.5, 1600));
  assert.equal(validateSettings(200, 1600, 1600).budget, 200000);
});

test('validates type, quantity, empty files and batch limits', () => {
  const image = { type: 'image/png', size: 20000000 };
  assert.doesNotThrow(() => validateFiles([image]));
  assert.throws(() => validateFiles([]));
  assert.throws(() => validateFiles(Array(21).fill(image)));
  assert.throws(() => validateFiles(Array(6).fill(image)));
  assert.throws(() => validateFiles([{ type: 'image/svg+xml', size: 10 }]));
  assert.throws(() => validateFiles([{ type: 'image/png', size: 0 }]));
  assert.throws(() => validateFiles([{ type: 'image/jpeg', size: 20000001 }]));
});

test('download names remove paths and distinguish repeated names', () => {
  assert.equal(downloadName('../../hello world.png', 0), '01-hello-world-ready.jpg');
  assert.equal(downloadName('.png', 1), '02-image-ready.jpg');
  assert.notEqual(downloadName('same.png', 0), downloadName('same.png', 1));
});

test('keeps maximum quality when already below budget', async () => {
  const result = await fitBudget(100, 100, 20000, false, encode);
  assert.equal(result.quality, 0.94);
  assert.equal(result.width, 100);
  assert.ok(result.blob.size <= 20000);
});

test('reduces quality before dimensions', async () => {
  const result = await fitBudget(100, 100, 5000, true, encode);
  assert.equal(result.width, 100);
  assert.ok(result.quality >= 0.3 && result.quality < 0.5);
  assert.ok(result.blob.size <= 5000);
});

test('only reduces dimensions with permission', async () => {
  await assert.rejects(fitBudget(100, 100, 1000, false, encode), /Cannot meet/);
  const result = await fitBudget(100, 100, 1000, true, encode);
  assert.ok(result.width < 100);
  assert.ok(result.blob.size <= 1000);
});

test('impossible budgets terminate and encode failures propagate', async () => {
  await assert.rejects(fitBudget(10, 10, 100, true, async () => ({ size: 101 })), /Cannot meet/);
  await assert.rejects(fitBudget(10, 10, 100, true, async () => { throw new Error('No codec'); }), /No codec/);
  await assert.rejects(fitBudget(0, 10, 100, true, encode), /Invalid/);
});

test('accepts exact equality and always returns a measured compliant result', async () => {
  const result = await fitBudget(10, 10, 100, false, async () => ({ size: 100 }));
  assert.equal(result.blob.size, 100);
});
