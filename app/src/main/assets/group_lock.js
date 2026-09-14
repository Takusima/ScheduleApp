(() => {
'use strict';

const LOCK_KEY = 'scheduleapp.fixedGroup.v1';
const STYLE_ID = 'schedule-group-lock-style';
let fixedGroup = localStorage.getItem(LOCK_KEY) || '';
let control = null;
let syncing = false;

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
  if (direct) return direct;
  const selects = Array.from(document.querySelectorAll('select'));
  return selects.find(s => {
    const texts = Array.from(s.options || []).map(o => o.textContent.trim());
    return texts.length >= 5 && texts.some(t => /\bм\/с\b|\bкласс\b|\bлаб\b|\bак\b/i.test(t));
  }) || null;
}

function currentValue() {
  if (typeof state !== 'undefined' && state.selectedGroup) return String(state.selectedGroup);
  return control?.value || '';
}

function setSelectValue(value) {
  if (!control || !value) return false;
  const options = Array.from(control.options || []);
  const match = options.find(o => o.value === value || o.textContent.trim() === value);
  if (!match) return false;
  control.value = match.value;
  return true;
}

function dispatchGroupChange() {
  if (!control) return;
  const ev = new Event('change', { bubbles:true });
  ev.__scheduleGroupLockApproved = true;
  control.dispatchEvent(ev);
}

function syncIndicator() {
  let indicator = document.getElementById('group-lock-indicator');
  const host = control?.closest('.select-box') || control?.parentElement;
  if (!host) return;
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.id = 'group-lock-indicator';
    host.appendChild(indicator);
  }
  indicator.classList.toggle('on', !!fixedGroup);
  indicator.textContent = fixedGroup ? `📌 Группа зафиксирована: ${fixedGroup}` : '';
}

function modal(kind, requested, previous, done) {
  let m = document.getElementById('group-lock-modal');
  if (!m) {
    m = document.createElement('div');
    m.id = 'group-lock-modal';
    m.innerHTML = `<div class="group-lock-sheet">
      <div class="group-lock-head"><div class="group-lock-icon">📌</div><div><div class="group-lock-title" id="gl-title"></div><div class="group-lock-sub" id="gl-sub"></div></div></div>
      <div class="group-lock-group" id="gl-group"></div>
      <div class="group-lock-actions"><button class="group-lock-btn" id="gl-no" type="button"></button><button class="group-lock-btn primary" id="gl-yes" type="button"></button></div>
    </div>`;
    document.body.appendChild(m);
    m.addEventListener('click', e => { if (e.target === m) { m.classList.remove('open'); done(false); } });
  }
  m.querySelector('#gl-title').textContent = kind === 'relock' ? 'Пере зафиксировать группу?' : 'Зафиксировать группу?';
  m.querySelector('#gl-sub').textContent = kind === 'relock'
    ? `Сейчас закреплена «${previous}». Новая группа заменит её.`
    : 'После фиксации приложение будет автоматически открывать эту группу.';
  m.querySelector('#gl-group').textContent = requested;
  m.querySelector('#gl-no').textContent = kind === 'relock' ? `Оставить ${previous}` : 'Нет';
  m.querySelector('#gl-yes').textContent = kind === 'relock' ? 'Да, пере зафиксировать' : 'Да';
  m.querySelector('#gl-no').onclick = () => { m.classList.remove('open'); done(false); };
  m.querySelector('#gl-yes').onclick = () => { m.classList.remove('open'); done(true); };
  m.classList.add('open');
}

function approve(requested, previous, kind) {
  const allow = (ok) => {
    if (ok) {
      fixedGroup = requested;
      localStorage.setItem(LOCK_KEY, fixedGroup);
      setSelectValue(requested);
      syncing = true;
      dispatchGroupChange();
      setTimeout(() => { syncing = false; }, 250);
      syncIndicator();
    } else if (previous) {
      setSelectValue(previous);
      syncing = true;
      dispatchGroupChange();
      setTimeout(() => { syncing = false; }, 250);
    }
  };
  modal(kind, requested, previous, allow);
}

function handleChange(event) {
  if (event.__scheduleGroupLockApproved || syncing || !control || event.target !== control) return;
  const requested = control.options?.[control.selectedIndex]?.textContent?.trim() || control.value || '';
  const previous = typeof state !== 'undefined' && state.selectedGroup ? String(state.selectedGroup) : '';
  if (!requested || requested === previous) return;

  event.stopImmediatePropagation();
  event.preventDefault();
  setSelectValue(previous);

  if (fixedGroup) {
    approve(requested, fixedGroup, 'relock');
  } else {
    approve(requested, previous, 'lock');
  }
}

function applyFixedGroup() {
  control = readControl();
  if (!control || !fixedGroup || typeof state === 'undefined' || !state.groups?.includes(fixedGroup)) {
    syncIndicator();
    return;
  }
  if (String(state.selectedGroup) === fixedGroup && control.value) {
    syncIndicator();
    return;
  }
  setSelectValue(fixedGroup);
  syncing = true;
  try { dispatchGroupChange(); } catch (_) {}
  setTimeout(() => { syncing = false; syncIndicator(); }, 250);
}

function attach() {
  const found = readControl();
  if (!found) return false;
  if (control !== found) {
    control = found;
    control.addEventListener('change', handleChange, true);
  }
  syncIndicator();
  applyFixedGroup();
  return true;
}

window.addEventListener('scheduleapp:data-ready', () => setTimeout(attach, 0));
setInterval(attach, 800);

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach);
else attach();

})();
