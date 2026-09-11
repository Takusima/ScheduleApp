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
  const maxRows = Math.min(rows.length, 6);
  for (let r = 0; r < maxRows; r++) {
    const row = rows[r] || [];
    for (let c = 0; c < row.length - 1; c++) {
      const left = clean(row[c]);
      const right = clean(row[c + 1]);
      if (!/^каб\.?$/i.test(left) || !isGroupName(right)) continue;
      if (result.some(item => item.name === right)) continue;
      result.push({ name: right, column: c + 1 });
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
self.onmessage = function(event) {
  const file = event.data || {};
  try {
    const workbook = XLSX.read(file.data, { type: 'base64', cellDates: true });
    const lessons = [];
    workbook.SheetNames.forEach(sheetName => {
      const name = normalize(sheetName);
      if (name !== 'лекции' && !name.includes('лекци')) return;
      lessons.push(...parseLectureSheet(workbook.Sheets[sheetName], file.name));
    });
    self.postMessage({ ok: true, name: file.name, lessons });
  } catch (error) {
    self.postMessage({ ok: false, name: file.name, error: String(error && (error.message || error)) });
  }
};
