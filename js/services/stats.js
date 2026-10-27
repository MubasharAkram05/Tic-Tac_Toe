/**
 * Game statistics per mode. "all" collects games vs the machine
 * (vs Computer + Levels) and drives streak achievements.
 */
import { save } from './storage.js';
import { percent } from '../utils/format.js';

/** result is 'win' | 'lose' | 'draw' from Player 1's side. */
export function recordGame(mode, result) {
  const st = save.data.stats;
  [st[mode], mode === 'friend' ? null : st.all].forEach(s => {
    if (!s) return;
    s.played++;
    if (result === 'win') { s.wins++; s.streak++; s.best = Math.max(s.best, s.streak); }
    else { if (result === 'lose') s.losses++; else s.draws++; s.streak = 0; }
  });
  save.write();
}

/**
 * Stats for a profile tab: 'all' | 'computer' | 'friend' | 'campaign'.
 * "All" adds every mode together; its streaks come from games vs the machine.
 */
export function statsFor(tab) {
  const st = save.data.stats;
  let s;
  if (tab === 'all') {
    s = ['computer', 'friend', 'campaign'].reduce((acc, m) => {
      ['played', 'wins', 'losses', 'draws'].forEach(k => { acc[k] += st[m][k]; });
      return acc;
    }, { played: 0, wins: 0, losses: 0, draws: 0 });
    s.best = st.all.best;
    s.streak = st.all.streak;
  } else {
    s = { ...st[tab] };
  }
  s.winRate = percent(s.wins, s.wins + s.losses + s.draws);
  return s;
}
