importScripts('./xlsx.full.min.js');

function clean(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
}
function normalize(value) { return clean(value).toLowerCase().replace(/ё/g, 'е'); }
function pad(n) { return String(n).padStart(2, '0'); }
function dateKey(y, m, d) { return String(y) + '-' + pad(m) + '-' + pad(d); }
function inferYearFromFileName(name) {
  const text = clean(name);
  let match = text.match(/(?:^|[^\d])((?:19|20)\d{2})(?:[^\d]|$)/);
  if (match) return Number(match[1]);
  match = text.match(/(\d{1,2})[.\-_](\d{1,2})[.\-_]((?:19|20)\d{2})/);
  if (match) return Number(match[3]);
  return new Date().getFullYear();
}
function excelSerialToDate(value) {
  if (typeof value !== 'number' || !isFinite(value)) return null;
  const utc = Math.round((value - 25569) * 86400 * 1000);
  const date = new Date(utc);
  if (isNaN(date.getTime())) return null;
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}
function parseDateValue(value, fallbackYear) {
  if (value instanceof Date && !isNaN(value.getTime())) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  if (typeof value === 'number') return excelSerialToDate(value);
  const text = clean(value);
  if (!text) return null;
  const normalized = text.replace(/^(пн|вт|ср|чт|пт|сб|вс)\s*/i, '').trim();
  let match = normalized.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/);
  if (match) return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  match = normalized.match(/^(\d{1,2})[.\-/](\d{1,2})/);
  if (match) return new Date(fallbackYear, Number(match[2]) - 1, Number(match[1]));
  const generic = new Date(text);
  if (!isNaN(generic.getTime())) return new Date(generic.getFullYear(), generic.getMonth(), generic.getDate());
  return null;
}
function formatTime(value) {
  if (value === null || value === undefined || value === '') return '';
  if (value instanceof Date) return pad(value.getHours()) + ':' + pad(value.getMinutes());
  if (typeof value === 'number' && value >= 0 && value < 1) {
    const total = Math.round(value * 24 * 60);
    return pad(Math.floor(total / 60)) + ':' + pad(total % 60);
  }
  const text = clean(value);
  const match = text.match(/(\d{1,2})\s*[:.]\s*(\d{2})/);
  return match ? pad(Number(match[1])) + ':' + match[2] : text;
}
function isGroupName(value) {
  const text = clean(value);
  if (!text) return false;
  const lower = normalize(text);
  if (lower === 'каб' || lower.includes('на базе')) return false;
  return /^\d/.test(text);
}
function findGroupsInSheet(rows) {
  const result = [];
  const headerRows = Math.min(rows.length, 12);

  // Основной формат КМК: в заголовке перед группой стоит «каб».
  for (let r = 0; r < headerRows; r++) {
    const row = rows[r] || [];
    for (let c = 0; c < row.length - 1; c++) {
      const left = clean(row[c]);
      const right = clean(row[c + 1]);
      if (!/^каб\.?$/i.test(left) || !isGroupName(right)) continue;
      if (result.some(item => item.name === right)) continue;
      result.push({ name: right, column: c + 1 });
    }
  }

  // Резервный вариант для новых таблиц, где «каб» не хранится
  // рядом с названием группы. Ищем только явные названия групп,
  // чтобы даты/время/числа не стали группами.
  if (!result.length) {
    for (let r = 0; r < headerRows; r++) {
      const row = rows[r] || [];
      for (let c = 0; c < row.length; c++) {
        const value = clean(row[c]);
        if (!/^(?:\d{1,2})\s+(?:класс|м\/с)$/i.test(value)) continue;
        if (!isGroupName(value)) continue;
        if (result.some(item => item.name === value)) continue;
        result.push({ name: value, column: c });
      }
    }
  }

  return result;
}
function parseLectureSheet(sheet, fileName) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
  if (!rows || !rows.length) return [];
  const groups = findGroupsInSheet(rows);
  if (!groups.length) return [];
  const fallbackYear = inferYearFromFileName(fileName);
  const lessons = [];
  let currentDate = null;
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] || [];
    const possibleDate = parseDateValue(row[0], fallbackYear);
    if (possibleDate) currentDate = dateKey(possibleDate.getFullYear(), possibleDate.getMonth() + 1, possibleDate.getDate());
    const time = formatTime(row[1]);
    if (!currentDate || !time) continue;
    groups.forEach(group => {
      const lesson = clean(row[group.column]);
      if (!lesson || normalize(lesson) === 'каб') return;
      let room = group.column > 0 ? clean(row[group.column - 1]) : '';
      if (normalize(room) === 'каб') room = '';
      lessons.push({ date: currentDate, group: group.name, time, lesson, room, file: fileName });
    });
  }
  return lessons;
}

async function loadWorkbook(file) {
  if (file.url) {
    const response = await fetch(file.url, { cache: 'no-store' });
    if (!response.ok) throw new Error('Не удалось получить Excel-файл: HTTP ' + response.status);
    const buffer = await response.arrayBuffer();
    return XLSX.read(buffer, { type: 'array', cellDates: true });
  }

  if (file.data) {
    return XLSX.read(file.data, { type: 'base64', cellDates: true });
  }

  throw new Error('Excel-файл не содержит данных');
}

function parseFlexibleScheduleSheet(sheet, fileName) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
  if (!rows || !rows.length) return [];

  const groups = findGroupsInSheet(rows);
  if (!groups.length) return [];

  const fallbackYear = inferYearFromFileName(fileName);
  const lessons = [];
  let currentDate = null;

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] || [];

    // Реальные файлы КМК встречаются в нескольких вариантах:
    // дата может быть в A/B/C, время — в A/B/C/D/E.
    // Сначала ищем дату только в первых 3 колонках, чтобы не принять
    // номер группы или кабинет за дату.
    let rowDate = null;
    for (let c = 0; c < Math.min(3, row.length); c++) {
      const candidate = parseDateValue(row[c], fallbackYear);
      if (candidate) {
        rowDate = candidate;
        break;
      }
    }
    if (rowDate) {
      currentDate = dateKey(
        rowDate.getFullYear(),
        rowDate.getMonth() + 1,
        rowDate.getDate()
      );
    }

    let time = '';
    for (let c = 0; c < Math.min(5, row.length); c++) {
      const candidate = formatTime(row[c]);
      if (/^\d{2}:\d{2}$/.test(candidate)) {
        time = candidate;
        break;
      }
    }

    if (!currentDate || !time) continue;

    groups.forEach(group => {
      const lesson = clean(row[group.column]);
      if (!lesson) return;
      const normalizedLesson = normalize(lesson);
      if (
        normalizedLesson === 'каб' ||
        normalizedLesson === normalize(group.name) ||
        normalizedLesson === '10 м/с'
      ) return;

      let room = group.column > 0 ? clean(row[group.column - 1]) : '';
      if (normalize(room) === 'каб') room = '';

      lessons.push({
        date: currentDate,
        group: group.name,
        time,
        lesson,
        room,
        file: fileName
      });
    });
  }

  return lessons;
}

self.onmessage = async function(event) {
  const file = event.data || {};
  try {
    const workbook = await loadWorkbook(file);
    const lessons = [];
    let lectureSheetsFound = false;

    workbook.SheetNames.forEach(sheetName => {
      const name = normalize(sheetName);
      if (name === 'лекции' || name.includes('лекци')) {
        lectureSheetsFound = true;
        lessons.push(...parseLectureSheet(workbook.Sheets[sheetName], file.name));
      }
    });

    // Если «Лекции» не дал занятий, разбираем все листы по фактической
    // структуре. Это возвращает совместимость со старыми и новыми Excel.
    if (!lessons.length) {
      workbook.SheetNames.forEach(sheetName => {
        lessons.push(...parseFlexibleScheduleSheet(workbook.Sheets[sheetName], file.name));
      });
    }

    self.postMessage({
      ok: true,
      name: file.name,
      lessons,
      fallback: !lectureSheetsFound || lessons.length === 0
    });
  } catch (error) {
    self.postMessage({
      ok: false,
      name: file.name,
      error: String(error && (error.message || error))
    });
  }
};
