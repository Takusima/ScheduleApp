(()=>{
'use strict';

const KEY='scheduleapp.reminders.v2';
const FAV='scheduleapp.favorites.v1';
const NOTES='scheduleapp.notes.v1';

const defaults={enabled:false,minutes:10,sound:'alarm'};
let settings={...defaults};
let favorites=[];
let notes={};

try{settings={...defaults,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch(e){}
try{favorites=JSON.parse(localStorage.getItem(FAV)||'[]')}catch(e){}
try{notes=JSON.parse(localStorage.getItem(NOTES)||'{}')}catch(e){}

const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#039;');
const save=()=>localStorage.setItem(KEY,JSON.stringify(settings));
const saveFav=()=>localStorage.setItem(FAV,JSON.stringify(favorites));
const saveNotes=()=>localStorage.setItem(NOTES,JSON.stringify(notes));

const style=document.createElement('style');
style.textContent=`
#schedule-reminders,#schedule-favorites,#schedule-author{padding:16px;margin-bottom:11px;border-radius:19px;background:#151119;border:1px solid rgba(255,255,255,.055);box-sizing:border-box}
#schedule-reminders h3,#schedule-favorites h3,#schedule-author h3{margin:0 0 6px;font-size:15px}
#schedule-reminders p,#schedule-favorites p,#schedule-author p{margin:0 0 13px;color:#817987;font-size:12px;line-height:1.45}
.rem-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.rem-title{font-size:13px;font-weight:700}
.switch{position:relative;width:52px;height:30px;border-radius:20px;background:#3a3440;border:1px solid rgba(255,255,255,.08);flex:0 0 auto;padding:0}.switch i{position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;background:#b9b2bd;transition:.2s}.switch.on{background:var(--accentSoft);border-color:var(--accentBorder)}.switch.on i{left:25px;background:var(--accent)}
.rem-options,.sound-options{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:12px}.rem-opt,.sound-opt{height:39px;border-radius:11px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.07);color:inherit;font-size:11px}.rem-opt.on,.sound-opt.on{color:var(--accent);background:var(--accentSoft);border-color:var(--accentBorder)}
.rem-status{margin-top:9px;font-size:11px;color:#817987;line-height:1.4}
.favorite-summary{display:flex;flex-wrap:wrap;gap:6px}.favorite-chip{padding:7px 10px;border-radius:10px;background:var(--accentSoft);border:1px solid var(--accentBorder);font-size:11px;color:var(--accent)}
.lesson{padding-right:58px;position:relative}
.lesson-favorite{position:absolute!important;right:12px!important;top:12px!important;width:40px!important;height:40px!important;margin:0!important;padding:0!important;border-radius:13px!important;background:rgba(255,255,255,.045)!important;border:1px solid rgba(255,255,255,.06)!important;color:#77707f!important;font-size:23px!important;line-height:38px!important;text-align:center!important;display:flex!important;align-items:center!important;justify-content:center!important;z-index:20!important;transition:transform .16s ease,background .16s ease,color .16s ease,box-shadow .16s ease!important;cursor:pointer!important;touch-action:manipulation!important}
.lesson-favorite:active{transform:scale(.88)!important}.lesson-favorite.on{color:#ffd86a!important;background:rgba(255,216,106,.10)!important;border-color:rgba(255,216,106,.28)!important;text-shadow:0 0 8px rgba(255,216,106,.75),0 0 16px rgba(255,216,106,.3)!important;box-shadow:0 0 16px rgba(255,216,106,.12)!important}
.lesson-note-wrap{grid-column:1/-1!important;display:block!important;width:100%!important;margin-top:12px!important;box-sizing:border-box!important}.lesson-note-card{display:block;width:100%;box-sizing:border-box;padding:10px 11px;border-radius:13px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.055);margin-bottom:8px}.lesson-note-label{font-size:10px;font-weight:800;color:var(--accent);margin-bottom:5px}.lesson-note-text{display:block;width:100%;box-sizing:border-box;color:#d0c8d3;font-size:12px;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere}.lesson-note-btn{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:34px!important;margin:0!important;padding:7px 12px!important;border-radius:10px!important;background:rgba(255,255,255,.045)!important;border:1px solid rgba(255,255,255,.07)!important;color:#a39aa7!important;font-size:11px!important;cursor:pointer!important;touch-action:manipulation!important}.lesson-note-btn.has-note{color:var(--accent)!important;background:var(--accentSoft)!important;border-color:var(--accentBorder)!important}
#schedule-toast{position:fixed;left:50%;bottom:94px;transform:translate(-50%,14px);z-index:6000;max-width:calc(100vw - 34px);padding:10px 14px;border-radius:13px;background:rgba(30,24,36,.96);border:1px solid var(--accentBorder);box-shadow:0 12px 35px rgba(0,0,0,.38);color:#eee8f1;font-size:12px;font-weight:700;text-align:center;opacity:0;pointer-events:none;transition:opacity .18s ease,transform .18s ease;backdrop-filter:blur(10px)}#schedule-toast.show{opacity:1;transform:translate(-50%,0)}
#schedule-note-modal{position:fixed;inset:0;z-index:5000;display:none;align-items:flex-end;justify-content:center;padding:14px;box-sizing:border-box;background:rgba(0,0,0,.58);backdrop-filter:blur(9px)}#schedule-note-modal.open{display:flex}
.note-sheet{width:100%;max-width:520px;border-radius:25px 25px 18px 18px;padding:18px;background:linear-gradient(180deg,#201728,#17121d);border:1px solid rgba(255,255,255,.09);box-shadow:0 -20px 70px rgba(0,0,0,.55);box-sizing:border-box;animation:noteUp .2s ease-out}.note-head{display:flex;align-items:center;gap:10px;margin-bottom:13px}.note-icon{width:40px;height:40px;border-radius:13px;display:flex;align-items:center;justify-content:center;background:var(--accentSoft);border:1px solid var(--accentBorder);font-size:20px}.note-head-text{flex:1;min-width:0}.note-title{font-size:15px;font-weight:800}.note-subtitle{margin-top:3px;color:#817987;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.note-close{width:38px;height:38px;border:0;border-radius:12px;background:rgba(255,255,255,.06);color:#c9c2cc;font-size:24px;line-height:38px}.note-textarea{display:block;width:100%;min-height:125px;max-height:230px;resize:vertical;box-sizing:border-box;border:1px solid rgba(255,255,255,.09);border-radius:15px;background:rgba(0,0,0,.22);color:#eee9f1;padding:13px;outline:none;font:inherit;font-size:13px;line-height:1.45}.note-textarea:focus{border-color:var(--accentBorder);box-shadow:0 0 0 3px var(--accentSoft)}.note-actions{display:grid;grid-template-columns:1fr 1.5fr;gap:8px;margin-top:10px}.note-action{height:44px;border-radius:13px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.055);color:#d7d1da;font-weight:700}.note-action.primary{background:linear-gradient(135deg,var(--accent),var(--accent2));border-color:transparent;color:white}.note-action.delete{color:#d68b9b}
.author-row{display:flex;align-items:center;gap:12px}.author-avatar{width:48px;height:48px;border-radius:15px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--accent),var(--accent2));font-size:23px;box-shadow:0 8px 25px rgba(0,0,0,.25)}.author-info{min-width:0}.author-name{font-size:14px;font-weight:800}.author-line{margin-top:3px;color:#918894;font-size:11px;line-height:1.35}.author-tg{margin-top:9px;display:inline-flex;padding:8px 11px;border-radius:10px;background:var(--accentSoft);border:1px solid var(--accentBorder);color:var(--accent);font-size:11px;font-weight:800;cursor:pointer;touch-action:manipulation}
html[data-theme=light] #schedule-reminders,html[data-theme=light] #schedule-favorites,html[data-theme=light] #schedule-author,.theme-light #schedule-reminders,.theme-light #schedule-favorites,.theme-light #schedule-author{background:#fff;border-color:rgba(0,0,0,.08)}html[data-theme=light] .note-sheet,.theme-light .note-sheet{background:#fff;color:#242128}html[data-theme=light] .note-textarea,.theme-light .note-textarea{background:#f3f2f5;color:#242128;border-color:rgba(0,0,0,.1)}html[data-theme=light] .switch,.theme-light .switch{background:#e1dfe5}html[data-theme=light] .lesson-note-card,.theme-light .lesson-note-card{background:#f4f2f6;border-color:rgba(0,0,0,.07)}html[data-theme=light] .lesson-note-text,.theme-light .lesson-note-text{color:#3f3942}
@keyframes noteUp{from{transform:translateY(25px);opacity:.6}to{transform:translateY(0);opacity:1}}
@media(max-width:360px){.rem-options,.sound-options{grid-template-columns:repeat(2,1fr)}.lesson-favorite{right:9px!important;top:9px!important}.lesson{padding-right:52px}}
`;
document.head.appendChild(style);

function payload(){
  if(typeof state==='undefined'||!state.data||!state.selectedGroup)return[];
  const out=[];
  Object.keys(state.data).forEach(date=>{
    const list=state.data[date]&&state.data[date][state.selectedGroup];
    if(!Array.isArray(list))return;
    list.forEach(x=>out.push({date,time:x.time,lesson:x.lesson,room:x.room||'',group:state.selectedGroup}));
  });
  return out;
}
function send(){
  if(!window.Android||typeof Android.setLessonReminders!=='function')return;
  try{Android.setLessonReminders(!!settings.enabled,Number(settings.minutes)||10,'10 м/с',settings.sound||'alarm',JSON.stringify(payload()))}catch(e){console.error(e)}
}

function showToast(text){
  let t=document.getElementById('schedule-toast');
  if(!t){t=document.createElement('div');t.id='schedule-toast';document.body.appendChild(t)}
  t.textContent=text;
  t.classList.remove('show');
  requestAnimationFrame(()=>t.classList.add('show'));
  clearTimeout(showToast.timer);
  showToast.timer=setTimeout(()=>t.classList.remove('show'),1700);
}

function renderReminders(){
  const pg=document.getElementById('settingsPage');
  if(!pg||document.getElementById('schedule-reminders'))return;
  const box=document.createElement('div');box.id='schedule-reminders';
  box.innerHTML=`<h3>⏰ Напоминания о парах</h3><p>Приложение заранее предупредит о следующей паре звуком и уведомлением.</p><div class="rem-head"><span class="rem-title">Уведомлять о парах</span><button class="switch ${settings.enabled?'on':''}" id="remSwitch" type="button"><i></i></button></div><div class="rem-options">${[5,10,15,30].map(v=>`<button class="rem-opt ${settings.minutes===v?'on':''}" data-min="${v}" type="button">За ${v} мин.</button>`).join('')}</div><div class="sound-options">${[['alarm','🔔 Звук'],['vibrate','📳 Вибрация'],['silent','🔕 Тихо'],['both','🔔📳 Оба']].map(x=>`<button class="sound-opt ${settings.sound===x[0]?'on':''}" data-sound="${x[0]}" type="button">${x[1]}</button>`).join('')}</div><div class="rem-status" id="remStatus"></div>`;
  pg.insertBefore(box,pg.firstChild);
  const refresh=()=>{box.querySelector('#remStatus').textContent=!settings.enabled?'Выключено':`Включено • за ${settings.minutes} мин. • ${settings.sound==='alarm'?'звук':settings.sound==='vibrate'?'вибрация':settings.sound==='both'?'звук + вибрация':'тихо'}`;box.querySelectorAll('.rem-opt,.sound-opt').forEach(b=>b.disabled=!settings.enabled)};
  box.querySelector('#remSwitch').onclick=()=>{settings.enabled=!settings.enabled;save();box.querySelector('#remSwitch').classList.toggle('on',settings.enabled);refresh();send()};
  box.querySelectorAll('.rem-opt').forEach(b=>b.onclick=()=>{settings.minutes=Number(b.dataset.min);save();box.querySelectorAll('.rem-opt').forEach(x=>x.classList.toggle('on',Number(x.dataset.min)===settings.minutes));refresh();send()});
  box.querySelectorAll('.sound-opt').forEach(b=>b.onclick=()=>{settings.sound=b.dataset.sound;save();box.querySelectorAll('.sound-opt').forEach(x=>x.classList.toggle('on',x.dataset.sound===settings.sound));refresh();send()});
  refresh();
}

function renderFavorites(){
  const pg=document.getElementById('settingsPage');
  if(!pg)return;
  let box=document.getElementById('schedule-favorites');
  if(!box){box=document.createElement('div');box.id='schedule-favorites';pg.appendChild(box)}
  box.innerHTML=`<h3>⭐ Избранные предметы</h3><p>Нажимай звёздочку на карточке пары. Избранные предметы будут подсвечиваться.</p><div class="favorite-summary">${favorites.length?favorites.map(x=>`<span class="favorite-chip">★ ${esc(x)}</span>`).join(''):'<span style="color:#817987;font-size:11px">Пока ничего не добавлено</span>'}</div>`;
}

function renderAuthor(){
  const pg=document.getElementById('settingsPage');
  if(!pg)return;
  let box=document.getElementById('schedule-author');
  if(!box){box=document.createElement('div');box.id='schedule-author';pg.appendChild(box)}
  box.innerHTML=`<h3>👨‍💻 Автор</h3><div class="author-row"><div class="author-avatar">T</div><div class="author-info"><div class="author-name">Takusima</div><div class="author-line">Симаченко Станислав . Р<br>Группа КМК 10 м/с</div><button class="author-tg" id="authorTelegram" type="button">Telegram: @takusima</button></div></div>`;
  box.querySelector('#authorTelegram').onclick=e=>{e.preventDefault();e.stopPropagation();if(window.Android&&typeof Android.openTelegram==='function')Android.openTelegram();else window.location.href='https://t.me/takusima';};
}

function lessonKey(d){
  const day=(typeof state!=='undefined'&&state.selectedDate)||document.querySelector('.day-btn.active')?.textContent?.replace(/\s+/g,' ').trim()||'day';
  return `${typeof state!=='undefined'?(state.selectedGroup||''):'10 м/с'}|${day}|${d.time||''}|${d.name||''}`;
}
function getLessonText(card){
  return {name:card.querySelector('.lesson-name')?.textContent?.trim()||'',time:card.querySelector('.lesson-time')?.textContent?.trim()||'',room:card.querySelector('.lesson-room')?.textContent?.trim()||''};
}

function ensureNoteModal(){
  let modal=document.getElementById('schedule-note-modal');
  if(modal)return modal;
  modal=document.createElement('div');
  modal.id='schedule-note-modal';
  modal.innerHTML=`<div class="note-sheet"><div class="note-head"><div class="note-icon">📝</div><div class="note-head-text"><div class="note-title" id="noteTitle">Заметка</div><div class="note-subtitle" id="noteSubtitle">Личная заметка к паре</div></div><button class="note-close" id="noteClose" type="button">×</button></div><textarea class="note-textarea" id="noteText" maxlength="1000" placeholder="Напиши здесь что-нибудь к этой паре..."></textarea><div class="note-actions"><button class="note-action delete" id="noteDelete" type="button">Удалить</button><button class="note-action primary" id="noteSave" type="button">Сохранить заметку</button></div></div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.remove('open')});
  modal.querySelector('#noteClose').onclick=()=>modal.classList.remove('open');
  modal.querySelector('#noteSave').onclick=()=>{const key=modal.dataset.key;const value=modal.querySelector('#noteText').value.trim();if(value)notes[key]=value;else delete notes[key];saveNotes();modal.classList.remove('open');decorateLessons();showToast(value?'✓ Заметка сохранена':'Заметка удалена');};
  modal.querySelector('#noteDelete').onclick=()=>{const key=modal.dataset.key;delete notes[key];saveNotes();modal.classList.remove('open');decorateLessons();showToast('Заметка удалена')};
  return modal;
}

function openNote(key,title,subtitle){
  const modal=ensureNoteModal();
  modal.dataset.key=key;
  const exists=Object.prototype.hasOwnProperty.call(notes,key)&&!!notes[key];
  modal.querySelector('#noteTitle').textContent=exists?'Изменить заметку':'Новая заметка';
  modal.querySelector('#noteSubtitle').textContent=subtitle||title||'Личная заметка к паре';
  modal.querySelector('#noteText').value=notes[key]||'';
  modal.querySelector('#noteDelete').style.display=exists?'block':'none';
  modal.classList.add('open');
  setTimeout(()=>modal.querySelector('#noteText').focus(),80);
}

function updateFavoriteButtons(){
  document.querySelectorAll('.lesson-favorite').forEach(btn=>{
    const name=btn.dataset.subject||'';
    const on=favorites.includes(name);
    btn.classList.toggle('on',on);
    btn.textContent=on?'★':'☆';
    btn.setAttribute('aria-label',on?'Убрать из избранного':'Добавить в избранное');
    btn.setAttribute('aria-pressed',on?'true':'false');
  });
}

function toggleFavorite(btn){
  const subject=btn.dataset.subject||'';
  if(!subject)return;
  const was=favorites.includes(subject);
  if(was)favorites=favorites.filter(x=>x!==subject);
  else favorites=[...favorites,subject];
  saveFav();
  updateFavoriteButtons();
  renderFavorites();
  showToast(was?'☆ Убрано из избранного':'★ Добавлено в избранное');
}

function decorateLessons(){
  document.querySelectorAll('.lesson').forEach(card=>{
    const d=getLessonText(card);
    if(!d.name)return;
    const key=lessonKey(d);

    let fav=card.querySelector('.lesson-favorite');
    if(!fav){
      fav=document.createElement('button');
      fav.className='lesson-favorite';
      fav.type='button';
      card.appendChild(fav);
    }
    fav.dataset.subject=d.name;

    let wrap=card.querySelector('.lesson-note-wrap');
    if(!wrap){
      wrap=document.createElement('div');
      wrap.className='lesson-note-wrap';
      const room=card.querySelector('.lesson-room');
      if(room&&room.parentElement===card)room.insertAdjacentElement('afterend',wrap);
      else card.appendChild(wrap);
    }

    const text=notes[key]||'';
    let noteCard=wrap.querySelector('.lesson-note-card');
    if(text){
      if(!noteCard){
        noteCard=document.createElement('div');
        noteCard.className='lesson-note-card';
        noteCard.innerHTML='<div class="lesson-note-label">📝 Заметка</div><div class="lesson-note-text"></div>';
        wrap.insertBefore(noteCard,wrap.firstChild);
      }
      noteCard.querySelector('.lesson-note-text').textContent=text;
    }else if(noteCard){
      noteCard.remove();
      noteCard=null;
    }

    let btn=wrap.querySelector('.lesson-note-btn');
    if(!btn){
      btn=document.createElement('button');
      btn.className='lesson-note-btn';
      btn.type='button';
      wrap.appendChild(btn);
    }
    btn.classList.toggle('has-note',!!text);
    btn.textContent=text?'✏️ Редактировать заметку':'📝 Добавить заметку';
    btn.dataset.noteKey=key;
    btn.dataset.noteTitle=d.name;
    btn.dataset.noteSubtitle=`${d.time||''}${d.room?' • Кабинет: '+d.room:''}`;
  });
  updateFavoriteButtons();
}

function boot(){
  renderReminders();
  renderFavorites();
  renderAuthor();
  setTimeout(send,700);
  setTimeout(decorateLessons,400);

  let lastGroup='';
  setInterval(()=>{
    if(typeof state!=='undefined'&&state.selectedGroup!==lastGroup){lastGroup=state.selectedGroup;send();}
    decorateLessons();
  },900);

  const observer=new MutationObserver(mutations=>{
    if(mutations.some(m=>m.addedNodes&&m.addedNodes.length))requestAnimationFrame(decorateLessons);
  });
  observer.observe(document.body,{childList:true,subtree:true});

  document.addEventListener('click',e=>{
    const fav=e.target.closest?.('.lesson-favorite');
    if(fav){e.preventDefault();e.stopImmediatePropagation();toggleFavorite(fav);return;}
    const note=e.target.closest?.('.lesson-note-btn');
    if(note){e.preventDefault();e.stopImmediatePropagation();openNote(note.dataset.noteKey,note.dataset.noteTitle,note.dataset.noteSubtitle);}
  },true);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,200));
else setTimeout(boot,200);
})();