(()=>{
'use strict';
const KEY='scheduleapp.reminders.v2';
const PROFILE='scheduleapp.profile.v2';
const FAV='scheduleapp.favorites.v1';
const NOTES='scheduleapp.notes.v1';
const defaults={enabled:false,minutes:10,sound:'alarm',updates:true};
let settings={...defaults};
let profile={nickname:'Takusima',name:'Симаченко Станислав. Р',group:'10 м/с'};
let favorites=[];
let notes={};
try{settings={...defaults,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch(e){}
try{profile={...profile,...JSON.parse(localStorage.getItem(PROFILE)||'{}')}}catch(e){}
try{favorites=JSON.parse(localStorage.getItem(FAV)||'[]')}catch(e){}
try{notes=JSON.parse(localStorage.getItem(NOTES)||'{}')}catch(e){}

const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
const save=()=>localStorage.setItem(KEY,JSON.stringify(settings));
const saveProfile=()=>localStorage.setItem(PROFILE,JSON.stringify(profile));
const saveFav=()=>localStorage.setItem(FAV,JSON.stringify(favorites));
const saveNotes=()=>localStorage.setItem(NOTES,JSON.stringify(notes));
const accent=()=>getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()||'#a66cff';

const style=document.createElement('style');
style.textContent=`
#schedule-reminders,#schedule-profile,#schedule-favorites{padding:16px;margin-bottom:11px;border-radius:19px;background:#151119;border:1px solid rgba(255,255,255,.055)}
#schedule-reminders h3,#schedule-profile h3,#schedule-favorites h3{margin:0 0 6px;font-size:15px}
#schedule-reminders p,#schedule-profile p,#schedule-favorites p{margin:0 0 13px;color:#817987;font-size:12px;line-height:1.45}
.rem-head,.setting-line{display:flex;align-items:center;justify-content:space-between;gap:12px}.rem-title{font-size:13px;font-weight:700}.switch{position:relative;width:52px;height:30px;border-radius:20px;background:#3a3440;border:1px solid rgba(255,255,255,.08);flex:0 0 auto}.switch i{position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;background:#b9b2bd;transition:.2s}.switch.on{background:var(--accentSoft);border-color:var(--accentBorder)}.switch.on i{left:25px;background:var(--accent)}
.rem-options,.sound-options{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:12px}.rem-opt,.sound-opt{height:39px;border-radius:11px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.07);color:inherit;font-size:11px}.rem-opt.on,.sound-opt.on{color:var(--accent);background:var(--accentSoft);border-color:var(--accentBorder)}
.rem-status{margin-top:9px;font-size:11px;color:#817987;line-height:1.4}.profile-grid{display:grid;gap:8px}.profile-input{width:100%;height:42px;border-radius:12px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.05);color:inherit;padding:0 12px;outline:none;font-size:12px}.profile-save{width:100%;height:42px;margin-top:9px;border-radius:12px;background:linear-gradient(135deg,var(--accent),var(--accent2));font-weight:700}.profile-preview{margin-top:10px;padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.04);font-size:11px;color:#9b929f;line-height:1.5}
.setting-line{padding:10px 0;border-top:1px solid rgba(255,255,255,.045)}.setting-label{font-size:12px}.setting-sub{font-size:10px;color:#817987;margin-top:3px}.favorite-summary{display:flex;flex-wrap:wrap;gap:6px}.favorite-chip{padding:7px 10px;border-radius:10px;background:var(--accentSoft);border:1px solid var(--accentBorder);font-size:11px;color:var(--accent)}
.lesson{padding-right:42px}.lesson-favorite{position:absolute;right:9px;top:9px;width:30px;height:30px;border-radius:10px;background:rgba(255,255,255,.045);color:#706978;font-size:18px;line-height:30px;text-align:center;transition:.2s}.lesson-favorite.on{color:#ffd86a;text-shadow:0 0 10px rgba(255,216,106,.8),0 0 20px rgba(255,216,106,.35);background:rgba(255,216,106,.08)}.lesson-note-btn{display:inline-flex;margin-top:7px;padding:5px 8px;border-radius:8px;background:rgba(255,255,255,.045);color:#8f8795;font-size:10px}.lesson-note-btn.has-note{color:var(--accent);background:var(--accentSoft)}
#schedule-note-modal .note-box{width:100%;max-width:500px;padding:18px;border-radius:24px;background:#19131f;border:1px solid rgba(255,255,255,.08);box-shadow:0 -10px 50px rgba(0,0,0,.5)}#schedule-note-modal textarea{width:100%;min-height:120px;resize:none;border-radius:14px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.045);color:inherit;padding:12px;outline:none;font-size:13px;line-height:1.4}#schedule-note-modal .note-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:9px}.note-action{height:42px;border-radius:12px;background:rgba(255,255,255,.06)}.note-action.primary{background:linear-gradient(135deg,var(--accent),var(--accent2));font-weight:700}
html[data-theme=light] #schedule-reminders,html[data-theme=light] #schedule-profile,html[data-theme=light] #schedule-favorites,.theme-light #schedule-reminders,.theme-light #schedule-profile,.theme-light #schedule-favorites{background:#fff;border-color:rgba(0,0,0,.08)}html[data-theme=light] .switch,.theme-light .switch{background:#e1dfe5}html[data-theme=light] .profile-input,.theme-light .profile-input{background:#eeeef2;color:#242128;border-color:rgba(0,0,0,.08)}
@media(max-width:360px){.rem-options,.sound-options{grid-template-columns:repeat(2,1fr)}}`;
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
  try{Android.setLessonReminders(!!settings.enabled,Number(settings.minutes)||10,profile.group||'',settings.sound||'alarm',JSON.stringify(payload()))}catch(e){console.error(e)}
}
function notifyUpdate(status){
  if(!settings.updates||!window.Android||typeof Android.notifyScheduleUpdated!=='function')return;
  try{Android.notifyScheduleUpdated(status||'Расписание обновлено')}catch(e){console.error(e)}
}
function renderReminders(){
  const pg=document.getElementById('settingsPage');if(!pg||document.getElementById('schedule-reminders'))return;
  const box=document.createElement('div');box.id='schedule-reminders';
  box.innerHTML=`<h3>⏰ Напоминания о парах</h3><p>Приложение заранее предупредит о следующей паре звуком и уведомлением, даже если оно закрыто.</p><div class="rem-head"><span class="rem-title">Уведомлять о парах</span><button class="switch ${settings.enabled?'on':''}" id="remSwitch" aria-label="Напоминания"><i></i></button></div><div class="rem-options">${[5,10,15,30].map(v=>`<button class="rem-opt ${settings.minutes===v?'on':''}" data-min="${v}">За ${v} мин.</button>`).join('')}</div><div class="sound-options">${[['alarm','🔔 Звук'],['vibrate','📳 Вибрация'],['silent','🔕 Тихо'],['both','🔔📳 Оба']].map(x=>`<button class="sound-opt ${settings.sound===x[0]?'on':''}" data-sound="${x[0]}">${x[1]}</button>`).join('')}</div><div class="rem-status" id="remStatus"></div><div class="setting-line"><div><div class="setting-label">🔄 Уведомлять об обновлении</div><div class="setting-sub">Сообщать, когда новое расписание успешно загружено</div></div><button class="switch ${settings.updates?'on':''}" id="updateSwitch"><i></i></button></div>`;
  pg.insertBefore(box,pg.firstChild);
  const refresh=()=>{box.querySelector('#remStatus').textContent=!settings.enabled?'Выключено':`Включено • за ${settings.minutes} мин. • ${settings.sound==='alarm'?'звук':settings.sound==='vibrate'?'вибрация':settings.sound==='both'?'звук + вибрация':'тихо'}`;box.querySelectorAll('.rem-opt,.sound-opt').forEach(b=>b.disabled=!settings.enabled)};
  box.querySelector('#remSwitch').onclick=()=>{settings.enabled=!settings.enabled;save();box.querySelector('#remSwitch').classList.toggle('on',settings.enabled);refresh();send()};
  box.querySelectorAll('.rem-opt').forEach(b=>b.onclick=()=>{settings.minutes=Number(b.dataset.min);save();box.querySelectorAll('.rem-opt').forEach(x=>x.classList.toggle('on',Number(x.dataset.min)===settings.minutes));refresh();send()});
  box.querySelectorAll('.sound-opt').forEach(b=>b.onclick=()=>{settings.sound=b.dataset.sound;save();box.querySelectorAll('.sound-opt').forEach(x=>x.classList.toggle('on',x.dataset.sound===settings.sound));refresh();send()});
  box.querySelector('#updateSwitch').onclick=()=>{settings.updates=!settings.updates;save();box.querySelector('#updateSwitch').classList.toggle('on',settings.updates)};
  refresh();
}
function renderProfile(){
  const pg=document.getElementById('settingsPage');if(!pg||document.getElementById('schedule-profile'))return;
  const box=document.createElement('div');box.id='schedule-profile';
  box.innerHTML=`<h3>👤 Мой профиль</h3><p>Данные сохраняются на устройстве и используются для персонализации.</p><div class="profile-grid"><input class="profile-input" id="profileNick" placeholder="Ник" value="${esc(profile.nickname)}"><input class="profile-input" id="profileName" placeholder="ФИО" value="${esc(profile.name)}"><input class="profile-input" id="profileGroup" placeholder="Группа" value="${esc(profile.group)}"></div><button class="profile-save" id="profileSave">Сохранить профиль</button><div class="profile-preview" id="profilePreview"></div>`;
  const appearance=document.getElementById('customize');
  if(appearance&&appearance.parentElement===pg)pg.insertBefore(box,appearance);else pg.insertBefore(box,pg.firstChild);
  const updatePreview=()=>{box.querySelector('#profilePreview').textContent=`@${profile.nickname||'—'} • ${profile.name||'Имя не указано'} • ${profile.group||'группа не указана'}`};
  box.querySelector('#profileSave').onclick=()=>{profile.nickname=box.querySelector('#profileNick').value.trim();profile.name=box.querySelector('#profileName').value.trim();profile.group=box.querySelector('#profileGroup').value.trim();saveProfile();updatePreview();send()};updatePreview();
}
function noteKey(lesson){const day=document.querySelector('.day-btn.active')?.textContent?.replace(/\s+/g,' ').trim()||'day';return `${state?.selectedGroup||profile.group}|${day}|${lesson.time||''}|${lesson.name||''}`}
function getLessonText(card){return {name:card.querySelector('.lesson-name')?.textContent?.trim()||'',time:card.querySelector('.lesson-time')?.textContent?.trim()||'',room:card.querySelector('.lesson-room')?.textContent?.trim()||''}}
function openNote(key,title){
  let modal=document.getElementById('schedule-note-modal');if(!modal){modal=document.createElement('div');modal.id='schedule-note-modal';modal.className='modal';modal.innerHTML=`<div class="note-box"><div class="modal-title"><strong id="noteTitle"></strong><button class="close-btn" id="noteClose">×</button></div><textarea id="noteText" placeholder="Напиши заметку к этой паре..."></textarea><div class="note-actions"><button class="note-action" id="noteDelete">Удалить</button><button class="note-action primary" id="noteSave">Сохранить</button></div></div>`;document.body.appendChild(modal);modal.onclick=e=>{if(e.target===modal)modal.classList.remove('open')};modal.querySelector('#noteClose').onclick=()=>modal.classList.remove('open');modal.querySelector('#noteSave').onclick=()=>{const v=modal.querySelector('#noteText').value.trim();if(v)notes[key]=v;else delete notes[key];saveNotes();modal.classList.remove('open');decorateLessons()};modal.querySelector('#noteDelete').onclick=()=>{delete notes[key];saveNotes();modal.classList.remove('open');decorateLessons()}}
  modal.querySelector('#noteTitle').textContent=`Заметка • ${title}`;modal.querySelector('#noteText').value=notes[key]||'';modal.classList.add('open');
}
function decorateLessons(){
  document.querySelectorAll('.lesson').forEach(card=>{
    if(card.dataset.decorated==='1'){
      const d=getLessonText(card);const k=noteKey(d);const nb=card.querySelector('.lesson-note-btn');if(nb)nb.classList.toggle('has-note',!!notes[k]);const fs=card.querySelector('.lesson-favorite');if(fs)fs.classList.toggle('on',favorites.includes(d.name));return;
    }
    card.dataset.decorated='1';const d=getLessonText(card);if(!d.name)return;const key=noteKey(d);
    const fav=document.createElement('button');fav.className='lesson-favorite';fav.type='button';fav.textContent='☆';fav.title='Избранный предмет';fav.onclick=e=>{e.stopPropagation();if(favorites.includes(d.name))favorites=favorites.filter(x=>x!==d.name);else favorites.push(d.name);saveFav();decorateLessons();renderFavorites()};card.appendChild(fav);
    const nb=document.createElement('button');nb.className='lesson-note-btn';nb.type='button';nb.textContent=notes[key]?'📝 Заметка есть':'📝 Заметка';nb.classList.toggle('has-note',!!notes[key]);nb.onclick=e=>{e.stopPropagation();openNote(key,d.name)};const room=card.querySelector('.lesson-room');if(room)room.insertAdjacentElement('afterend',nb);else card.appendChild(nb);
  });
}
function renderFavorites(){
  const pg=document.getElementById('settingsPage');if(!pg)return;let box=document.getElementById('schedule-favorites');if(!box){box=document.createElement('div');box.id='schedule-favorites';const appearance=document.getElementById('customize');if(appearance&&appearance.parentElement===pg)pg.insertBefore(box,appearance);else pg.appendChild(box)}
  box.innerHTML=`<h3>⭐ Избранные предметы</h3><p>Звёздочкой в правом верхнем углу пары можно отметить любимые предметы.</p><div class="favorite-summary">${favorites.length?favorites.map(x=>`<span class="favorite-chip">★ ${esc(x)}</span>`).join(''):'<span style="color:#817987;font-size:11px">Пока ничего не добавлено</span>'}</div>`;
}
function boot(){renderReminders();renderProfile();renderFavorites();setTimeout(send,700);setTimeout(decorateLessons,500);let lastGroup='';setInterval(()=>{if(typeof state!=='undefined'&&state.selectedGroup!==lastGroup){lastGroup=state.selectedGroup;send();decorateLessons();}},1000);new MutationObserver(()=>{renderReminders();renderProfile();renderFavorites();decorateLessons()}).observe(document.body,{childList:true,subtree:true})}

const oldNative=window.onNativeFiles;
window.onNativeFiles=function(json,status){if(typeof oldNative==='function')oldNative(json,status);setTimeout(send,900);if(status&&String(status).indexOf('Расписание обновлено')===0)setTimeout(()=>notifyUpdate(status),1100);setTimeout(decorateLessons,1000)};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,200));else setTimeout(boot,200);
})();
