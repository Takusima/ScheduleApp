(() => {
'use strict';

const WIDGET_UPDATE_DELAY = 80;
let widgetTimer = null;
let lastAccent = '';

function buildWidgetPayload() {
  if (typeof state === 'undefined' || !state.data || !state.selectedGroup) return null;
  const group = state.selectedGroup;
  const out = [];
  Object.keys(state.data).forEach(date => {
    const list = state.data[date]?.[group];
    if (!Array.isArray(list)) return;
    list.forEach(item => {
      if (!item || !item.time || !item.lesson) return;
      out.push({
        date,
        time: item.time,
        lesson: item.lesson,
        room: item.room || '',
        group
      });
    });
  });
  return out;
}

function getAccent() {
  return getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#A66CFF';
}

function updateWidget(force = false) {
  if (!window.Android || typeof Android.updateWidgetData !== 'function') return;
  const payload = buildWidgetPayload();
  if (!payload) return;
  try {
    const accent = getAccent();
    if (!force && accent === lastAccent && !state?.selectedGroup) return;
    lastAccent = accent;
    Android.updateWidgetData(JSON.stringify(payload), accent);
  } catch (_) {}
}

function scheduleWidgetUpdate(force = false) {
  clearTimeout(widgetTimer);
  widgetTimer = setTimeout(() => updateWidget(force), WIDGET_UPDATE_DELAY);
}

window.addEventListener('scheduleapp:data-ready', () => scheduleWidgetUpdate(true));

document.addEventListener('click', event => {
  if (event.target.closest?.('.day-btn, #groupSelect, .group-option, [data-group]')) {
    scheduleWidgetUpdate(true);
  }
}, true);

setInterval(() => {
  const accent = getAccent();
  if (accent !== lastAccent) updateWidget(true);
}, 5000);

setInterval(() => updateWidget(true), 60000);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => scheduleWidgetUpdate(true));
} else {
  scheduleWidgetUpdate(true);
}
})();
