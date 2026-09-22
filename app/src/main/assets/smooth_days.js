(() => {
'use strict';

const STYLE_ID = 'schedule-smooth-days-style';
let switchingDay = false;

if (!document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    /* Плавный переход без snapshot/transform — не создаёт вспышек при прокрутке. */
    .schedule-list.cf-day {
      animation: scheduleDayFade 180ms ease-out !important;
      will-change: opacity !important;
    }

    @keyframes scheduleDayFade {
      from { opacity: 0.18; }
      to   { opacity: 1; }
    }

    .select-box {
      position: relative !important;
    }
    .select-box::after {
      top: 0 !important;
      bottom: 0 !important;
      right: 15px !important;
      height: 48px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      transform: none !important;
      line-height: 1 !important;
      margin: 0 !important;
      pointer-events: none !important;
    }

    #customize .hexrow {
      display: grid !important;
      grid-template-columns: minmax(0, 1fr) 90px !important;
      align-items: stretch !important;
      width: 100% !important;
      gap: 7px !important;
    }
    #customize .hexinput,
    #customize #resetc {
      width: 100% !important;
      min-width: 0 !important;
      height: 38px !important;
      box-sizing: border-box !important;
      margin: 0 !important;
    }

    @media(max-width:380px) {
      #customize .hexrow {
        grid-template-columns: minmax(0, 1fr) 86px !important;
      }
      #customize #resetc {
        padding-left: 6px !important;
        padding-right: 6px !important;
        font-size: 10px !important;
      }
    }
  `;
  document.head.appendChild(style);
}


if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
})();
