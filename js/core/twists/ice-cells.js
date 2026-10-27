/**
 * Ice cells: frozen at the start, they melt (become playable) once the
 * game has had N moves in total.
 *   layout.ice = [{ i: cellIndex, melt: N }]   (N = 4..8)
 * A frozen cell holds no mark, so it also breaks lines until it melts.
 * With gravity it acts as a floor until it melts.
 */
export const id = 'ice';

export function setup(s, layout) {
  s.ice = {};
  (layout.ice || []).forEach(c => { s.ice[c.i] = c.melt; });
}

export const isFrozen = (s, i) => s.ice && s.ice[i] !== undefined && s.moves < s.ice[i];

export function isPlayable(s, i) {
  return !isFrozen(s, i);
}

export function afterMove(s, move, events) {
  for (const key of Object.keys(s.ice)) {
    if (s.moves >= s.ice[key]) {
      delete s.ice[key];
      events.push({ type: 'melt', cell: +key });
    }
  }
}

/** Moves left until cell i melts (0 = not frozen). */
export const meltsIn = (s, i) => (isFrozen(s, i) ? s.ice[i] - s.moves : 0);
