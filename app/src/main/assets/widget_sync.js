(() => {
'use strict';

const WIDGET_UPDATE_DELAY = 80;
let widgetTimer = null;

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

function updateWidget() {
  if (!window.Android || typeof Android.updateWidgetData !== 'function') return;
  const payload = buildWidgetPayload();
  if (!payload) return;
  try {
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#A66CFF';
    Android.updateWidgetData(JSON.stringify(payload), accent);
  } catch (_) {}
}

function scheduleWidgetUpdate() {
  clearTimeout(widgetTimer);
  widgetTimer = setTimeout(updateWidget, WIDGET_UPDATE_DELAY);
}

window.addEventListener('scheduleapp:data-ready', scheduleWidgetUpdate);

document.addEventListener('click', event => {
  if (event.target.closest?.('.day-btn, #groupSelect, .group-option, [data-group]')) {
    scheduleWidgetUpdate();
  }
}, true);

setInterval(updateWidget, 60000);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', scheduleWidgetUpdate);
} else {
  scheduleWidgetUpdate();
}
})();
