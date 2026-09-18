import { planCuts } from './planner.js';

const form = document.querySelector('form');
const output = document.querySelector('#output');
const error = document.querySelector('#error');
const printButton = document.querySelector('#print');

form?.addEventListener('submit', event => {
  event.preventDefault();
  if (!(form instanceof HTMLFormElement) || !output || !error) return;
  error.textContent = '';
  try {
    const data = new FormData(form);
    const stock = Number(data.get('stock'));
    const kerf = Number(data.get('kerf'));
    const unit = String(data.get('unit'));
    const lines = String(data.get('pieces')).trim().split(/\n+/);
    const pieces = [];
    for (const line of lines) {
      const match = line.trim().match(/^(\d+(?:\.\d+)?)\s*(?:[x×]\s*(\d+))?$/i);
      if (!match) throw new Error('Use one length per line, optionally followed by x and a quantity, such as 24 x 4.');
      const quantity = Number(match[2] || 1);
      if (quantity < 1 || quantity > 500 || pieces.length + quantity > 500) throw new Error('Use quantities from 1 to 500, with no more than 500 pieces total.');
      pieces.push(...Array(quantity).fill(Number(match[1])));
    }
    const result = planCuts(stock, kerf, pieces);
    output.replaceChildren();
    const heading = document.createElement('h2');
    heading.textContent = `${result.boards.length} ${result.boards.length === 1 ? 'board' : 'boards'} for your cut list`;
    output.append(heading);
    const stats = document.createElement('p');
    stats.className = 'stats';
    stats.textContent = `${result.efficiency.toFixed(1)}% of the wood ends up in parts, ${pieces.length} ${pieces.length === 1 ? 'part' : 'parts'} total, ${result.waste.toFixed(2)} ${unit} left as offcuts and dust`;
    output.append(stats);
    result.boards.forEach((board, index) => {
      const section = document.createElement('section');
      section.className = 'board';
      const label = document.createElement('h3');
      label.textContent = `Board ${index + 1} · ${stock} ${unit}`;
      const bar = document.createElement('div');
      bar.className = 'bar';
      bar.setAttribute('role', 'img');
      bar.setAttribute('aria-label', `Board ${index + 1} layout: ${board.pieces.join(', ')} ${unit}, ${board.remaining.toFixed(2)} ${unit} left`);
      const kerfs = board.pieces.length > 1 ? board.pieces.length - 1 : 0;
      const kerfNote = document.createElement('span');
      kerfNote.className = 'sr-only';
      kerfNote.textContent = `Cuts left to right: ${board.pieces.join(', ')}. Your blade takes ${kerfs} kerf${kerfs === 1 ? '' : 's'} at ${kerf} ${unit}.`;
      bar.append(kerfNote);
      board.pieces.forEach(length => {
        const segment = document.createElement('span');
        segment.style.flexGrow = String(length);
        segment.textContent = String(length);
        bar.append(segment);
      });
      const remainder = document.createElement('span');
      remainder.className = 'remainder';
      remainder.style.flexGrow = String(board.remaining);
      bar.append(remainder);
      const detail = document.createElement('p');
      detail.textContent = `Cuts left to right: ${board.pieces.join(', ')}. Your blade takes ${kerfs} kerf${kerfs === 1 ? '' : 's'} at ${kerf} ${unit}. Leftover on this board: ${board.remaining.toFixed(2)} ${unit}.`;
      section.append(label, bar, detail);
      output.append(section);
    });
    if (printButton instanceof HTMLButtonElement) printButton.disabled = false;
  } catch (cause) {
    error.textContent = cause instanceof Error ? cause.message : 'Please check your measurements.';
    output.replaceChildren();
    if (printButton instanceof HTMLButtonElement) printButton.disabled = true;
  }
});
printButton?.addEventListener('click', () => window.print());
if (form instanceof HTMLFormElement) form.requestSubmit();
