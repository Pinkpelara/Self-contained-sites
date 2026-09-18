import { downloadName, fitBudget, fitDimensions, validateFiles, validateSettings } from './engine.js';

function input(id) {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLInputElement)) throw new Error(`Missing input: ${id}`);
  return element;
}

const form = document.getElementById('settings');
const controls = document.getElementById('controls');
const demo = document.getElementById('demo');
const clear = document.getElementById('clear');
const status = document.getElementById('status');
const error = document.getElementById('error');
const progress = document.getElementById('progress');
const results = document.getElementById('results');
if (!(form instanceof HTMLFormElement) || !(controls instanceof HTMLFieldSetElement) || !(demo instanceof HTMLButtonElement) || !(clear instanceof HTMLButtonElement) || !(progress instanceof HTMLProgressElement) || !status || !error || !results) throw new Error('The image tool could not initialize. Reload this page.');

let busy = false;
let urls = [];

function releaseResults() {
  for (const url of urls) URL.revokeObjectURL(url);
  urls = [];
  results.replaceChildren();
}

function reportFailure(name, message) {
  const card = document.createElement('article');
  card.className = 'result failed';
  const heading = document.createElement('h3');
  heading.textContent = name;
  const text = document.createElement('p');
  text.textContent = message;
  card.append(heading, text);
  results.append(card);
}

async function convert(file, settings, shrink, index) {
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 24000000) throw new Error('Image exceeds 24 megapixels. Resize it before using this tool.');
    const initial = fitDimensions(bitmap.width, bitmap.height, settings.maxWidth, settings.maxHeight);
    const canvas = document.createElement('canvas');
    canvas.width = 0;
    canvas.height = 0;
    try {
      const encode = async (width, height, quality) => {
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext('2d');
          if (!context) throw new Error('Your browser cannot create an image canvas.');
          context.fillStyle = '#ffffff';
          context.fillRect(0, 0, width, height);
          context.drawImage(bitmap, 0, 0, width, height);
        }
        return new Promise((resolve, reject) => {
          canvas.toBlob(blob => {
            if (!blob || blob.type !== 'image/jpeg') reject(new Error('JPEG export is unavailable in this browser.'));
            else resolve(blob);
          }, 'image/jpeg', quality);
        });
      };
      const fitted = await fitBudget(initial.width, initial.height, settings.budget, shrink, encode);
      if (fitted.blob.size > settings.budget) throw new Error('Output exceeds the requested budget.');
      const url = URL.createObjectURL(fitted.blob);
      urls.push(url);
      const card = document.createElement('article');
      card.className = 'result';
      const preview = document.createElement('img');
      preview.src = url;
      preview.alt = `Converted preview of ${file.name}`;
      preview.loading = 'lazy';
      const body = document.createElement('div');
      const heading = document.createElement('h3');
      heading.textContent = file.name;
      const details = document.createElement('p');
      details.className = 'meta';
      details.textContent = `${(file.size / 1000).toFixed(1)} KB → ${(fitted.blob.size / 1000).toFixed(2)} KB · ${fitted.width} × ${fitted.height} px · ${fitted.blob.size.toLocaleString()} bytes`;
      const badge = document.createElement('p');
      badge.className = 'fit-badge';
      badge.textContent = 'Within your byte budget';
      const link = document.createElement('a');
      link.className = 'dl';
      link.href = url;
      link.download = downloadName(file.name, index);
      link.textContent = 'Download JPEG';
      link.setAttribute('aria-label', `Download JPEG for ${file.name}`);
      body.append(heading, details, badge, link);
      card.append(preview, body);
      results.append(card);
    } finally {
      canvas.width = 1;
      canvas.height = 1;
    }
  } finally {
    bitmap.close();
  }
}

async function run(files) {
  if (busy) return;
  if (!(controls instanceof HTMLFieldSetElement) || !(demo instanceof HTMLButtonElement) || !(progress instanceof HTMLProgressElement)) return;
  error.textContent = '';
  let settings;
  try {
    settings = validateSettings(Number(input('target').value), Number(input('max-width').value), Number(input('max-height').value));
    validateFiles(files);
    if (typeof createImageBitmap !== 'function') throw new Error('Please use a current browser with image decoding support.');
  } catch (cause) {
    error.textContent = cause instanceof Error ? cause.message : 'Check your images and settings.';
    return;
  }
  const shrink = input('shrink').checked;
  busy = true;
  controls.disabled = true;
  demo.disabled = true;
  releaseResults();
  progress.hidden = false;
  progress.max = files.length;
  progress.value = 0;
  let successful = 0;
  try {
    for (const [index, file] of files.entries()) {
      status.textContent = `Processing ${index + 1} of ${files.length}: ${file.name}`;
      try {
        await convert(file, settings, shrink, index);
        successful++;
      } catch (cause) {
        reportFailure(file.name, cause instanceof Error ? cause.message : 'This file could not be decoded or converted.');
      }
      progress.value = index + 1;
    }
    status.textContent = `${successful} of ${files.length} ${files.length === 1 ? 'photo' : 'photos'} ready. Save each result and give it a look before you send it anywhere.`;
  } finally {
    busy = false;
    controls.disabled = false;
    demo.disabled = false;
    progress.hidden = true;
  }
}

form.addEventListener('submit', event => {
  event.preventDefault();
  void run(Array.from(input('files').files || []));
});

clear.addEventListener('click', () => {
  if (busy) return;
  releaseResults();
  input('files').value = '';
  error.textContent = '';
    status.textContent = 'Files cleared. Pick another batch whenever you are ready.';
});

demo.addEventListener('click', async () => {
  if (busy) return;
  demo.disabled = true;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1800;
    canvas.height = 1200;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is not supported.');
    const gradient = context.createLinearGradient(0, 0, 1800, 1200);
    gradient.addColorStop(0, '#1e2b4f');
    gradient.addColorStop(1, '#c9de62');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 1800, 1200);
    context.fillStyle = '#ffffff';
    context.font = 'bold 120px sans-serif';
    context.fillText('Small file. Big plans.', 100, 620);
    canvas.toBlob(blob => {
      demo.disabled = false;
      if (blob) void run([new File([blob], 'sizeready-sample.png', { type: 'image/png' })]);
      else error.textContent = 'Sample generation failed.';
      canvas.width = 1;
      canvas.height = 1;
    }, 'image/png');
  } catch (cause) {
    demo.disabled = false;
    error.textContent = cause instanceof Error ? cause.message : 'Sample generation failed.';
  }
});
