(() => {
'use strict';

/* Расписание КМК: одна запись Excel соответствует целой паре. */
const WEEKDAY_PAIRS = [
  ['1','09:00','10:40','09:00','09:45','09:55','10:40'],
  ['2','10:50','12:30','10:50','11:35','11:45','12:30'],
  ['3','13:10','14:50','13:10','13:55','14:05','14:50'],
  ['4','15:00','16:40','15:00','15:45','15:55','16:40'],
  ['5','16:50','18:30','16:50','17:35','17:45','18:30']
];
const SATURDAY_PAIRS = [
  ['1','09:00','10:40','09:00','09:45','09:55','10:40'],
  ['2','10:50','12:30','10:50','11:35','11:45','12:30'],
  ['3','12:40','14:20','12:40','13:25','13:35','14:20']
];
function hasLessons(key) {
  try {
    return !!(typeof state !== 'undefined' && state.data && state.data[key] &&
      state.selectedGroup && Array.isArray(state.data[key][state.selectedGroup]) &&
      state.data[key][state.selectedGroup].length);
  } catch (_) { return false; }
}
function isRussianPublicHoliday(date) {
  const m=date.getMonth()+1,d=date.getDate();
  return (m===1&&d>=1&&d<=8)||(m===2&&d===23)||(m===3&&d===8)||
    (m===5&&(d===1||d===9))||(m===6&&d===12)||(m===11&&d===4);
}
function fixedBellMode(key) {
  const value=key||todayKey(), date=parseDateKey(value);
  if(!date)return 'weekday';
  if(isRussianPublicHoliday(date)&&!hasLessons(value))return 'holiday';
  if(date.getDay()===0&&!hasLessons(value))return 'sunday';
  return date.getDay()===6?'saturday':'weekday';
}
function fixedBellSlots(mode) {
  if(mode==='saturday')return SATURDAY_PAIRS.map(x=>[x[0],x[1],x[2]]);
  if(mode==='weekday')return WEEKDAY_PAIRS.map(x=>[x[0],x[1],x[2]]);
  return [];
}
function fixedBellRows(mode) {
  return mode==='saturday'?SATURDAY_PAIRS:mode==='weekday'?WEEKDAY_PAIRS:[];
}
function toMinutes(value) {
  const m=String(value||'').match(/^(\d{1,2})[:.](\d{2})/);
  return m?Number(m[1])*60+Number(m[2]):NaN;
}
function toTime(value) {
  return String(Math.floor(value/60)).padStart(2,'0')+':'+String(value%60).padStart(2,'0');
}
function safeTime(value) {
  const m=String(value||'').match(/^(\d{1,2})[:.](\d{2})/);
  return m?String(m[1]).padStart(2,'0')+':'+m[2]:'';
}
window.getBellMode=fixedBellMode;
window.bellSlotsForMode=fixedBellSlots;
window.bellRowsForMode=fixedBellRows;

window.updateBellSchedule=function() {
  const card=document.getElementById('bellScheduleCard'),modeEl=document.getElementById('bellMode'),details=document.getElementById('bellDetails');
  if(!card||!modeEl||!details)return;
  const selected=state.selectedDate||todayKey(),mode=fixedBellMode(selected);
  modeEl.textContent=({weekday:'Будни · 5 пар',saturday:'Суббота · 3 пары',sunday:'Воскресенье · выходной',holiday:'Праздник · занятий нет'})[mode]||'Будни · 5 пар';
  if(mode==='sunday'||mode==='holiday') {
    details.innerHTML='<div class="empty">'+(mode==='sunday'?'Воскресенье — выходной день.':'На праздничный день в загруженном расписании занятий нет.')+'</div>';
    return;
  }
  const now=new Date(),minutes=now.getHours()*60+now.getMinutes();
  details.innerHTML=fixedBellRows(mode).map(row=>{
    const current=selected===todayKey()&&
      ((minutes>=toMinutes(row[3])&&minutes<toMinutes(row[4]))||(minutes>=toMinutes(row[5])&&minutes<toMinutes(row[6])));
    return '<div class="bell-row'+(current?' current':'')+'"><div class="bell-num">'+row[0]+'</div>'+
      '<div class="bell-time"><span>'+row[3]+'–'+row[4]+'</span><span>'+row[5]+'–'+row[6]+'</span></div>'+
      '<div class="bell-status">'+(current?'Сейчас':'')+'</div></div>';
  }).join('');
};

window.updateSchedule=function() {
  const container=document.getElementById('schedule');
  if(!container)return;
  if(!state.files.length){container.innerHTML='<div class="empty">Нет загруженных Excel-файлов.<br><br>Нажмите «Обновить» или загрузите Excel в Настройках.</div>';return;}
  if(!state.selectedGroup||!state.selectedDate){container.innerHTML='<div class="empty">Выберите группу и дату.</div>';return;}
  const lessons=state.data[state.selectedDate]&&state.data[state.selectedDate][state.selectedGroup];
  if(!lessons||!lessons.length){container.innerHTML='<div class="empty">На '+escapeHtml(formatDateRu(state.selectedDate))+' занятий нет.</div>';return;}

  const mode=fixedBellMode(state.selectedDate),slots=fixedBellSlots(mode);
  const now=new Date(),nowMinutes=now.getHours()*60+now.getMinutes(),isToday=state.selectedDate===todayKey();
  const mapped=lessons.map((lesson,index)=>{
    const sourceStart=toMinutes(lesson.time);
    let slot=Number.isFinite(sourceStart)?slots.find(x=>toMinutes(x[1])===sourceStart):null;
    if(!slot&&!Number.isFinite(sourceStart))slot=slots[index]||null;
    const start=slot?toMinutes(slot[1]):sourceStart;
    const end=slot?toMinutes(slot[2]):(Number.isFinite(sourceStart)?sourceStart+90:start+90);
    return {lesson,slot,start,end};
  }).filter(x=>Number.isFinite(x.start)&&Number.isFinite(x.end)).sort((a,b)=>a.start-b.start);

  let html='';
  mapped.forEach((item,index)=>{
    const next=mapped[index+1]||null;
    const current=isToday&&nowMinutes>=item.start&&nowMinutes<item.end;
    const progress=current?Math.round(((nowMinutes-item.start)/Math.max(1,item.end-item.start))*100):0;
    const room=item.lesson.room?'Кабинет: '+escapeHtml(item.lesson.room):'Кабинет не указан';
    const shownTime=item.slot?item.slot[1]+'–'+item.slot[2]:(safeTime(item.lesson.time)||'Время не указано');
    html+='<div class="lesson'+(current?' lesson-current':'')+'"><div class="lesson-time">'+escapeHtml(shownTime)+
      (item.slot?'<div class="lesson-bell">Пара '+item.slot[0]+'</div>':'')+'</div><div>'+
      '<div class="lesson-name">'+escapeHtml(item.lesson.lesson)+'</div><div class="lesson-room">'+room+'</div>'+
      (current?'<div class="lesson-current-badge">Сейчас • '+progress+'%</div><div class="lesson-progress"><span style="width:'+progress+'%"></span></div>':'')+'</div></div>';
    if(next&&item.end<next.start){
      const breakMinutes=next.start-item.end,breakCurrent=isToday&&nowMinutes>=item.end&&nowMinutes<next.start;
      const breakElapsed=breakCurrent?nowMinutes-item.end:0;
      html+='<div class="break-card'+(breakCurrent?' current':'')+'"><span class="break-dot"></span><span>'+
        (breakCurrent?'Перемена • идёт '+breakElapsed+' мин':'Перемена • '+breakMinutes+' мин')+
        ' <b>до '+escapeHtml(toTime(next.start))+'</b></span></div>';
    }
  });
  container.innerHTML=html||'<div class="empty">Нет занятий на выбранную дату.</div>';
};
setTimeout(()=>{try{updateBellSchedule();updateSchedule();}catch(e){console.error('Bell schedule fix:',e);}},0);
})();