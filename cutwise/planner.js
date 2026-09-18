export function planCuts(stock, kerf, pieces) {
  if (!Number.isFinite(stock) || stock <= 0 || !Number.isFinite(kerf) || kerf < 0) throw new Error('Enter a positive board length and a non-negative blade width.');
  if (!pieces.length || pieces.length > 500 || pieces.some(length => !Number.isFinite(length) || length <= 0 || length > stock)) throw new Error('Enter 1–500 pieces, each greater than zero and no longer than the board.');
  const boards = [];
  for (const length of [...pieces].sort((a, b) => b - a)) {
    let board = boards.find(item => item.remaining + 1e-8 >= length + (item.pieces.length ? kerf : 0));
    if (!board) {
      board = { pieces: [], remaining: stock };
      boards.push(board);
    }
    board.remaining -= length + (board.pieces.length ? kerf : 0);
    board.pieces.push(length);
    if (Math.abs(board.remaining) < 1e-8) board.remaining = 0;
  }
  const used = pieces.reduce((sum, length) => sum + length, 0);
  return { boards, used, waste: boards.length * stock - used, efficiency: used / (boards.length * stock) * 100 };
}
