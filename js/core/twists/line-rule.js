/**
 * Line rule: which directions can win.
 *   layout.rule = 'straight'  rows and columns only (no diagonals)
 *   layout.rule = 'diagonal'  diagonals only (6x6 and up)
 */
export const id = 'lines';

export function setup(s, layout) {
  s.rule = layout.rule === 'diagonal' ? 'diagonal' : 'straight';
}

export function allowsDir(s, [dr, dc]) {
  const straight = dr === 0 || dc === 0;
  return s.rule === 'straight' ? straight : !straight;
}

/** A banned direction never makes a line; otherwise let the next hook (wrap) or the classic walk decide. */
export function getLineCells(s, start, dir) {
  return allowsDir(s, dir) ? null : [];
}
