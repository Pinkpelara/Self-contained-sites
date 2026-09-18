export function fitDimensions(width, height, maxWidth, maxHeight) {
  if ([width, height, maxWidth, maxHeight].some(value => !Number.isInteger(value) || value < 1)) throw new Error('Dimensions must be positive whole numbers.');
  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  return { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)) };
}

export function validateSettings(targetKB, maxWidth, maxHeight) {
  if (!Number.isInteger(targetKB) || targetKB < 1 || targetKB > 20000) throw new Error('Choose a whole-number budget from 1 to 20,000 KB.');
  if ([maxWidth, maxHeight].some(value => !Number.isInteger(value) || value < 1 || value > 6000)) throw new Error('Choose whole-number dimensions from 1 to 6,000 pixels.');
  return { budget: targetKB * 1000, maxWidth, maxHeight };
}

export function validateFiles(files) {
  if (!files.length || files.length > 20) throw new Error('Choose between 1 and 20 images.');
  let total = 0;
  for (const file of files) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Only JPG, PNG, and WebP files are supported.');
    if (file.size === 0 || file.size > 20000000) throw new Error('Each image must contain data and be no larger than 20 MB.');
    total += file.size;
  }
  if (total > 100000000) throw new Error('Keep each batch at or below 100 MB.');
}

export function downloadName(name, index) {
  const stem = name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'image';
  return `${String(index + 1).padStart(2, '0')}-${stem}-ready.jpg`;
}

export async function fitBudget(width, height, budget, allowShrink, encode) {
  if (![width, height, budget].every(value => Number.isInteger(value) && value > 0)) throw new Error('Invalid image size or byte budget.');
  for (let attempt = 0; attempt < 64; attempt++) {
    const highBlob = await encode(width, height, 0.94);
    if (highBlob.size <= budget) return { blob: highBlob, width, height, quality: 0.94 };
    const lowBlob = await encode(width, height, 0.30);
    if (lowBlob.size <= budget) {
      let lower = 0.30;
      let upper = 0.94;
      let best = lowBlob;
      for (let step = 0; step < 9; step++) {
        const quality = (lower + upper) / 2;
        const candidate = await encode(width, height, quality);
        if (candidate.size <= budget) {
          best = candidate;
          lower = quality;
        } else {
          upper = quality;
        }
      }
      return { blob: best, width, height, quality: lower };
    }
    if (!allowShrink || (width === 1 && height === 1)) throw new Error('Cannot meet this budget at the allowed quality and dimensions. Increase the KB limit or allow smaller dimensions.');
    width = Math.max(1, Math.floor(width * 0.8));
    height = Math.max(1, Math.floor(height * 0.8));
  }
  throw new Error('Could not fit the image within the processing limit.');
}
