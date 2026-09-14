(() => {
'use strict';

const LOCK_KEY = 'scheduleapp.fixedGroup.v2';
const OLD_LOCK_KEY = 'scheduleapp.fixedGroup.v1';
const STYLE_ID = 'schedule-group-lock-style';

let fixedGroup = localStorage.getItem(LOCK_KEY) || localStorage.getItem(OLD_LOCK_KEY) || '';
let control = null;
let approvedValue = '';
let dialogOpen = false;
let applying = false;
let lastKnownGroup = '';

if (!document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #group-lock-modal {
      position:fixed;inset:0;z-index:7000;display:none;align-items:flex-end;justify-content:center;
      padding:14px;background:rgba(0,0,0,.62);backdrop-filter:blur(10px);box-sizing:border-box;
    }
    #group-lock-modal.open { display:flex; }
    .group-lock-sheet {
      width:100%;max-width:500px;padding:18px;border-radius:24px 24px 18px 18px;
      background:linear-gradient(180deg,#201728,#17121d);
      border:1px solid rgba(255,255,255,.09);box-shadow:0 -12px 45px rgba(0,0,0,.4);
    }
    .group-lock-head { display:flex;align-items:center;gap:10px;margin-bottom:13px; }
    .group-lock-icon { width:42px;height:42px;border-radius:13px;display:flex;align-items:center;justify-content:center;background:var(--accentSoft);font-size:21px; }
    .group-lock-title { font-size:16px;font-weight:800; }
    .group-lock-sub { margin-top:3px;color:#817987;font-size:11px;line-height:1.35; }
    .group-lock-group { margin:10px 0 13px;padding:11px 12px;border-radius:13px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.055);color:var(--accent);font-weight:800;text-align:center; }
    .group-lock-actions { display:grid;grid-template-columns:1fr 1.35fr;gap:8px; }
    .group-lock-btn { min-height:44px;border-radius:13px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.055);color:#d8d1dc;font-weight:700; }
    .group-lock-btn.primary { background:linear-gradient(135deg,var(--accent),var(--accent2));border-color:transparent;color:#fff; }
    #group-lock-indicator { display:none;margin:8px 0 0;padding:8px 10px;border-radius:11px;background:var(--accentSoft);border:1px solid var(--accentBorder);color:var(--accent);font-size:10px;font-weight:800;text-align:center; }
    #group-lock-indicator.on { display:block; }
  `;
  document.head.appendChild(style);
}

function readControl() {
  const direct = document.querySelector('#groupSelect, select[name="group"], select[data-role="group"], [data-group-select]');
  if (direct && direct.tagName === 'SELECT') return direct;

  const selects = Array.from(document.querySelectorAll('select'));
  return selects.find(s => {
    const texts = Array.from(s.options || []).map(o => o.textContent.trim());
    return texts.length >= 5 && texts.some(t => /\bм\/с\b|\bкласс\b|\bлаб\b|\bак\b/i.test(t));
  }) || null;
}

function optionsHaveGroup(value) {
  return !!control && Array.from(control.options || []).some(o => o.value === value || o.textContent.trim() === value);
}

function getSelectText(select) {
  if (!select) return '';
  return select.options?.[select.selectedIndex]?.textContent?.trim() || select.value || '';
}

function currentGroup() {
  if (typeof state !== 'undefined' && state.selectedGroup) return String(state.selectedGroup);
  return getSelectText(control);
}

function setSelectValue(value) {
  if (!control || !value) return false;
  const match = Array.from(control.options || []).find(o => o.value === value || o.textContent.trim() === value);
  if (!match) return false;
  control.value = match.value;
  return true;
}

function fireApprovedChange(value) {
  approvedValue = value;
  applying = true;
  if (typeof state !== 'undefined') state.selectedGroup = value;
  try {
    control?.dispatchEvent(new Event('change', { bubbles:true }));
  } catch (_) {}
  setTimeout(() => {
    approvedValue = '';
    applying = false;
  }, 350);
}

function syncIndicator() {
  const host = control?.closest('.select-box') || control?.parentElement;
  if (!host) return;
  let indicator = document.getElementById('group-lock-indicator');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.id = 'group-lock-indicator';
    host.appendChild(indicator);
  }
  indicator.classList.toggle('on', !!fixedGroup);
  indicator.textContent = fixedGroup ? `📌 Группа зафиксирована: ${fixedGroup}` : '';
}

function createModal() {
  let m = document.getElementById('group-lock-modal');
  if (m) return m;
  m = document.createElement('div');
  m.id = 'group-lock-modal';
  m.innerHTML = `<div class="group-lock-sheet">
    <div class="group-lock-head"><div class="group-lock-icon">📌</div><div><div class="group-lock-title" id="gl-title"></div><div class="group-lock-sub" id="gl-sub"></div></div></div>
    <div class="group-lock-group" id="gl-group"></div>
    <div class="group-lock-actions"><button class="group-lock-btn" id="gl-no" type="button"></button><button class="group-lock-btn primary" id="gl-yes" type="button"></button></div>
  </div>`;
  document.body.appendChild(m);
  m.addEventListener('click', e => {
    if (e.target !== m || !dialogOpen) return;
    closeDialog(false);
  });
  return m;
}

let pendingAction = null;

function closeDialog(ok) {
  const m = document.getElementById('group-lock-modal');
  if (m) m.classList.remove('open');
  dialogOpen = false;
  const action = pendingAction;
  pendingAction = null;
  if (action) action(!!ok);
}

function ask(kind, requested, previous, done) {
  const m = createModal();
  dialogOpen = true;
  pendingAction = done;
  m.querySelector('#gl-title').textContent = kind === 'relock' ? 'Пере зафиксировать группу?' : 'Зафиксировать группу?';
  m.querySelector('#gl-sub').textContent = kind === 'relock'
    ? `Сейчас закреплена «${previous}». Новая группа заменит её.`
    : 'После фиксации приложение будет автоматически открывать эту группу.';
  m.querySelector('#gl-group').textContent = requested;
  m.querySelector('#gl-no').textContent = kind === 'relock' ? `Оставить ${previous}` : 'Нет';
  m.querySelector('#gl-yes').textContent = kind === 'relock' ? 'Да, пере зафиксировать' : 'Да';
  m.querySelector('#gl-no').onclick = () => closeDialog(false);
  m.querySelector('#gl-yes').onclick = () => closeDialog(true);
  m.classList.add('open');
}

function restorePrevious(previous) {
  if (!previous || !setSelectValue(previous)) return;
  if (typeof state !== 'undefined') state.selectedGroup = previous;
  fireApprovedChange(previous);
}

function requestGroup(requested) {
  if (!requested || dialogOpen || applying) return;
  const previous = currentGroup();
  if (!previous || requested === previous) return;

  setSelectValue(previous);
  if (typeof state !== 'undefined') state.selectedGroup = previous;
  lastKnownGroup = previous;

  if (fixedGroup) {
    ask('relock', requested, fixedGroup, ok => {
      if (!ok) {
        restorePrevious(fixedGroup);
        return;
      }
      fixedGroup = requested;
      localStorage.setItem(LOCK_KEY, fixedGroup);
      localStorage.setItem(OLD_LOCK_KEY, fixedGroup);
      if (setSelectValue(requested)) {
        if (typeof state !== 'undefined') state.selectedGroup = requested;
        fireApprovedChange(requested);
      }
      syncIndicator();
    });
  } else {
    ask('lock', requested, previous, ok => {
      if (!ok) {
        restorePrevious(previous);
        return;
      }
      fixedGroup = requested;
      localStorage.setItem(LOCK_KEY, fixedGroup);
      localStorage.setItem(OLD_LOCK_KEY, fixedGroup);
      if (setSelectValue(requested)) {
        if (typeof state !== 'undefined') state.selectedGroup = requested;
        fireApprovedChange(requested);
      }
      syncIndicator();
    });
  }
}

function isGroupSelect(target) {
  if (!target) return false;
  if (control && target === control) return true;
  if (target.tagName !== 'SELECT') return false;
  const texts = Array.from(target.options || []).map(o => o.textContent.trim());
  return texts.length >= 5 && texts.some(t => /\bм\/с\b|\bкласс\b|\bлаб\b|\bак\b/i.test(t));
}

function onChangeCapture(event) {
  if (!isGroupSelect(event.target)) return;
  if (approvedValue && getSelectText(event.target) === approvedValue) return;
  if (applying || dialogOpen) {
    event.stopImmediatePropagation();
    event.preventDefault();
    return;
  }
  const requested = getSelectText(event.target);
  event.stopImmediatePropagation();
  event.preventDefault();
  if (control !== event.target) control = event.target;
  requestGroup(requested);
}

document.addEventListener('change', onChangeCapture, true);

function applyFixedGroup() {
  const found = readControl();
  if (found) control = found;
  if (!control) return;

  const available = !!fixedGroup && optionsHaveGroup(fixedGroup);
  syncIndicator();
  if (!available || typeof state === 'undefined' || !state.groups?.includes(fixedGroup)) return;

  if (String(state.selectedGroup) !== fixedGroup || getSelectText(control) !== fixedGroup) {
    setSelectValue(fixedGroup);
    if (typeof state !== 'undefined') state.selectedGroup = fixedGroup;
    fireApprovedChange(fixedGroup);
  }
}

function attach() {
  const found = readControl();
  if (found) control = found;
  if (!control) return;
  syncIndicator();
  if (!dialogOpen) applyFixedGroup();
}

window.addEventListener('scheduleapp:data-ready', () => setTimeout(attach, 0));
window.addEventListener('load', () => setTimeout(attach, 0));
setInterval(attach, 500);

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach);
else attach();

})();
