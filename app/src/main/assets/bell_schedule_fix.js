(() => {
'use strict';

/*
 * Bell schedule fix for ScheduleApp 0.2.
 * A lesson is a 45-minute interval. The second lesson of the same
 * pair is a separate interval, not part of a 90/95-minute lesson.
 */

const WEEKDAY_BELLS = [
  ['09:00','09:45'], ['09:55','10:40'],
  ['10:50','11:35'], ['11:45','12:30'],
  ['13:10','13:55'], ['14:05','14:50'],
  ['15:00','15:45'], ['15:55','16:40'],
  ['16:50','17:35'], ['17:45','18:30']
];

const SATURDAY_BELLS = [
  ['09:00','09:45'], ['09:55','10:40'],
  ['10:50','11:35'], ['11:45','12:30'],
  ['12:40','13:25'], ['13:35','14:20']
];

function fixedBellMode(dateString) {
  const d = parseDateKey(dateString || todayKey());
  return d && d.getDay() === 6 ? 'saturday' : 'weekday';
}

function fixedBellSlots(mode) {
  return mode === 'saturday' ? SATURDAY_BELLS : WEEKDAY_BELLS;
}

function fixedBellForLesson(time, slots) {
  const start = String(time || '').match(/^(\d{1,2})[:.](\d{2})/);
  if (!start) return null;
  const normalized = String(start[1]).padStart(2,'0') + ':' + start[2];
  return slots.find(x => x[0] === normalized) || null;
}

window.getBellMode = fixedBellMode;
window.bellSlotsForMode = function(mode) {
  return fixedBellSlots(mode).map((x, i) => [String(i + 1), x[0], x[1]]);
};

window.bellRowsForMode = function(mode) {
  const slots = fixedBellSlots(mode);
  const rows = [];
  for (let i = 0; i < slots.length; i += 2) {
    const first = slots[i];
    const second = slots[i + 1];
    rows.push(second
      ? [String(i / 2 + 1), first[0], first[1], second[0], second[1]]
      : [String(i / 2 + 1), first[0], first[1]]);
  }
  return rows;
};

window.updateBellSchedule = function() {
  const card = document.getElementById('bellScheduleCard');
  const modeEl = document.getElementById('bellMode');
  const details = document.getElementById('bellDetails');
  if (!card || !modeEl || !details) return;

  const selected = state.selectedDate || todayKey();
  const mode = fixedBellMode(selected);
  modeEl.textContent = mode === 'saturday' ? 'Суббота · 3 пары' : 'Будни · 5 пар';

  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();

  details.innerHTML = window.bellRowsForMode(mode).map(row => {
    const firstCurrent = minutes >= timeToMinutes(row[1]) && minutes < timeToMinutes(row[2]);
    const secondCurrent = row[3] && minutes >= timeToMinutes(row[3]) && minutes < timeToMinutes(row[4]);
    const current = selected === todayKey() && (firstCurrent || secondCurrent);
    const times = row[3]
      ? '<span>' + row[1] + '–' + row[2] + '</span><span>' + row[3] + '–' + row[4] + '</span>'
      : row[1] + '–' + row[2];

    return '<div class="bell-row' + (current ? ' current' : '') + '">' +
      '<div class="bell-num">' + row[0] + '</div>' +
      '<div class="bell-time">' + times + '</div>' +
      '<div class="bell-status">' + (current ? 'Сейчас' : '') + '</div>' +
      '</div>';
  }).join('');
};

window.updateSchedule = function() {
  const container = document.getElementById('schedule');
  if (!container) return;

  if (!state.files.length) {
    container.innerHTML = '<div class="empty">Нет загруженных Excel-файлов.<br><br>Нажмите «Обновить» или загрузите Excel в Настройках.</div>';
    return;
  }

  if (!state.selectedGroup || !state.selectedDate) {
    container.innerHTML = '<div class="empty">Выберите группу и дату.</div>';
    return;
  }

  const lessons = state.data[state.selectedDate] && state.data[state.selectedDate][state.selectedGroup];
  if (!lessons || !lessons.length) {
    container.innerHTML = '<div class="empty">На ' + escapeHtml(formatDateRu(state.selectedDate)) + ' занятий нет.</div>';
    return;
  }

  const slots = fixedBellSlots(fixedBellMode(state.selectedDate));
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const isToday = state.selectedDate === todayKey();
  let html = '';

  const mapped = lessons.map(lesson => {
    const bell = fixedBellForLesson(lesson.time, slots);
    const start = bell ? timeToMinutes(bell[0]) : timeToMinutes(lesson.time);
    const end = bell ? timeToMinutes(bell[1]) : start + 45;
    return { lesson, bell, start, end };
  });

  mapped.forEach((item, index) => {
    const next = mapped[index + 1] || null;
    const current = isToday && nowMinutes >= item.start && nowMinutes < item.end;
    const progress = current
      ? Math.round(((nowMinutes - item.start) / Math.max(1, item.end - item.start)) * 100)
      : 0;
    const room = item.lesson.room
      ? 'Кабинет: ' + escapeHtml(item.lesson.room)
      : 'Кабинет не указан';

    html += '<div class="lesson' + (current ? ' lesson-current' : '') + '">' +
      '<div class="lesson-time">' + escapeHtml(item.lesson.time) +
      (item.bell ? '<div class="lesson-bell">Звонок ' + item.bell[0] + '–' + item.bell[1] + '</div>' : '') +
      '</div>' +
      '<div>' +
      '<div class="lesson-name">' + escapeHtml(item.lesson.lesson) + '</div>' +
      '<div class="lesson-room">' + room + '</div>' +
      (current
        ? '<div class="lesson-current-badge">Сейчас • ' + progress + '%</div><div class="lesson-progress"><span style="width:' + progress + '%"></span></div>'
        : '') +
      '</div></div>';

    if (next && item.end < next.start) {
      const breakMinutes = next.start - item.end;
      const breakCurrent = isToday && nowMinutes >= item.end && nowMinutes < next.start;
      const breakElapsed = breakCurrent ? nowMinutes - item.end : 0;
      const nextText = next.bell ? next.bell[0] : next.lesson.time;

      html += '<div class="break-card' + (breakCurrent ? ' current' : '') + '">' +
        '<span class="break-dot"></span>' +
        '<span>' +
        (breakCurrent ? 'Перемена • идёт ' + breakElapsed + ' мин' : 'Перемена • ' + breakMinutes + ' мин') +
        ' <b>до ' + escapeHtml(nextText) + '</b></span></div>';
    }
  });

  container.innerHTML = html;
};

setTimeout(() => {
  try {
    updateBellSchedule();
    updateSchedule();
  } catch (e) {
    console.error('Bell schedule fix:', e);
  }
}, 0);

})();
