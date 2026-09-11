(() => {
'use strict';

const STYLE_ID = 'schedule-extras-style';
if (!document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
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
    .lesson-progress.paused .lesson-progress-fill { width:0!important; }
    .free-windows-card {
      margin: 13px 0 14px;
      padding: 13px;
      border-radius: 17px;
      background:#151119;
      border:1px solid rgba(255,255,255,.055);
    }
    .free-windows-title { display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px; }
    .free-windows-title strong { font-size:13px; }
    .free-windows-title span { font-size:10px;color:#817987; }
    .free-window-row { display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 0;border-top:1px solid rgba(255,255,255,.045);font-size:11px; }
    .free-window-row:first-child { border-top:0; }
    .free-window-time { color:var(--accent,#a66cff);font-weight:800; }
    .free-window-duration { color:#918895; }
    .free-windows-empty { color:#817987;font-size:11px;line-height:1.4; }
    html[data-theme=light] .free-windows-card,.theme-light .free-windows-card { background:#fff;border-color:rgba(0,0,0,.08); }
    html[data-theme=light] .lesson-progress,.theme-light .lesson-progress { border-color:rgba(0,0,0,.07); }
    html[data-theme=light] .lesson-progress-track,.theme-light .lesson-progress-track { background:rgba(0,0,0,.08); }
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
  const end = Number.isFinite(nextStart) && nextStart > start ? nextStart : start + 90;
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

function renderProgress() {
  document.querySelectorAll('.lesson').forEach((card, index, cards) => {
    const time = card.querySelector('.lesson-time')?.textContent?.trim();
    const name = card.querySelector('.lesson-name')?.textContent?.trim();
    if (!time || !name) return;
    const items = Array.from(cards).map(c => ({
      time: c.querySelector('.lesson-time')?.textContent?.trim() || '',
      name: c.querySelector('.lesson-name')?.textContent?.trim() || ''
    }));
    makeProgress(card, {time, name}, items[index + 1]);
  });
}

function renderWindows() {
  if (typeof state === 'undefined' || !state.data || !state.selectedDate || !state.selectedGroup) return;
  const page = document.getElementById('schedulePage');
  if (!page) return;
  const list = state.data[state.selectedDate]?.[state.selectedGroup];
  if (!Array.isArray(list)) return;
  const lessons = list.slice().sort((a,b)=>toMinutes(a.time)-toMinutes(b.time));
  let card = page.querySelector('.free-windows-card');
  if (!card) {
    card = document.createElement('section');
    card.className = 'free-windows-card';
    const scheduleList = page.querySelector('.schedule-list');
    if (scheduleList) scheduleList.insertAdjacentElement('afterend', card);
    else page.appendChild(card);
  }
  const windows = [];
  for (let i=0;i<lessons.length-1;i++) {
    const a = toMinutes(lessons[i].time), b = toMinutes(lessons[i+1].time);
    if (!Number.isFinite(a)||!Number.isFinite(b)||b<=a) continue;
    const gap = b-a;
    if (gap >= 30) windows.push({from:lessons[i].time,to:lessons[i+1].time,minutes:gap});
  }
  card.innerHTML = `<div class="free-windows-title"><strong>⏳ Свободные окна</strong><span>${windows.length ? windows.length+' найдено' : 'нет'}</span></div>${windows.length ? windows.map(w=>`<div class="free-window-row"><span class="free-window-time">${w.from} → ${w.to}</span><span class="free-window-duration">${w.minutes} мин.</span></div>`).join('') : '<div class="free-windows-empty">Сегодня между парами нет длинных свободных окон.</div>'}`;
}

function sendWidget() {
  if (!window.Android || typeof Android.updateWidgetData !== 'function') return;
  if (typeof state === 'undefined' || !state.data || !state.selectedGroup) return;
  const lessons=[];
  Object.keys(state.data).forEach(date=>{
    const list=state.data[date]?.[state.selectedGroup];
    if (Array.isArray(list)) list.forEach(x=>lessons.push({date,time:x.time,lesson:x.lesson,room:x.room||'',group:state.selectedGroup}));
  });
  let accent='#A66CFF';
  try { accent=JSON.parse(localStorage.getItem('scheduleapp.theme.v3')||'{}').accent || accent; } catch(e) {}
  try { Android.updateWidgetData(JSON.stringify(lessons), accent); } catch(e) { console.error(e); }
}

function refreshAll(){renderProgress();renderWindows();sendWidget();}
window.addEventListener('scheduleapp:data-ready',()=>setTimeout(refreshAll,50));
setInterval(()=>{renderProgress();sendWidget();},30000);
setInterval(renderWindows,1500);
if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(refreshAll,400));
else setTimeout(refreshAll,400);
})();
