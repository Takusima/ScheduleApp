(() => {
'use strict';

const STYLE_ID = 'schedule-current-lesson-fix-style';
const KEY = 'scheduleapp.currentLesson.v1';

if (!document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .schedule-current-lesson-fix {
      position:relative!important;
      isolation:isolate!important;
      border-color:rgba(166,108,255,.42)!important;
      box-shadow:
        0 0 0 1px rgba(166,108,255,.18),
        0 0 22px rgba(166,108,255,.18),
        inset 0 0 24px rgba(166,108,255,.055)!important;
      animation:scheduleCurrentGlow 3.2s ease-in-out infinite!important;
    }
    .schedule-current-lesson-fix::after {
      content:'';
      position:absolute;
      inset:0;
      border-radius:inherit;
      pointer-events:none;
      z-index:0;
      background:linear-gradient(135deg,rgba(166,108,255,.07),transparent 48%,rgba(121,69,214,.045));
    }
    .schedule-current-lesson-fix > * { position:relative; z-index:1; }
    @keyframes scheduleCurrentGlow {
      0%,100% { box-shadow:0 0 0 1px rgba(166,108,255,.14),0 0 14px rgba(166,108,255,.12),inset 0 0 18px rgba(166,108,255,.035); }
      50% { box-shadow:0 0 0 1px rgba(166,108,255,.32),0 0 28px rgba(166,108,255,.24),inset 0 0 26px rgba(166,108,255,.075); }
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

function refresh() {
  document.querySelectorAll('.schedule-current-lesson-fix').forEach(x => x.classList.remove('schedule-current-lesson-fix'));
  if (typeof state === 'undefined' || state.selectedDate !== today()) return;

  let settings = { mode:'rays' };
  try { settings = { mode:'rays', ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch (_) {}
  if (settings.mode === 'off') return;

  const cards = Array.from(document.querySelectorAll('#schedulePage .lesson'));
  const items = cards.map(card => ({ card, start:minutes(card.querySelector('.lesson-time')?.textContent?.trim()) }))
    .filter(x => Number.isFinite(x.start));
  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();

  for (let i=0; i<items.length; i++) {
    const start = items[i].start;
    const next = items[i+1]?.start;
    const end = Number.isFinite(next) && next > start && next-start <= 100 ? next : start+90;
    if (current >= start && current < end) {
      items[i].card.classList.add('schedule-current-lesson-fix');
      break;
    }
  }
}

window.addEventListener('scheduleapp:data-ready', () => setTimeout(refresh, 120));
document.addEventListener('click', event => {
  if (event.target.closest?.('.day-btn, #groupSelect, .group-option, [data-group]')) setTimeout(refresh, 120);
}, true);
setInterval(refresh, 20000);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(refresh, 500));
else setTimeout(refresh, 500);
})();
