(() => {
'use strict';

const STYLE_ID = 'schedule-smooth-days-style';
const SNAPSHOT_CLASS = 'schedule-day-old-snapshot';
let transitionBusy = false;

if (!document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .schedule-list {
      position:relative;
    }
    .schedule-list.cf-day {
      animation:none !important;
    }
    .schedule-day-old-snapshot {
      position:absolute !important;
      z-index:12 !important;
      left:0 !important;
      right:0 !important;
      top:0 !important;
      margin:0 !important;
      pointer-events:none !important;
      animation:scheduleOldDayFade 220ms ease-out forwards !important;
      transform-origin:center top;
    }
    @keyframes scheduleOldDayFade {
      from { opacity:1; transform:translate3d(0,0,0); }
      to { opacity:0; transform:translate3d(0,-5px,0); }
    }
    html[data-uianim=off] .schedule-day-old-snapshot {
      animation:none !important;
      opacity:0 !important;
    }
  `;
  document.head.appendChild(style);
}

function list() {
  return document.querySelector('#schedulePage .schedule-list');
}

function removeSnapshots() {
  document.querySelectorAll('.' + SNAPSHOT_CLASS).forEach(x => x.remove());
}

function begin() {
  const current = list();
  if (!current || transitionBusy) return;

  removeSnapshots();
  const snapshot = current.cloneNode(true);
  snapshot.classList.remove('cf-day');
  snapshot.classList.add(SNAPSHOT_CLASS);
  current.appendChild(snapshot);
  transitionBusy = true;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        snapshot.remove();
        transitionBusy = false;
      }, 250);
    });
  });
}

function init() {
  document.addEventListener('pointerdown', event => {
    if (event.target.closest?.('.day-btn')) begin();
  }, true);

  document.addEventListener('click', event => {
    if (!event.target.closest?.('.day-btn')) return;
    setTimeout(() => removeSnapshots(), 320);
  }, true);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
})();
