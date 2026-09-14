(() => {
'use strict';

const STYLE_ID = 'schedule-current-lesson-fix-style';
const KEY = 'scheduleapp.currentLesson.v1';
const PROGRESS_CLASS = 'lesson-progress';
const VARS = [
  '--current-accent','--current-accent-strong','--current-accent-soft',
  '--current-accent-glow','--current-accent-glow-strong',
  '--current-accent-inner','--current-accent-inner-strong',
  '--current-accent-fill','--current-accent-fill-2'
];

function accentColor() {
  try {
    const cssAccent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    if (cssAccent) return cssAccent;
  } catch (_) {}
  try {
    const saved = JSON.parse(localStorage.getItem('scheduleapp.theme.v3') || '{}');
    if (saved.accent) return saved.accent;
  } catch (_) {}
  return '#A66CFF';
}

function hexToRgba(hex, alpha) {
  let value = String(hex || '').replace('#','').trim();
  if (value.length === 3) value = value.split('').map(x => x + x).join('');
  if (!/^[0-9a-f]{6}$/i.test(value)) return `rgba(166,108,255,${alpha})`;
  const r = parseInt(value.slice(0,2),16);
  const g = parseInt(value.slice(2,4),16);
  const b = parseInt(value.slice(4,6),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

if (!document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .schedule-current-lesson-fix {
      position:relative!important;
      isolation:isolate!important;
      border-color:var(--current-accent)!important;
      box-shadow:
        0 0 0 1px var(--current-accent-soft),
        0 0 22px var(--current-accent-glow),
        inset 0 0 24px var(--current-accent-inner)!important;
      animation:scheduleCurrentGlow 3.2s ease-in-out infinite!important;
    }
    .schedule-current-lesson-fix::after {
      content:'';
      position:absolute;
      inset:0;
      border-radius:inherit;
      pointer-events:none;
      z-index:0;
      background:linear-gradient(135deg,var(--current-accent-fill),transparent 50%,var(--current-accent-fill-2));
    }
    .schedule-current-lesson-fix > * { position:relative; z-index:1; }
    .schedule-current-lesson-fix .lesson-progress-fill {
      background:linear-gradient(90deg,var(--current-accent),var(--current-accent-strong))!important;
      box-shadow:0 0 10px var(--current-accent-soft)!important;
    }
    .schedule-current-lesson-fix .lesson-progress-head b {
      color:var(--current-accent)!important;
    }
    @keyframes scheduleCurrentGlow {
      0%,100% { box-shadow:0 0 0 1px var(--current-accent-soft),0 0 14px var(--current-accent-glow),inset 0 0 18px var(--current-accent-inner); }
      50% { box-shadow:0 0 0 1px var(--current-accent),0 0 28px var(--current-accent-glow-strong),inset 0 0 26px var(--current-accent-inner-strong); }
    }
  `;
  document.head.appendChild(style);
}

function minutes(value) {
  const m = String(value || '').match(/^(\d{1,2})[:.](\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
}

function today() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function applyAccent(card) {
  if (!card) return;
  const accent = accentColor();
  card.style.setProperty('--current-accent', accent);
  card.style.setProperty('--current-accent-strong', accent);
  card.style.setProperty('--current-accent-soft', hexToRgba(accent,.18));
  card.style.setProperty('--current-accent-glow', hexToRgba(accent,.15));
  card.style.setProperty('--current-accent-glow-strong', hexToRgba(accent,.24));
  card.style.setProperty('--current-accent-inner', hexToRgba(accent,.055));
  card.style.setProperty('--current-accent-inner-strong', hexToRgba(accent,.075));
  card.style.setProperty('--current-accent-fill', hexToRgba(accent,.07));
  card.style.setProperty('--current-accent-fill-2', hexToRgba(accent,.04));
}

function getItems() {
  return Array.from(document.querySelectorAll('#schedulePage .lesson'))
    .map(card => ({ card, start: minutes(card.querySelector('.lesson-time')?.textContent?.trim()) }))
    .filter(x => Number.isFinite(x.start));
}

function currentItem(items) {
  if (typeof state === 'undefined' || state.selectedDate !== today()) return null;
  const now = new Date();
  const currentMinute = now.getHours() * 60 + now.getMinutes();
  for (let i=0; i<items.length; i++) {
    const start = items[i].start;
    const next = items[i+1]?.start;
    const end = Number.isFinite(next) && next > start && next-start <= 100 ? next : start+90;
    if (currentMinute >= start && currentMinute < end) return { ...items[i], end };
  }
  return null;
}

function ensureProgress(card) {
  let box = card.querySelector('.' + PROGRESS_CLASS);
  if (!box) {
    box = document.createElement('div');
    box.className = PROGRESS_CLASS;
    box.innerHTML = '<div class="lesson-progress-head"><span>Прогресс пары</span><b>0%</b></div><div class="lesson-progress-track"><div class="lesson-progress-fill"></div></div>';
    card.appendChild(box);
  }
  return box;
}

function updateProgress(items, current) {
  const selectedToday = typeof state !== 'undefined' && state.selectedDate === today();
  const now = new Date();
  const nowMinute = now.getHours() * 60 + now.getMinutes();

  items.forEach((item, index) => {
    const next = items[index + 1]?.start;
    const end = Number.isFinite(next) && next > item.start && next-item.start <= 100 ? next : item.start + 90;
    const box = ensureProgress(item.card);
    const active = selectedToday && nowMinute >= item.start && nowMinute < end;
    box.style.display = active ? 'block' : 'none';
    if (!active) return;
    const pct = Math.max(0, Math.min(100, Math.round((nowMinute - item.start) / Math.max(1, end-item.start) * 100)));
    const label = box.querySelector('.lesson-progress-head b');
    const fill = box.querySelector('.lesson-progress-fill');
    if (label) label.textContent = pct + '%';
    if (fill) fill.style.width = pct + '%';
  });

  if (current) applyAccent(current.card);
}

function clearHighlight() {
  document.querySelectorAll('.schedule-current-lesson-fix').forEach(card => {
    card.classList.remove('schedule-current-lesson-fix');
    VARS.forEach(name => card.style.removeProperty(name));
  });
}

function refresh() {
  clearHighlight();
  const items = getItems();
  if (!items.length) return;

  let settings = { mode:'rays' };
  try { settings = { mode:'rays', ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch (_) {}

  const current = currentItem(items);
  updateProgress(items, current);

  if (settings.mode === 'off' || !current) return;
  current.card.classList.add('schedule-current-lesson-fix');
  applyAccent(current.card);
}

let timer = 0;
function scheduleRefresh(delay = 80) {
  clearTimeout(timer);
  timer = setTimeout(refresh, delay);
}

function refreshAfterDayOrGroup() {
  scheduleRefresh(80);
  setTimeout(refresh, 220);
  setTimeout(refresh, 500);
  setTimeout(refresh, 900);
}

window.addEventListener('scheduleapp:data-ready', refreshAfterDayOrGroup);
document.addEventListener('click', event => {
  if (event.target.closest?.('.day-btn, #groupSelect, .group-option, [data-group]')) refreshAfterDayOrGroup();
}, true);

setInterval(refresh, 10000);
setInterval(() => {
  const active = document.querySelector('.schedule-current-lesson-fix');
  if (active) applyAccent(active);
}, 1000);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => scheduleRefresh(500));
} else {
  scheduleRefresh(500);
}
})();
