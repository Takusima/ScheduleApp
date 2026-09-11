(() => {
'use strict';

const originalOnNativeFiles = window.onNativeFiles;
let excelWorker = null;
let workerBusy = false;
let workerJob = 0;

function setLoadingDone(status) {
  if (typeof state !== 'undefined') state.loading = false;
  const button = document.getElementById('refreshBtn');
  if (button) {
    button.disabled = false;
    button.textContent = 'Обновить';
  }
  if (typeof setStatus === 'function') setStatus(status || 'Расписание загружено');
}

function failExcel(message) {
  workerBusy = false;
  setLoadingDone('Ошибка обработки Excel');
  if (typeof showMessage === 'function') showMessage('Ошибка Excel', message || 'Не удалось прочитать расписание.');
}

function timeToMinutesFast(value) {
  const match = String(value || '').match(/^(\d{1,2})[:.](\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : 9999;
}

function applyLessons(file, lessons, status, notifyUpdate) {
  if (typeof state === 'undefined') {
    failExcel('Состояние приложения ещё не готово.');
    return;
  }

  state.files = [{ name: file.name, data: file.data }];
  state.data = {};

  const queue = Array.isArray(lessons) ? lessons : [];
  let index = 0;
  const seen = new Map();

  function processChunk() {
    const end = Math.min(index + 120, queue.length);

    for (; index < end; index++) {
      const lesson = queue[index];
      if (!lesson || !lesson.date || !lesson.group || !lesson.time || !lesson.lesson) continue;

      if (!state.data[lesson.date]) state.data[lesson.date] = {};
      if (!state.data[lesson.date][lesson.group]) {
        state.data[lesson.date][lesson.group] = [];
        seen.set(lesson.date + '\u0000' + lesson.group, new Set());
      }

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

    state.groups = Array.from(new Set(
      Object.values(state.data).flatMap(dateGroups => Object.keys(dateGroups))
    )).sort((a, b) => a.localeCompare(b, 'ru', { numeric: true }));

    state.dates = Object.keys(state.data).sort();

    state.dates.forEach(date => {
      Object.keys(state.data[date]).forEach(group => {
        state.data[date][group].sort((a, b) => timeToMinutesFast(a.time) - timeToMinutesFast(b.time));
      });
    });

    if (!state.selectedGroup || !state.groups.includes(state.selectedGroup)) {
      state.selectedGroup = state.groups[0] || '';
    }

    if (!state.selectedDate || !state.dates.includes(state.selectedDate)) {
      const now = new Date();
      const today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
      state.selectedDate = state.dates.includes(today) ? today : (state.dates[0] || '');
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
    setLoadingDone(status || 'Расписание загружено');

    if (notifyUpdate && status && status.indexOf('Расписание обновлено') === 0 && window.Android && typeof Android.notifyScheduleUpdated === 'function') {
      try { Android.notifyScheduleUpdated(status); } catch (e) { console.error(e); }
    }

    try {
      const saved = JSON.parse(localStorage.getItem('scheduleapp.reminders.v2') || '{}');
      if (saved.enabled && window.Android && typeof Android.setLessonReminders === 'function') {
        const reminderProfile = JSON.parse(localStorage.getItem('scheduleapp.profile.v2') || '{}');
        const group = reminderProfile.group || state.selectedGroup || '';
        const payload = [];
        Object.keys(state.data).forEach(date => {
          const list = state.data[date] && state.data[date][group];
          if (Array.isArray(list)) list.forEach(x => payload.push({ date, time: x.time, lesson: x.lesson, room: x.room || '', group }));
        });
        Android.setLessonReminders(true, Number(saved.minutes) || 10, group, saved.sound || 'alarm', JSON.stringify(payload));
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
      const file = window.__scheduleWorkerFile;
      const status = window.__scheduleWorkerStatus;
      const notify = window.__scheduleWorkerNotify;
      window.__scheduleWorkerFile = null;
      window.__scheduleWorkerStatus = '';
      window.__scheduleWorkerNotify = false;
      applyLessons(file, result.lessons || [], status, notify);
    };
    excelWorker.onerror = event => {
      console.error('Excel Worker error:', event);
      excelWorker.terminate();
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

window.onNativeFiles = function(json, status) {
  if (workerBusy) return;

  let parsed;
  try {
    parsed = typeof json === 'string' ? JSON.parse(json) : json;
    if (!Array.isArray(parsed) || !parsed.length) throw new Error('Excel-файлы не найдены');
  } catch (error) {
    failExcel(error.message || 'Неверный формат Excel-файлов');
    return;
  }

  const file = parsed[0];
  if (!file || !file.data) {
    failExcel('Excel-файл пустой или повреждён.');
    return;
  }

  const worker = ensureWorker();
  if (!worker) {
    if (typeof originalOnNativeFiles === 'function') originalOnNativeFiles(json, status);
    return;
  }

  workerBusy = true;
  const job = ++workerJob;
  window.__scheduleWorkerFile = file;
  window.__scheduleWorkerStatus = status || 'Расписание загружено';
  window.__scheduleWorkerNotify = String(status || '').indexOf('Расписание обновлено') === 0;
  if (typeof setStatus === 'function') setStatus('Обработка Excel в фоне...');

  try {
    worker.postMessage({ name: file.name, data: file.data, job });
  } catch (error) {
    workerBusy = false;
    window.__scheduleWorkerFile = null;
    window.__scheduleWorkerStatus = '';
    window.__scheduleWorkerNotify = false;
    failExcel(error.message || 'Не удалось передать Excel в фоновый обработчик.');
  }
};

window.addEventListener('scheduleapp:data-ready', () => {
  setTimeout(() => {
    if (typeof decorateLessons === 'function') decorateLessons();
  }, 0);
});

})();
