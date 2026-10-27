/**
 * Gravity: a tap anywhere in a column drops the mark to the lowest open
 * cell of that column, like Connect Four. The mark falls from the top and
 * stops on the board bottom, a mark, a blocked cell or a frozen cell.
 * Only on 5x5 and up.
 */
export const id = 'gravity';

export function setup(s) {
  s.gravity = true;
}

export function resolveMove(s, tapped, api) {
  const n = s.size, col = tapped % n;
  let land = -1;
  for (let r = 0; r < n; r++) {
    const i = r * n + col;
    if (!api.isOpen(s, i)) break;
    land = i;
  }
  return land;
}
