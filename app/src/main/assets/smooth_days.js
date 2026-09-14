(() => {
'use strict';

const STYLE_ID = 'schedule-smooth-days-style';

if (!document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    /* Стабильный переход между разными днями.
       Не создаём копию списка и не накладываем snapshot поверх viewport. */
    .schedule-list.cf-day {
      animation: scheduleDaySmooth 380ms cubic-bezier(.22,.75,.2,1) both !important;
      will-change: opacity, transform;
    }
    @keyframes scheduleDaySmooth {
      from { opacity:.45; transform:translate3d(0,7px,0) scale(.995); }
      55% { opacity:.92; transform:translate3d(0,1px,0) scale(.999); }
      to { opacity:1; transform:none; }
    }
    html[data-uianim=off] .schedule-list.cf-day,
    html[data-uianim=off] .schedule-list.cf-day * {
      animation:none !important;
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

function isActiveDay(button) {
  if (!button) return false;
  if (button.classList.contains('active')) return true;
  const listEl = button.closest('.day-list');
  const active = listEl?.querySelector('.day-btn.active');
  return !!active && button.textContent.trim() === active.textContent.trim();
}

function init() {
  document.addEventListener('pointerdown', event => {
    const button = event.target.closest?.('.day-btn');
    if (!button) return;
    if (isActiveDay(button)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
})();
