(() => {
'use strict';

const EXTRAS_STYLE_ID = 'schedule-extras-style';
const HIGHLIGHT_KEY = 'scheduleapp.currentLesson.v1';
const HIGHLIGHT_DEFAULTS = { mode: 'rays', color: '#A66CFF' };
let highlightSettings = { ...HIGHLIGHT_DEFAULTS };
try {
  highlightSettings = {
    ...HIGHLIGHT_DEFAULTS,
    ...JSON.parse(localStorage.getItem(HIGHLIGHT_KEY) || '{}')
  };
} catch (_) {}

const clamp = n => Math.max(0, Math.min(255, Number(n) || 0));
const rgb = h => {
  let value = String(h || '').replace('#', '');
  if (value.length === 3) value = value.split('').map(x => x + x).join('');
  return [
    parseInt(value.slice(0, 2), 16) || 0,
    parseInt(value.slice(2, 4), 16) || 0,
    parseInt(value.slice(4, 6), 16) || 0
  ];
};
const hex = (r, g, b) =>
  '#' + [r, g, b].map(x => clamp(x).toString(16).padStart(2, '0')).join('').toUpperCase();
const rgba = (h, a) => {
  const [r, g, b] = rgb(h);
  return `rgba(${r},${g},${b},${a})`;
};

if (!document.getElementById(EXTRAS_STYLE_ID)) {
  const style = document.createElement('style');
  style.id = EXTRAS_STYLE_ID;
  style.textContent = `
    .lesson-progress {
      grid-column: 1 / -1;
      margin-top: 7px;
      padding-top: 8px;
      border-top: 1px solid rgba(255,255,255,.045);
    }
    .lesson-progress-head {
      display:flex;
      justify-content:space-between;
      align-items:center;
      gap:8px;
      margin-bottom:5px;
      color:#948b9d;
      font-size:10px;
    }
    .lesson-progress-head b { color:var(--accent,#a66cff); }
    .lesson-progress-track {
      height:5px;
      border-radius:8px;
      overflow:hidden;
      background:rgba(255,255,255,.07);
    }
    .lesson-progress-fill {
      height:100%;
      width:0;
      border-radius:8px;
      background:linear-gradient(90deg,var(--accent,#a66cff),var(--accent2,#7945d6));
      transition:width .5s ease;
      box-shadow:0 0 10px var(--accentSoft,rgba(166,108,255,.16));
    }

    .current-lesson-highlight {
      position: relative !important;
      isolation: isolate;
      z-index: 1;
    }
    .current-lesson-highlight > * {
      position: relative;
      z-index: 2;
    }
    .current-lesson-rays::before {
      content: '';
      position: absolute;
      inset: -36%;
      z-index: 0;
      pointer-events: none;
      opacity: .34;
      background:
        conic-gradient(
          from 18deg at 50% 52%,
          transparent 0deg,
          rgba(235,235,240,.13) 23deg,
          transparent 49deg,
          rgba(235,235,240,.09) 73deg,
          transparent 96deg,
          rgba(235,235,240,.11) 126deg,
          transparent 151deg,
          rgba(235,235,240,.08) 189deg,
          transparent 215deg,
          rgba(235,235,240,.12) 248deg,
          transparent 275deg,
          rgba(235,235,240,.08) 313deg,
          transparent 342deg
        );
      filter: blur(10px);
      transform-origin: 50% 52%;
      animation: currentLessonRays 18s ease-in-out infinite;
    }
    .current-lesson-rays::after {
      content: '';
      position: absolute;
      inset: 1px;
      z-index: 0;
      pointer-events: none;
      border-radius: inherit;
      box-shadow: inset 0 0 34px rgba(235,235,240,.07);
      opacity: .9;
    }
    @keyframes currentLessonRays {
      0%,100% { transform: rotate(-2deg) scale(1); opacity: .28; }
      50% { transform: rotate(2deg) scale(1.035); opacity: .40; }
    }

    .current-lesson-outline::before {
      content: '';
      position: absolute;
      inset: 0;
      z-index: 0;
      pointer-events: none;
      border-radius: inherit;
      border: 1px solid var(--current-highlight-color, #a66cff);
      box-shadow:
        0 0 0 1px var(--current-highlight-soft, rgba(166,108,255,.18)),
        0 0 18px var(--current-highlight-soft, rgba(166,108,255,.18)),
        inset 0 0 16px var(--current-highlight-soft, rgba(166,108,255,.10));
      opacity: .85;
      animation: currentLessonOutline 3.8s ease-in-out infinite;
    }
    @keyframes currentLessonOutline {
      0%,100% { opacity: .62; box-shadow: 0 0 0 1px var(--current-highlight-soft), 0 0 12px var(--current-highlight-soft), inset 0 0 12px var(--current-highlight-soft); }
      50% { opacity: .95; box-shadow: 0 0 0 1px var(--current-highlight-soft), 0 0 22px var(--current-highlight-soft), inset 0 0 18px var(--current-highlight-soft); }
    }

    #current-lesson-settings {
      margin-top: 14px;
      padding-top: 14px;
      border-top: 1px solid rgba(255,255,255,.045);
    }
    .current-mode-grid {
      display:grid;
      grid-template-columns:repeat(2,1fr);
      gap:7px;
    }
    .current-mode-btn,
    .current-color-btn {
      min-height:40px;
      padding:7px 9px;
      border-radius:11px;
      border:1px solid rgba(255,255,255,.08);
      background:rgba(255,255,255,.055);
      color:inherit;
      font-size:11px;
      cursor:pointer;
    }
    .current-mode-btn.selected,
    .current-color-btn.selected {
      color:var(--accent);
      border-color:var(--accentBorder);
      background:var(--accentSoft);
    }
    .current-color-panel { margin-top:9px; }
    .current-color-row {
      display:grid;
      grid-template-columns:12px 1fr 44px;
      align-items:center;
      gap:8px;
    }
    .current-color-dot {
      width:9px;
      height:9px;
      border-radius:50%;
      background:var(--current-highlight-color,#a66cff);
    }
    .current-color-range {
      width:100%;
      accent-color:var(--accent);
    }
    .current-color-value {
      width:44px;
      height:30px;
      border-radius:9px;
      border:1px solid rgba(255,255,255,.08);
      background:rgba(255,255,255,.055);
      color:inherit;
      text-align:center;
      font-size:10px;
    }
    .current-color-hex {
      width:100%;
      height:38px;
      margin-top:8px;
      box-sizing:border-box;
      border-radius:11px;
      border:1px solid rgba(255,255,255,.08);
      background:rgba(255,255,255,.055);
      color:inherit;
      padding:0 11px;
      font-size:11px;
      outline:none;
      text-transform:uppercase;
    }
    .current-presets {
      display:grid;
      grid-template-columns:repeat(6,1fr);
      gap:6px;
      margin-top:8px;
    }
    .current-preset {
      height:30px;
      border-radius:9px;
      border:1px solid rgba(255,255,255,.1);
      overflow:hidden;
      padding:0;
    }
    .current-preset span { display:block; width:100%; height:100%; }
    .current-preset.selected { outline:2px solid var(--accent); outline-offset:1px; }
    .current-help {
      margin-top:7px;
      color:#817987;
      font-size:10px;
      line-height:1.4;
    }
    html[data-theme=light] .lesson-progress,
    .theme-light .lesson-progress { border-color:rgba(0,0,0,.07); }
    html[data-theme=light] .lesson-progress-track,
    .theme-light .lesson-progress-track { background:rgba(0,0,0,.08); }
    html[data-theme=light] #current-lesson-settings,
    .theme-light #current-lesson-settings { border-color:rgba(0,0,0,.08); }
    html[data-theme=light] .current-color-value,
    html[data-theme=light] .current-color-hex,
    .theme-light .current-color-value,
    .theme-light .current-color-hex { background:#eeeef2;color:#242128;border-color:rgba(0,0,0,.08); }
    @media(max-width:360px){
      .current-presets{grid-template-columns:repeat(4,1fr)}
    }
  `;
  document.head.appendChild(style);
}

function toMinutes(text) {
  const m = String(text || '').match(/^(\d{1,2})[:.](\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
}

function makeProgress(card, item, nextItem) {
  let box = card.querySelector('.lesson-progress');
  if (!box) {
    box = document.createElement('div');
    box.className = 'lesson-progress';
    box.innerHTML = '<div class="lesson-progress-head"><span>Прогресс пары</span><b>0%</b></div><div class="lesson-progress-track"><div class="lesson-progress-fill"></div></div>';
    card.appendChild(box);
  }
  const start = toMinutes(item.time);
  const nextStart = nextItem ? toMinutes(nextItem.time) : NaN;
  const end = Number.isFinite(nextStart) && nextStart > start && (nextStart - start) <= 100 ? nextStart : start + 90;
  const now = new Date();
  const selected = typeof state !== 'undefined' ? state.selectedDate : '';
  const today = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');
  if (selected !== today || !Number.isFinite(start)) {
    box.style.display = 'none';
    return;
  }
  const current = now.getHours() * 60 + now.getMinutes();
  if (current < start || current >= end) {
    box.style.display = 'none';
    return;
  }
  const pct = Math.max(0, Math.min(100, Math.round((current - start) / Math.max(1, end - start) * 100)));
  box.style.display = 'block';
  box.querySelector('.lesson-progress-head b').textContent = pct + '%';
  box.querySelector('.lesson-progress-fill').style.width = pct + '%';
}

function getTodayKey() {
  const now = new Date();
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
}

function currentLessonCard() {
  if (typeof state === 'undefined' || !state.selectedDate || state.selectedDate !== getTodayKey()) return null;
  const cards = Array.from(document.querySelectorAll('#schedulePage .lesson'));
  const items = cards.map(card => ({
    card,
    start: toMinutes(card.querySelector('.lesson-time')?.textContent?.trim())
  })).filter(x => Number.isFinite(x.start));
  if (!items.length) return null;
  const now = new Date();
  const minute = now.getHours() * 60 + now.getMinutes();
  let candidate = null;
  items.forEach((item, index) => {
    const nextStart = items[index + 1]?.start;
    const end = Number.isFinite(nextStart) && nextStart > item.start && nextStart - item.start <= 100
      ? nextStart
      : item.start + 90;
    if (minute >= item.start && minute < end) candidate = item.card;
  });
  return candidate;
}

function clearCurrentHighlight() {
  document.querySelectorAll('.current-lesson-highlight').forEach(card => {
    card.classList.remove('current-lesson-highlight', 'current-lesson-rays', 'current-lesson-outline');
    card.style.removeProperty('--current-highlight-color');
    card.style.removeProperty('--current-highlight-soft');
  });
}

function applyCurrentHighlight() {
  clearCurrentHighlight();
  const card = currentLessonCard();
  if (!card || highlightSettings.mode === 'off') return;
  card.classList.add('current-lesson-highlight');
  if (highlightSettings.mode === 'rays') {
    card.classList.add('current-lesson-rays');
  } else if (highlightSettings.mode === 'outline') {
    card.classList.add('current-lesson-outline');
    card.style.setProperty('--current-highlight-color', highlightSettings.color || '#A66CFF');
    card.style.setProperty('--current-highlight-soft', rgba(highlightSettings.color || '#A66CFF', .18));
  }
}

function saveHighlight() {
  localStorage.setItem(HIGHLIGHT_KEY, JSON.stringify(highlightSettings));
  applyCurrentHighlight();
  drawHighlightSettings();
}

function addHighlightSettings() {
  const custom = document.getElementById('customize');
  if (!custom || document.getElementById('current-lesson-settings')) return;
  const box = document.createElement('div');
  box.className = 'cgroup';
  box.id = 'current-lesson-settings';
  box.innerHTML = `
    <div class="clabel"><span>Подсветка текущей пары</span></div>
    <div class="current-mode-grid">
      <button type="button" class="current-mode-btn" data-mode="off">Выключено</button>
      <button type="button" class="current-mode-btn" data-mode="rays">☀️ Мягкие лучи</button>
      <button type="button" class="current-mode-btn" data-mode="outline">Обводка</button>
    </div>
    <div class="current-color-panel" id="currentColorPanel">
      <div class="clabel"><span>Цвет обводки</span><b id="currentColorHex">${highlightSettings.color}</b></div>
      <div class="current-color-row"><i class="current-color-dot" id="currentColorDot"></i><input class="current-color-range" id="currentColorR" type="range" min="0" max="255"><input class="current-color-value" id="currentColorRv" type="number" min="0" max="255"></div>
      <div class="current-color-row" style="margin-top:7px"><i class="current-color-dot" style="background:#50db83"></i><input class="current-color-range" id="currentColorG" type="range" min="0" max="255"><input class="current-color-value" id="currentColorGv" type="number" min="0" max="255"></div>
      <div class="current-color-row" style="margin-top:7px"><i class="current-color-dot" style="background:#5a8cff"></i><input class="current-color-range" id="currentColorB" type="range" min="0" max="255"><input class="current-color-value" id="currentColorBv" type="number" min="0" max="255"></div>
      <input class="current-color-hex" id="currentColorHexInput" maxlength="7" value="${highlightSettings.color}">
      <div class="current-presets" id="currentColorPresets"></div>
    </div>
    <div class="current-help">Лучше всего смотрится мягкая подсветка без резкого мигания.</div>
  `;
  custom.appendChild(box);

  const colors = ['#A66CFF','#7C5CFF','#00C2FF','#00D084','#FFD166','#FF7A59','#FF4F81','#F43F5E','#9B59B6','#8B5CF6','#22C55E','#F8FAFC'];
  colors.forEach(color => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'current-preset';
    button.dataset.color = color;
    button.innerHTML = `<span style="background:${color}"></span>`;
    box.querySelector('#currentColorPresets').appendChild(button);
    button.onclick = () => {
      highlightSettings.color = color;
      saveHighlight();
    };
  });

  box.querySelectorAll('.current-mode-btn').forEach(button => {
    button.onclick = () => {
      highlightSettings.mode = button.dataset.mode;
      saveHighlight();
    };
  });

  const updateColorFromRgb = () => {
    const r = Number(box.querySelector('#currentColorR').value);
    const g = Number(box.querySelector('#currentColorG').value);
    const b = Number(box.querySelector('#currentColorB').value);
    highlightSettings.color = hex(r, g, b);
    saveHighlight();
  };

  [['R','r'],['G','g'],['B','b']].forEach(([upper, lower]) => {
    box.querySelector('#currentColor' + upper).oninput = updateColorFromRgb;
    box.querySelector('#currentColor' + upper + 'v').oninput = updateColorFromRgb;
  });

  box.querySelector('#currentColorHexInput').onchange = () => {
    const value = box.querySelector('#currentColorHexInput').value.trim();
    if (/^#[0-9a-f]{6}$/i.test(value)) {
      highlightSettings.color = value.toUpperCase();
      saveHighlight();
    } else {
      drawHighlightSettings();
    }
  };

  drawHighlightSettings();
}

function drawHighlightSettings() {
  const box = document.getElementById('current-lesson-settings');
  if (!box) return;
  box.querySelectorAll('.current-mode-btn').forEach(button => {
    button.classList.toggle('selected', highlightSettings.mode === button.dataset.mode);
  });
  const panel = box.querySelector('#currentColorPanel');
  panel.style.display = highlightSettings.mode === 'outline' ? 'block' : 'none';

  const [r,g,b] = rgb(highlightSettings.color);
  ['R','G','B'].forEach((upper, i) => {
    const value = [r,g,b][i];
    box.querySelector('#currentColor' + upper).value = value;
    box.querySelector('#currentColor' + upper + 'v').value = value;
  });
  box.querySelector('#currentColorHex').textContent = highlightSettings.color;
  box.querySelector('#currentColorHexInput').value = highlightSettings.color;
  box.querySelector('#currentColorDot').style.background = highlightSettings.color;
  box.querySelectorAll('.current-preset').forEach(button => {
    button.classList.toggle('selected', button.dataset.color === highlightSettings.color);
  });
}

function renderProgress() {
  const cards = Array.from(document.querySelectorAll('#schedulePage .lesson'));
  const items = cards.map(card => ({
    time: card.querySelector('.lesson-time')?.textContent?.trim() || '',
    name: card.querySelector('.lesson-name')?.textContent?.trim() || ''
  }));
  cards.forEach((card, index) => {
    if (!items[index].time || !items[index].name) return;
    makeProgress(card, items[index], items[index + 1]);
  });
}

function refreshAll() {
  renderProgress();
  addHighlightSettings();
  applyCurrentHighlight();
}

window.addEventListener('scheduleapp:data-ready', () => setTimeout(refreshAll, 50));

setInterval(() => {
  renderProgress();
  applyCurrentHighlight();
}, 20000);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(refreshAll, 400));
} else {
  setTimeout(refreshAll, 400);
}

})();
