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

    /* Геометрия стандартных элементов UI */
    .select-box::after {
      top:50% !important;
      transform:translateY(-50%) !important;
      line-height:1 !important;
    }

    #customize .hexrow {
      grid-template-columns:minmax(0,1fr) 96px !important;
      width:100% !important;
      align-items:stretch !important;
    }

    #customize .hexinput,
    #customize #resetc {
      min-width:0 !important;
      width:100% !important;
      box-sizing:border-box !important;
    }

    #customize #resetc {
      height:38px !important;
      margin:0 !important;
      padding:0 10px !important;
      border-radius:11px !important;
      white-space:nowrap !important;
      overflow:hidden !important;
    }

    @media(max-width:380px) {
      #customize .hexrow {
        grid-template-columns:minmax(0,1fr) 92px !important;
      }
      #customize #resetc {
        padding:0 7px !important;
        font-size:10px !important;
      }
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
