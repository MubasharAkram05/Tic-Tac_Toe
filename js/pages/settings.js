/**
 * Settings: opens as a bottom sheet over the current page (route #/settings).
 * Theme, sound, vibration, default move timer, progress backup
 * (export / import code) and reset scores.
 */
import { $, renderIcons, setSeg, segHTML } from '../utils/dom.js';
import { timerLabel } from '../utils/format.js';
import { TIMER_OPTIONS } from '../config/constants.js';
import { app, saveApp, save } from '../services/storage.js';
import { setTheme, applyCosmetics } from '../services/theme.js';
import { sound } from '../services/audio.js';
import { haptic } from '../services/haptics.js';
import { emit } from '../utils/events.js';
import { createSheet } from '../components/bottom-sheet.js';
import { showToast } from '../components/toast.js';

let sheet = null, onClosed = null, pendingImport = null;

function build() {
  sheet = createSheet({
    id: 'settingsSheet', title: 'Settings',
    onClose: () => { const cb = onClosed; onClosed = null; if (cb) cb(); },
    body: `
      <div class="set-list">
        <div class="set-row set-block">
          <div class="set-top"><span class="ri"><i data-lucide="palette"></i></span><span class="rt">Theme<small>Auto follows the time of day</small></span></div>
          ${segHTML({ group: 'settings', key: 'theme', label: 'Theme', options: [{ val: 'auto', label: 'Auto' }, { val: 'light', label: 'Light' }, { val: 'dark', label: 'Dark' }] })}
        </div>
        <button type="button" class="set-row" role="switch" data-toggle="sound">
          <span class="ri"><i data-lucide="volume-2"></i></span><span class="rt">Sound<small>Tap, win and lose effects</small></span><span class="switch"></span>
        </button>
        <button type="button" class="set-row" role="switch" data-toggle="vibration">
          <span class="ri"><i data-lucide="vibrate"></i></span><span class="rt">Vibration<small>Haptic feedback on supported phones</small></span><span class="switch"></span>
        </button>
        <div class="set-row set-block">
          <div class="set-top"><span class="ri"><i data-lucide="timer"></i></span><span class="rt">Move timer<small>Default for vs Computer and vs Player</small></span></div>
          ${segHTML({ group: 'settings', key: 'timer', label: 'Move timer', options: TIMER_OPTIONS.map(s => ({ val: s, label: timerLabel(s) })) })}
        </div>
        <div class="set-row set-block" id="backupBlock">
          <div class="set-top"><span class="ri"><i data-lucide="hard-drive-download"></i></span><span class="rt">Progress backup<small>Save a code to restore coins, levels and items</small></span></div>
          <div class="two-btns">
            <button type="button" class="btn3d ghost" data-act="export"><i data-lucide="download"></i>Export</button>
            <button type="button" class="btn3d ghost" data-act="import-open"><i data-lucide="upload"></i>Import</button>
          </div>
          <div class="backup-box" data-box="export" hidden>
            <textarea class="code-box" id="exportCode" readonly aria-label="Your progress code"></textarea>
            <button type="button" class="btn3d small wide" data-act="copy"><i data-lucide="copy"></i>Copy code</button>
          </div>
          <div class="backup-box" data-box="import" hidden>
            <textarea class="code-box" id="importCode" placeholder="Paste your progress code here" aria-label="Progress code to import"></textarea>
            <div class="two-btns" data-box="import-confirm" hidden>
              <button type="button" class="btn3d ghost" data-act="import-cancel">Cancel</button>
              <button type="button" class="btn3d danger" data-act="import-yes">Replace progress</button>
            </div>
            <button type="button" class="btn3d small wide" data-act="import-check"><i data-lucide="upload"></i>Import code</button>
          </div>
          <div class="backup-msg" aria-live="polite"></div>
        </div>
        <div class="reset-box">
          <button type="button" class="btn3d danger wide" data-act="reset-scores"><i data-lucide="trash-2"></i>Reset all scores</button>
          <div class="reset-confirm" hidden>
            <p>Reset every score on every board? This can't be undone.</p>
            <div class="two-btns">
              <button type="button" class="btn3d ghost" data-act="reset-cancel">Cancel</button>
              <button type="button" class="btn3d danger" data-act="reset-yes">Reset</button>
            </div>
          </div>
          <div class="reset-done" aria-live="polite"></div>
        </div>
      </div>`,
  });
  sheet.el.addEventListener('click', onClick);
  $('#importCode').addEventListener('input', () => { pendingImport = null; showImportConfirm(false); msg(''); });
}

const box = name => sheet.el.querySelector(`[data-box="${name}"]`);
function msg(text, ok) {
  const m = sheet.el.querySelector('.backup-msg');
  m.textContent = text;
  m.className = 'backup-msg ' + (ok ? 'ok' : 'bad');
}
function showImportConfirm(on) {
  box('import-confirm').hidden = !on;
  sheet.el.querySelector('[data-act="import-check"]').hidden = on;
}
function resetBackup() {
  pendingImport = null;
  box('export').hidden = true;
  box('import').hidden = true;
  showImportConfirm(false);
  $('#importCode').value = '';
  msg('');
}
function hideResetConfirm() {
  sheet.el.querySelector('[data-act="reset-scores"]').hidden = false;
  sheet.el.querySelector('.reset-confirm').hidden = true;
}

function render() {
  sheet.el.querySelector('[data-toggle="sound"]').setAttribute('aria-checked', String(app.settings.sound));
  sheet.el.querySelector('[data-toggle="vibration"]').setAttribute('aria-checked', String(app.settings.vibration));
  setSeg(sheet.el.querySelector('.seg[data-key="theme"]'), app.settings.theme);
  setSeg(sheet.el.querySelector('.seg[data-key="timer"]'), app.settings.timer);
}

async function onClick(e) {
  const segBtn = e.target.closest('.seg button');
  if (segBtn) {
    const key = segBtn.parentElement.dataset.key;
    if (key === 'theme') setTheme(segBtn.dataset.val);
    if (key === 'timer') app.settings.timer = +segBtn.dataset.val;
    saveApp(); render(); sound.click(); haptic(8);
    return;
  }
  const t = e.target.closest('[data-toggle]');
  if (t) {
    const k = t.dataset.toggle;
    app.settings[k] = !app.settings[k];
    saveApp(); render();
    if (k === 'sound') sound.click(); else haptic(20);
    return;
  }
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const act = b.dataset.act;
  if (act === 'export') {
    resetBackup();
    $('#exportCode').value = save.exportCode();
    box('export').hidden = false;
    sound.click();
  }
  if (act === 'copy') {
    const area = $('#exportCode');
    try { await navigator.clipboard.writeText(area.value); msg('Copied! Keep it somewhere safe.', true); }
    catch (err) {
      area.select();
      try { document.execCommand('copy'); msg('Copied! Keep it somewhere safe.', true); } catch (e2) { msg('Select the code and copy it by hand.', false); }
    }
  }
  if (act === 'import-open') { resetBackup(); box('import').hidden = false; $('#importCode').focus(); }
  if (act === 'import-check') {
    const res = save.decode($('#importCode').value);
    if (res.error) { msg(res.error, false); sound.error(); return; }
    pendingImport = res.data;
    msg(`Code OK: level ${pendingImport.unlockedLevel}, ${pendingImport.coins} coins. This replaces your current progress.`, true);
    showImportConfirm(true);
  }
  if (act === 'import-cancel') resetBackup();
  if (act === 'import-yes' && pendingImport) {
    save.replace(pendingImport);
    resetBackup();
    applyCosmetics();
    emit('coins', { from: save.data.coins, to: save.data.coins });
    emit('progress');
    msg('Progress restored.', true);
    showToast('Progress restored', 'check');
  }
  if (act === 'reset-scores') {
    b.hidden = true;
    sheet.el.querySelector('.reset-confirm').hidden = false;
    sheet.el.querySelector('.reset-done').textContent = '';
    haptic(15);
  }
  if (act === 'reset-cancel') { sound.click(); hideResetConfirm(); }
  if (act === 'reset-yes') {
    app.scores = { computer: {}, friend: {}, campaign: {} };
    saveApp();
    hideResetConfirm();
    sheet.el.querySelector('.reset-done').textContent = 'All scores cleared';
    emit('progress');
    sound.click(); haptic([10, 30, 10]);
  }
}

/** Opens the settings sheet. onClose runs when the user closes it. */
export function open(params = {}, onClose) {
  if (!sheet) build();
  onClosed = onClose;
  render();
  resetBackup();
  hideResetConfirm();
  sheet.el.querySelector('.reset-done').textContent = '';
  renderIcons(sheet.el);
  sheet.open();
  if (params.section === 'backup') setTimeout(() => $('#backupBlock').scrollIntoView({ block: 'start', behavior: 'smooth' }), 300);
}

/** Closes without calling onClose (used when the route changes elsewhere). */
export function close() {
  if (!sheet || !sheet.isOpen()) return;
  onClosed = null;
  sheet.close();
}

/* Same page interface as the other pages (settings mounts as an overlay sheet). */
export const mount = (el, params, onClose) => open(params, onClose);
export const unmount = close;
