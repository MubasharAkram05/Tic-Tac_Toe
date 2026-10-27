/**
 * Game page. Plays one game from a config object:
 *   { mode: 'computer' | 'friend' | 'campaign', size, p1Mark, difficulty, timer,
 *     // campaign levels:
 *     levelId, winLength, aiSkill, firstMove: 'player' | 'ai', moveLimit, timeLimit }
 *
 * Normal games: the player starts the first round, then the starter
 * alternates every round. Levels decide who starts from their config.
 */
import { $, createScope, renderIcons, escapeHTML, replayClass } from '../utils/dom.js';
import { ruleLabel } from '../utils/format.js';
import { winLength, ZOOM_FROM, PRICES, TIMER_FINAL_SECONDS } from '../config/constants.js';
import { getLevel, TOTAL_LEVELS } from '../config/levels.js';
import { createBoard } from '../core/board.js';
import { winFrom, other } from '../core/rules.js';
import { chooseMove } from '../core/ai.js';
import { MoveTimer } from '../core/timer.js';
import { runAI, cancelAI } from '../services/ai-runner.js';
import { app, saveApp, save, scoreBook } from '../services/storage.js';
import { finishLevel, finishNormalGame } from '../services/progress.js';
import { useBoost } from '../services/economy.js';
import { sound } from '../services/audio.js';
import { haptic } from '../services/haptics.js';
import { onEvent } from '../utils/events.js';
import { BoardView, miniMark } from '../components/board-view.js';
import { createModal } from '../components/modal.js';
import { anySheetOpen } from '../components/bottom-sheet.js';
import { showToast } from '../components/toast.js';
import { renderCoins, flyCoins } from '../components/coin-counter.js';
import { timerRingHTML, setRing, clearRing } from '../components/timer-ring.js';
import { fireConfetti } from '../components/confetti.js';
import { starSVG, campaignConfig } from '../components/level-popup.js';
import { navigate } from '../router.js';

export const appBar = { hidden: true };

let root, scope, view, cfg, level, st, timer, timerMove, pendingLeave;
let resultModal, levelResultModal, leaveModal;

/* ---------- Derived helpers ---------- */
const isCampaign = () => cfg.mode === 'campaign';
const vsAI = () => cfg.mode !== 'friend';
const p1Mark = () => cfg.p1Mark;
const p2Mark = () => other(cfg.p1Mark);
/** Who starts this round: levels use their config, normal games alternate. */
const starter = () => (isCampaign() ? (cfg.firstMove === 'ai' ? 'p2' : 'p1') : st.round % 2 === 0 ? 'p1' : 'p2');
const startMark = () => (starter() === 'p1' ? p1Mark() : p2Mark());
const markForMove = n => (n % 2 === 0 ? startMark() : other(startMark()));
const currentMark = () => markForMove(st.history.length);
const ownerOf = mark => (mark === p1Mark() ? 'p1' : 'p2');
const isAITurn = () => vsAI() && ownerOf(currentMark()) === 'p2';
const isDefaultYou = () => cfg.mode === 'computer' && app.names.solo === 'You';
const nameOf = who => {
  if (isCampaign()) return who === 'p1' ? save.data.profile.name : 'Machine';
  if (vsAI()) return who === 'p1' ? app.names.solo : 'Machine';
  return app.names[who];
};
const playerMoves = () => st.history.filter((_, n) => ownerOf(markForMove(n)) === 'p1').length;
const scores = () => scoreBook(cfg.mode, isCampaign() ? 'L' + cfg.levelId : cfg.size);
const timerSeconds = () => (isCampaign() ? cfg.timeLimit : cfg.timer) || 0;
const avatarOf = who => $(`.player-card[data-who="${who}"] .avatar`, root);
const inProgress = () => st && st.history.length > 0 && !st.over;
const exitRoute = () => (isCampaign() ? '#/levels' : '#/home');

/* =========================================================================
   Mount / unmount
   ========================================================================= */
export function mount(el, params, config) {
  if (!config) { navigate('#/home', { replace: true }); return; }
  root = el;
  scope = createScope();
  st = { round: 0 };
  el.innerHTML = template();
  renderIcons(el);
  view = new BoardView({ area: $('.board-area', el), onCellTap: tryPlace });
  buildModals();

  scope.on(el, 'click', onClick);
  // Timer pauses in the background and while a sheet (settings) is open
  scope.on(document, 'visibilitychange', () => (document.hidden ? pauseTimer() : resumeTimer()));
  scope.add(onEvent('sheet', ({ open }) => (open ? pauseTimer() : resumeTimer())));
  scope.add(onEvent('progress', () => { if (root && isCampaign()) renderExtras(); }));

  loadConfig(config);
  startRound();
}

export function unmount() {
  stopTimer();
  cancelAI();
  if (st) st.aiToken = (st.aiToken || 0) + 1;
  if (view) view.destroy();
  [resultModal, levelResultModal, leaveModal].forEach(m => m && m.destroy());
  if (scope) scope.dispose();
  root = view = resultModal = levelResultModal = leaveModal = null;
}

/** Router asks before leaving: confirm only if a game is in progress. */
export function beforeLeave(proceed) {
  if (!inProgress()) return true;
  pendingLeave = proceed;
  pauseTimer();
  leaveModal.open();
  return false;
}

function loadConfig(config) {
  cfg = { ...config };
  level = isCampaign() ? getLevel(cfg.levelId) : null;
  if (isCampaign()) {
    cfg.p1Mark = 'X';
    if (winLength(cfg.size) !== cfg.winLength) throw new Error(`winLength ${cfg.winLength} does not match the ${cfg.size}x${cfg.size} rule`);
    cfg.difficulty = cfg.aiSkill;
  }
}

function template() {
  return `
    <header class="game-bar">
      <button class="icon-btn" data-act="back" aria-label="Back"><i data-lucide="arrow-left"></i></button>
      <div class="game-bar-center">
        <div class="turn-pill glass" aria-live="polite"></div>
        <span class="rule-chip"></span>
      </div>
      <button class="icon-btn" data-go="#/settings" aria-label="Settings"><i data-lucide="settings"></i></button>
    </header>
    <div class="players">
      ${['p1', 'p2'].map(who => `
        <div class="player-card glass${who === 'p2' ? ' right' : ''}" data-who="${who}">
          <div class="avatar"><span class="av"></span>${timerRingHTML()}<span class="badge"></span></div>
          <div class="pinfo"><span class="pname"></span><span class="pscore">0</span></div>
        </div>${who === 'p1' ? '<div class="draws glass"><span>Draw</span><b class="score-draw">0</b></div>' : ''}`).join('')}
    </div>
    <div class="status-line" aria-live="polite"><span class="dots-anim"><i></i><i></i><i></i></span><span class="status-text"></span></div>
    <div class="board-area">
      <div class="viewport"><div class="board" role="grid" aria-label="Game board"></div></div>
      <div class="zoom-hint" role="status"></div>
    </div>
    <div class="actions">
      <button class="btn3d ghost" data-act="undo"><i data-lucide="undo-2"></i>Undo<span class="price-chip" data-price="undo" hidden></span></button>
      <button class="btn3d ghost" data-act="hint" hidden><i data-lucide="lightbulb"></i>Hint<span class="price-chip" data-price="hint"></span></button>
      <button class="btn3d ghost" data-act="restart"><i data-lucide="rotate-ccw"></i>Restart</button>
    </div>`;
}

function onClick(e) {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const act = b.dataset.act;
  if (act === 'back') { sound.click(); haptic(8); navigate(exitRoute()); }
  if (act === 'undo') undo();
  if (act === 'hint') hint();
  if (act === 'restart') { sound.click(); haptic(12); startRound(); }
}

/* =========================================================================
   Round flow
   ========================================================================= */
function startRound() {
  cancelAI();
  stopTimer();
  resultModal.close();
  levelResultModal.close();
  st = { round: st.round, board: createBoard(cfg.size), history: [], over: false, thinking: false, aiToken: (st.aiToken || 0) + 1, usedHelp: false, timedOut: false, hintCell: -1 };
  view.build(cfg.size);
  $('.rule-chip', root).textContent = ruleLabel(cfg.size);
  $('.rule-chip', root).setAttribute('aria-label', `${cfg.size} by ${cfg.size}, ${winLength(cfg.size)} in a row`);
  renderPlayers();
  renderExtras();
  renderTurn();
  if (cfg.size >= ZOOM_FROM && !app.flags.zoomHint) {
    app.flags.zoomHint = true;
    saveApp();
    view.showZoomHint();
  }
  if (isAITurn()) scheduleAI();
}

function place(i) {
  view.clearHighlight();
  const mark = currentMark();
  st.board[i] = mark;
  st.history.push(i);
  view.paint(i, mark, true);
  view.markLast(i);
  sound.tap(mark);
  haptic(12);
  const line = winFrom(st.board, cfg.size, i); // O(k): checks from the last move only
  if (line) return endGame(mark, line);
  if (st.history.length === st.board.length) return endGame(null, null);
  if (outOfMoves()) return endGame(null, null, 'moves');
  renderTurn();
  if (isAITurn()) scheduleAI();
}

/** Places a mark if this cell can be played right now. Returns true if it did. */
function tryPlace(i) {
  if (!st || st.over || st.thinking || st.board[i] || isAITurn()) return false;
  place(i);
  return true;
}

/** Shows "Thinking...", then asks the AI after a short delay so the last mark finishes drawing. */
function scheduleAI() {
  st.thinking = true;
  renderTurn();
  const token = ++st.aiToken;
  scope.timeout(() => {
    if (!root || token !== st.aiToken || st.over) return;
    runAI(st.board, cfg.size, p2Mark(), cfg.difficulty, move => {
      if (!root || token !== st.aiToken || st.over) return;
      st.thinking = false;
      place(move);
      view.ensureVisible(move);
    });
  }, 60);
}

function outOfMoves() {
  if (!isCampaign() || !cfg.moveLimit) return false;
  const lastByPlayer = ownerOf(markForMove(st.history.length - 1)) === 'p1';
  return lastByPlayer && playerMoves() >= cfg.moveLimit;
}

function endGame(mark, line, reason) {
  st.over = true;
  st.thinking = false;
  stopTimer();
  const s = scores();
  let outcome, winnerWho = null;
  if (mark) {
    winnerWho = ownerOf(mark);
    s[winnerWho]++;
    outcome = vsAI() && winnerWho === 'p2' ? 'lose' : 'win';
    view.showWin(line, mark);
  } else {
    s.draw++;
    outcome = 'draw';
  }
  saveApp();
  renderPlayers();
  renderTurn();
  replayClass(winnerWho ? $(`.player-card[data-who="${winnerWho}"] .pscore`, root) : $('.score-draw', root), 'bump');

  if (outcome === 'win') { sound.win(); haptic([30, 40, 60]); }
  else if (outcome === 'lose') { sound.lose(); haptic(90); }
  else { sound.draw(); haptic([20, 30, 20]); }

  // Progress: campaign rewards right away, stats for the other modes
  let levelResult = null;
  if (isCampaign()) {
    levelResult = finishLevel(level, { outcome, reason, playerMoves: playerMoves(), usedHelp: st.usedHelp, timedOut: st.timedOut, moveLimit: cfg.moveLimit });
  } else {
    const result = cfg.mode === 'friend' ? (winnerWho === 'p1' ? 'win' : winnerWho === 'p2' ? 'lose' : 'draw') : outcome;
    finishNormalGame(cfg.mode, result);
  }

  const token = st.aiToken;
  scope.timeout(() => {
    if (!root || token !== st.aiToken || !st.over) return;
    if (levelResult) showLevelResult(levelResult); else showResult(outcome, winnerWho);
  }, 750);
}

/* ---------- Undo: 1 move vs a friend, back to before your last move vs the computer ---------- */
function canUndo() {
  if (!st || st.over || !st.history.length) return false;
  if (!vsAI()) return true;
  return st.history.some((_, n) => ownerOf(markForMove(n)) === 'p1');
}
function undo() {
  if (!canUndo()) return;
  if (isCampaign()) { // levels: an undo costs a token or coins and removes the 3-star chance
    if (!useBoost('undo', PRICES.undo)) { needCoins(PRICES.undo, 'an undo'); return; }
    st.usedHelp = true;
    renderExtras();
  }
  cancelAI();
  stopTimer();
  st.aiToken++;
  st.thinking = false;
  let keep = st.history.length - 1;
  if (vsAI()) while (keep >= 0 && ownerOf(markForMove(keep)) !== 'p1') keep--;
  st.history.splice(keep).forEach(i => { st.board[i] = null; view.paint(i, null, false); });
  view.markLast(st.history[st.history.length - 1]);
  sound.click(); haptic(10);
  renderTurn();
}

/* ---------- Hint (levels only) ---------- */
function hint() {
  if (!isCampaign() || st.over || st.thinking || isAITurn()) return;
  if (!useBoost('hint', PRICES.hint)) { needCoins(PRICES.hint, 'a hint'); return; }
  st.usedHelp = true;
  renderExtras();
  sound.click();
  const len = st.history.length;
  runAI(st.board.slice(), cfg.size, p1Mark(), 'hard', move => {
    if (!root || st.history.length !== len || st.over || move === undefined) return;
    view.highlight(move);
    view.ensureVisible(move);
  });
}

function needCoins(price, what) {
  showToast(`Need ${price - save.data.coins} more coins for ${what}`, 'coins');
  sound.error(); haptic(40);
}

/* =========================================================================
   Move timer: timestamp based, ring around the active player's avatar
   ========================================================================= */
function syncTimer() {
  const secs = timerSeconds();
  if (!secs || st.over || st.thinking || isAITurn()) { stopTimer(); return; }
  if (timer && timerMove === st.history.length) return; // already running for this move
  startTimer(secs);
}

function startTimer(secs) {
  stopTimer();
  timerMove = st.history.length;
  const who = ownerOf(currentMark()), av = avatarOf(who);
  let lastSecond = null;
  timer = new MoveTimer({
    seconds: secs,
    onTick: (ms, fraction) => {
      setRing(av, fraction, ms);
      const s = Math.ceil(ms / 1000);
      if (s !== lastSecond) {
        lastSecond = s;
        if (s > 0 && s <= TIMER_FINAL_SECONDS) { sound.tick(); haptic(8); } // last seconds: tick + light buzz
      }
    },
    onExpire: () => onTimeout(),
  });
  timer.start();
  if (document.hidden || anySheetOpen()) timer.pause();
}

function stopTimer() {
  if (timer) timer.stop();
  timer = null;
  timerMove = -1;
  if (root) ['p1', 'p2'].forEach(w => clearRing(avatarOf(w)));
}
function pauseTimer() { if (timer) timer.pause(); }
function resumeTimer() {
  if (timer && !document.hidden && !anySheetOpen() && !(leaveModal && leaveModal.isOpen())) timer.resume();
}

/** Time's up: a random move is placed for that player. In levels this also costs the 3rd star. */
function onTimeout() {
  stopTimer();
  if (!root || st.over || st.thinking || isAITurn()) return;
  showToast("Time's up!", 'timer');
  if (isCampaign()) st.timedOut = true;
  const move = chooseMove(st.board, cfg.size, currentMark(), 'easy');
  tryPlace(move);
}

/* =========================================================================
   Rendering
   ========================================================================= */
function renderPlayers() {
  const s = scores();
  ['p1', 'p2'].forEach(who => {
    const card = $(`.player-card[data-who="${who}"]`, root);
    const mark = who === 'p1' ? p1Mark() : p2Mark(), name = nameOf(who);
    card.classList.toggle('mark-x', mark === 'X');
    card.classList.toggle('mark-o', mark === 'O');
    const nameEl = card.querySelector('.pname');
    nameEl.textContent = name;
    nameEl.title = name;
    card.querySelector('.pscore').textContent = s[who];
    card.querySelector('.badge').innerHTML = miniMark(mark);
    const av = card.querySelector('.av');
    if (vsAI() && who === 'p2') av.innerHTML = '<i data-lucide="monitor"></i>';
    else if (isCampaign()) av.innerHTML = `<i data-lucide="${save.data.equipped.avatar}"></i>`;
    else if (isDefaultYou()) av.innerHTML = '<i data-lucide="user"></i>';
    else av.textContent = name.charAt(0).toUpperCase();
  });
  $('.score-draw', root).textContent = s.draw;
  renderIcons(root);
}

function turnLabel() {
  if (st.over) return 'Game over';
  const who = ownerOf(currentMark());
  if (vsAI() && who === 'p2') return "Machine's turn";
  if (isDefaultYou()) return 'Your turn';
  return `${nameOf(who)}'s turn`;
}

function statusText() {
  if (st.thinking) return 'Thinking...';
  if (!isCampaign()) return '';
  const pm = playerMoves();
  return `Level ${cfg.levelId} · ${cfg.moveLimit ? `Moves ${pm}/${cfg.moveLimit}` : `Moves ${pm}`}`;
}

function renderTurn() {
  const mark = currentMark(), who = ownerOf(mark);
  const pill = $('.turn-pill', root);
  pill.innerHTML = (st.over ? '' : miniMark(mark)) + `<span class="label">${escapeHTML(turnLabel())}</span>`;
  replayClass(pill, 'swap');
  ['p1', 'p2'].forEach(w => $(`.player-card[data-who="${w}"]`, root).classList.toggle('active', !st.over && who === w));
  $('.status-line', root).classList.toggle('thinking', st.thinking);
  $('.status-text', root).textContent = statusText();
  view.setLocked(st.thinking || st.over);
  $('[data-act="undo"]', root).disabled = !canUndo();
  syncTimer();
}

/** Hint button + price chips are only shown in levels. */
function renderExtras() {
  const on = isCampaign(), inv = save.data.inventory;
  const chip = (kind, price) => (inv[kind] > 0 ? ` ×${inv[kind]}` : `<i data-lucide="coins"></i>${price}`);
  $('[data-act="hint"]', root).hidden = !on;
  $('[data-price="undo"]', root).hidden = !on;
  $('.actions', root).classList.toggle('has-hint', on);
  if (on) {
    $('[data-price="hint"]', root).innerHTML = chip('hint', PRICES.hint);
    $('[data-price="undo"]', root).innerHTML = chip('undo', PRICES.undo);
    renderIcons($('.actions', root));
  }
}

/* =========================================================================
   Popups: normal result, level result, leave confirm
   ========================================================================= */
function buildModals() {
  resultModal = createModal({
    id: 'resultModal', labelledBy: 'resultTitle', dismissible: false,
    html: `
      <div class="result-icon"></div>
      <h2 id="resultTitle"></h2>
      <p class="result-sub"></p>
      <div class="modal-actions">
        <button class="btn3d" data-r="again" data-autofocus><i data-lucide="rotate-ccw"></i>Play Again</button>
        <button class="btn3d ghost" data-r="home"><i data-lucide="house"></i>Home</button>
      </div>`,
  });
  resultModal.el.addEventListener('click', e => {
    const b = e.target.closest('[data-r]');
    if (!b) return;
    sound.click();
    resultModal.close();
    if (b.dataset.r === 'again') { st.round++; startRound(); } // next round: the other side starts
    else navigate('#/home');
  });

  levelResultModal = createModal({
    id: 'levelResultModal', labelledBy: 'lrTitle', dismissible: false,
    html: `
      <div class="cm-top"><span class="coin-pill" data-coin-pill><i data-lucide="coins"></i><span class="coin-amt">0</span></span></div>
      <div class="cm-stars"></div>
      <div class="result-icon lose cm-fail" hidden><i data-lucide="frown"></i></div>
      <h2 id="lrTitle"></h2>
      <p class="result-sub"></p>
      <div class="cm-rewards"></div>
      <div class="modal-actions cm-actions"></div>`,
  });
  levelResultModal.el.addEventListener('click', e => {
    const b = e.target.closest('[data-cm]');
    if (!b) return;
    sound.click();
    const act = b.dataset.cm, n = cfg.levelId;
    levelResultModal.close();
    if (act === 'next' && n < TOTAL_LEVELS) { loadConfig(campaignConfig(Math.min(n + 1, save.data.unlockedLevel))); startRound(); }
    else if (act === 'retry') startRound();
    else navigate('#/levels');
  });

  leaveModal = createModal({
    id: 'leaveModal', role: 'alertdialog', labelledBy: 'leaveTitle',
    html: `
      <div class="result-icon warn"><i data-lucide="log-out"></i></div>
      <h2 id="leaveTitle">Leave game?</h2>
      <p class="result-sub">This game is still going. Your progress will be lost.</p>
      <div class="modal-actions two">
        <button class="btn3d ghost" data-l="stay" data-autofocus>Stay</button>
        <button class="btn3d danger" data-l="go">Leave</button>
      </div>`,
  });
  leaveModal.el.addEventListener('click', e => {
    const b = e.target.closest('[data-l]');
    if (!b) return;
    sound.click();
    leaveModal.close();
    if (b.dataset.l === 'go') {
      const go = pendingLeave;
      pendingLeave = null;
      st.over = true; // nothing left to protect
      if (go) go(); else navigate(exitRoute(), { force: true });
    } else {
      pendingLeave = null;
      resumeTimer();
    }
  });
}

function showResult(outcome, winnerWho) {
  const m = resultModal, icon = $('.result-icon', m.el);
  let title, sub, iconName;
  if (outcome === 'draw') { title = 'Draw!'; sub = 'Nobody wins this round.'; iconName = 'handshake'; }
  else if (outcome === 'lose') { title = isDefaultYou() ? 'You Lose' : 'Machine Wins!'; sub = 'The machine got you this time.'; iconName = 'frown'; }
  else if (vsAI()) { title = isDefaultYou() ? 'You Win!' : `${nameOf('p1')} Wins!`; sub = 'Great moves. You beat the machine.'; iconName = 'trophy'; }
  else { title = `${nameOf(winnerWho)} Wins!`; sub = 'Nice game. Ready for another?'; iconName = 'trophy'; }
  icon.className = 'result-icon ' + outcome;
  icon.innerHTML = `<i data-lucide="${iconName}"></i>`;
  renderIcons(icon);
  $('#resultTitle').textContent = title;
  $('.result-sub', m.el).textContent = sub;
  m.card.classList.remove('shake');
  m.open();
  if (outcome === 'win') fireConfetti();
  if (outcome === 'lose') scope.timeout(() => replayClass(m.card, 'shake'), 220);
}

function showLevelResult(r) {
  const m = levelResultModal, n = cfg.levelId;
  const starsEl = $('.cm-stars', m.el), rewards = $('.cm-rewards', m.el), actions = $('.cm-actions', m.el);
  $('.cm-fail', m.el).hidden = r.won;
  starsEl.hidden = !r.won;
  m.card.classList.remove('shake');
  let coinsBefore = save.data.coins;
  if (r.won) {
    coinsBefore = r.before;
    starsEl.innerHTML = [0, 1, 2].map(i => starSVG(i < r.stars, i < r.stars ? `star-pop s${i}` : '')).join('');
    for (let i = 0; i < r.stars; i++) scope.timeout(() => sound.star(i), 250 + i * 220);
    $('#lrTitle').textContent = `Level ${n} clear!`;
    $('.result-sub', m.el).textContent = r.stars === 3 ? `Perfect! Won in ${r.playerMoves} moves.`
      : r.stars === 2 ? (r.timedOut ? 'Time ran out once, so no 3rd star.' : `Won in ${r.playerMoves} moves. No undo or hint for the 3rd star.`)
      : `Win in ${r.limit} moves or fewer for more stars.`;
    rewards.innerHTML =
      `<div><span>${r.first ? (r.boss ? 'Boss first clear ×3' : 'First clear') : 'Replay'}</span><b>+${r.base} <i data-lucide="coins"></i></b></div>` +
      (r.starCoins ? `<div><span>New stars ×${r.newStars}</span><b>+${r.starCoins} <i data-lucide="coins"></i></b></div>` : '') +
      `<div><span>XP${r.levelUp ? ' · Level up!' : ''}</span><b>+${r.xp} XP</b></div>`;
    const next = n < TOTAL_LEVELS ? '<button class="btn3d" data-cm="next" data-autofocus><i data-lucide="play"></i>Next level</button>' : '';
    actions.className = 'modal-actions cm-actions ' + (next ? 'three' : 'two');
    actions.innerHTML = next + '<button class="btn3d ghost" data-cm="retry"><i data-lucide="rotate-ccw"></i>Replay</button><button class="btn3d ghost" data-cm="back"><i data-lucide="map"></i>Levels</button>';
    fireConfetti();
  } else {
    $('#lrTitle').textContent = 'Level failed';
    $('.result-sub', m.el).textContent = r.reason === 'moves' ? 'Out of moves. Try to win faster.'
      : r.reason === 'draw' ? "It's a draw. You need a win to clear the level."
      : 'The machine won this time.';
    rewards.innerHTML = '';
    actions.className = 'modal-actions cm-actions two';
    actions.innerHTML = '<button class="btn3d ghost" data-cm="back"><i data-lucide="map"></i>Back</button><button class="btn3d" data-cm="retry" data-autofocus><i data-lucide="rotate-ccw"></i>Retry</button>';
    scope.timeout(() => replayClass(m.card, 'shake'), 220);
  }
  renderIcons(m.el);
  m.el.querySelectorAll('.coin-amt').forEach(a => { a.textContent = coinsBefore; });
  m.open();
  if (r.won) {
    const pill = $('[data-coin-pill]', m.el);
    scope.timeout(() => {
      flyCoins(rewards, r.base + r.starCoins, pill);
      scope.timeout(() => renderCoins(coinsBefore), 300);
    }, 900);
  } else {
    renderCoins();
  }
}
