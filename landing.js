import * as i18n from './i18n.js';

i18n.initLangSwitch();

document.getElementById('startBtn').addEventListener('click', () => {
  window.location.href = 'garage.html';
});
