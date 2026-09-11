(() => {
'use strict';

const originalOnNativeFiles = window.onNativeFiles;
let excelWorker = null;
let workerBusy = false;
let pendingFiles = [];
let pendingLessons = [];
let pendingStatus = '';
let pendingNotify = false;

function setLoadingDone(status) {
  if (typeof state !== 'undefined') state.loading = false;
  const button = document.getElementById('refreshBtn');
  if (button) { button.disabled = false; button.textContent = 'Обновить'; }
  if (typeof setStatus === 'function') setStatus(status || 'Расписание загружено');
}

function failExcel(message) {
  workerBusy = false;
  pendingFiles = [];
  pendingLessons = [];
  window.__scheduleFilesForApply = null;
  setLoadingDone('Ошибка обработки Excel');
  if (typeof showMessage === 'function') showMessage('Ошибка Excel', message || 'Не удалось прочитать расписание.');
}

function timeToMinutesFast(value) {
  const match = String(value || '').match(/^(\d{1,2})[:.](\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : 9999;
}

function finishApply() {
  if (typeof state === 'undefined') {
    failExcel('Состояние приложения ещё не готово.');
    return;
  }

  const files = window.__scheduleFilesForApply || [];
  state.files = files.map(x => ({ name: x.name, data: x.data, url: x.url }));
  state.data = {};
  const seen = new Map();
  const queue = pendingLessons.slice();
  let index = 0;

  function processChunk() {
    const end = Math.min(index + 120, queue.length);
    for (; index < end; index++) {
      const lesson = queue[index];
      if (!lesson || !lesson.date || !lesson.group || !lesson.time || !lesson.lesson) continue;
      if (!state.data[lesson.date]) state.data[lesson.date] = {};
      if (!state.data[lesson.date][lesson.group]) state.data[lesson.date][lesson.group] = [];

      const key = lesson.date + '\u0000' + lesson.group;
      let groupSeen = seen.get(key);
      if (!groupSeen) {
        groupSeen = new Set();
        seen.set(key, groupSeen);
      }

      const duplicateKey = String(lesson.time) + '\u0000' + String(lesson.lesson) + '\u0000' + String(lesson.room || '');
      if (groupSeen.has(duplicateKey)) continue;
      groupSeen.add(duplicateKey);
      state.data[lesson.date][lesson.group].push(lesson);
    }

    if (index < queue.length) {
      requestAnimationFrame(processChunk);
      return;
    }

    state.groups = Array.from(
      new Set(
        Object.values(state.data).flatMap(dateGroups => Object.keys(dateGroups))
      )
    ).sort((a, b) => a.localeCompare(b, 'ru', { numeric: true }));

    state.dates = Object.keys(state.data).sort();
    state.dates.forEach(date => {
      Object.keys(state.data[date]).forEach(group => {
        state.data[date][group].sort(
          (a, b) => timeToMinutesFast(a.time) - timeToMinutesFast(b.time)
        );
      });
    });

    if (!state.selectedGroup || !state.groups.includes(state.selectedGroup)) {
      state.selectedGroup = state.groups[0] || '';
    }

    if (!state.selectedDate || !state.dates.includes(state.selectedDate)) {
      const now = new Date();
      const today = now.getFullYear() + '-' +
        String(now.getMonth() + 1).padStart(2, '0') + '-' +
        String(now.getDate()).padStart(2, '0');
      state.selectedDate = state.dates.includes(today)
        ? today
        : (state.dates[0] || '');
    }

    updateGroupSelect();
    updateGroupSelectValue();
    updateDateSelect();
    updateDateSelectValue();
    updateDays();
    updateSchedule();
    updateCalendar();
    updateSettingsInfo();

    workerBusy = false;
    const status = pendingStatus;
    const notify = pendingNotify;
    pendingFiles = [];
    pendingLessons = [];
    pendingStatus = '';
    pendingNotify = false;
    window.__scheduleFilesForApply = null;
    setLoadingDone(status || 'Расписание загружено');

    if (notify && window.Android && typeof Android.notifyScheduleUpdated === 'function') {
      try {
        Android.notifyScheduleUpdated(status);
      } catch (e) {
        console.error(e);
      }
    }

    try {
      const saved = JSON.parse(localStorage.getItem('scheduleapp.reminders.v2') || '{}');
      if (saved.enabled && window.Android && typeof Android.setLessonReminders === 'function') {
        const profile = JSON.parse(localStorage.getItem('scheduleapp.profile.v2') || '{}');
        const group = profile.group || state.selectedGroup || '';
        const payload = [];
        Object.keys(state.data).forEach(date => {
          const list = state.data[date] && state.data[date][group];
          if (Array.isArray(list)) {
            list.forEach(x => payload.push({
              date,
              time: x.time,
              lesson: x.lesson,
              room: x.room || '',
              group
            }));
          }
        });
        Android.setLessonReminders(
          true,
          Number(saved.minutes) || 10,
          group,
          saved.sound || 'alarm',
          JSON.stringify(payload)
        );
      }
    } catch (e) {
      console.error('Ошибка обновления напоминаний:', e);
    }

    window.dispatchEvent(new CustomEvent('scheduleapp:data-ready'));
  }

  requestAnimationFrame(processChunk);
}

function ensureWorker() {
  if (excelWorker) return excelWorker;
  if (typeof Worker === 'undefined') return null;

  try {
    excelWorker = new Worker('./schedule_worker.js');

    excelWorker.onmessage = event => {
      const result = event.data || {};
      if (!result.ok) {
        workerBusy = false;
        failExcel(result.error || 'Не удалось разобрать Excel.');
        return;
      }

      pendingLessons.push(...(result.lessons || []));
      pendingFiles.shift();

      if (pendingFiles.length) {
        processNextFile();
        return;
      }

      finishApply();
    };

    excelWorker.onerror = event => {
      console.error('Excel Worker error:', event);
      try {
        excelWorker.terminate();
      } catch (_) {
      }
      excelWorker = null;
      workerBusy = false;
      failExcel('Фоновый обработчик Excel завершился с ошибкой.');
    };

    return excelWorker;
  } catch (error) {
    console.error('Worker creation error:', error);
    excelWorker = null;
    return null;
  }
}

function processNextFile() {
  const worker = ensureWorker();
  if (!worker) {
    workerBusy = false;
    if (typeof originalOnNativeFiles === 'function') {
      originalOnNativeFiles(JSON.stringify(pendingFiles), pendingStatus);
    } else {
      failExcel('Web Worker недоступен.');
    }
    return;
  }

  const file = pendingFiles[0];
  if (!file) {
    finishApply();
    return;
  }

  if (typeof setStatus === 'function') setStatus('Обработка Excel в фоне...');

  try {
    worker.postMessage({
      name: file.name,
      url: file.url,
      data: file.data
    });
  } catch (error) {
    failExcel(error.message || 'Не удалось передать Excel в фоновый обработчик.');
  }
}

window.onNativeFiles = function(json, status) {
  if (workerBusy) return;

  let parsed;
  try {
    parsed = typeof json === 'string' ? JSON.parse(json) : json;
    if (!Array.isArray(parsed) || !parsed.length) {
      throw new Error('Excel-файлы не найдены');
    }
  } catch (error) {
    failExcel(error.message || 'Неверный формат Excel-файлов');
    return;
  }

  if (!parsed.every(x => x && x.name && (x.url || x.data))) {
    failExcel('Excel-файл пустой или повреждён.');
    return;
  }

  const worker = ensureWorker();
  if (!worker) {
    if (typeof originalOnNativeFiles === 'function' && parsed.every(x => x.data)) {
      originalOnNativeFiles(json, status);
    } else {
      failExcel('Web Worker недоступен.');
    }
    return;
  }

  workerBusy = true;
  pendingFiles = parsed.slice();
  window.__scheduleFilesForApply = parsed.slice();
  pendingLessons = [];
  pendingStatus = status || 'Расписание загружено';
  pendingNotify = String(status || '').indexOf('Расписание обновлено') === 0;
  processNextFile();
};

window.__schedulePerformanceReady = true;

if (window.__schedulePendingNativeFiles) {
  const pending = window.__schedulePendingNativeFiles;
  window.__schedulePendingNativeFiles = null;
  window.onNativeFiles(pending.json, pending.status);
}

if (window.__schedulePendingNativeError) {
  const message = window.__schedulePendingNativeError;
  window.__schedulePendingNativeError = null;
  if (typeof window.onNativeError === 'function') {
    window.onNativeError(message);
  }
}

window.addEventListener('scheduleapp:data-ready', () => {
  setTimeout(() => {
    if (typeof decorateLessons === 'function') decorateLessons();
  }, 0);
});
})();
