const translations = {
  it: {
    title: "Leti's Car Color Picker",
    subtitle: 'Scegli l’auto e il suo colore',
    start: 'Inizia',
    chooseCar: 'Scegli l’auto',
    chooseCarSub: 'Tocca un’auto per configurarla',
    car_hatchback: 'Berlina 2 volumi',
    car_sedan: 'Berlina 3 volumi',
    car_coupe: 'Coupé',
    car_pickup: 'Pick-up',
    modelMissing: 'Modello mancante',
    modelMissingHint: 'Scarica il modello e salvalo come',
    changeCar: 'Cambia auto',
    loadError: 'Impossibile caricare il modello',
    loadErrorHint: 'Controlla che il file sia in models/',
    singleColor: 'Colore unico',
    twoColor: 'Due colori',
    body: 'Carrozzeria',
    roof: 'Tetto',
    interior: 'Interni',
    screenshot: 'Scatta foto',
    back: 'Indietro',
    loading: 'Caricamento modello',
    bgStudio: 'Studio',
    bg1: 'Sfondo 1',
    bg2: 'Sfondo 2',
    bg3: 'Sfondo 3',
    bgCustom: 'Aggiungi sfondo',
    bgCustomFrame: 'Regola inquadratura',
    bgDrop: 'Trascina qui una foto',
    cropTitle: 'Scegli l’inquadratura',
    cropHint: 'Trascina il riquadro, pizzica o usa lo zoom',
    cropChange: 'Cambia foto',
    cropZoom: 'Zoom',
    cropCancel: 'Annulla',
    cropApply: 'Applica',
  },
  en: {
    title: "Leti's Car Color Picker",
    subtitle: 'Pick your car and its color',
    start: 'Start',
    chooseCar: 'Choose your car',
    chooseCarSub: 'Tap a car to configure it',
    car_hatchback: 'Hatchback',
    car_sedan: 'Sedan',
    car_coupe: 'Coupe',
    car_pickup: 'Pickup',
    modelMissing: 'Model missing',
    modelMissingHint: 'Download the model and save it as',
    changeCar: 'Change car',
    loadError: 'Could not load the model',
    loadErrorHint: 'Check that the file is in models/',
    singleColor: 'Single color',
    twoColor: 'Two colors',
    body: 'Body',
    roof: 'Roof',
    interior: 'Interior',
    screenshot: 'Take photo',
    back: 'Back',
    loading: 'Loading model',
    bgStudio: 'Studio',
    bg1: 'Background 1',
    bg2: 'Background 2',
    bg3: 'Background 3',
    bgCustom: 'Add background',
    bgCustomFrame: 'Adjust framing',
    bgDrop: 'Drop a photo here',
    cropTitle: 'Choose the framing',
    cropHint: 'Drag the frame, pinch or use the zoom',
    cropChange: 'Change photo',
    cropZoom: 'Zoom',
    cropCancel: 'Cancel',
    cropApply: 'Apply',
  },
};

function getLang() {
  const stored = localStorage.getItem('fp_lang');
  if (stored && translations[stored]) return stored;
  const nav = (navigator.language || 'it').slice(0, 2);
  return translations[nav] ? nav : 'it';
}

function setLang(lang) {
  if (!translations[lang]) return;
  localStorage.setItem('fp_lang', lang);
  document.documentElement.lang = lang;
  applyTranslations();
  updateFlagState();
}

export function t(key) {
  return translations[getLang()][key] || key;
}

export function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    el.textContent = t(key);
  });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const key = el.getAttribute('data-i18n-title');
    el.title = t(key);
  });
}

function updateFlagState() {
  const current = getLang();
  document.querySelectorAll('.flag-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.lang === current);
  });
}

export function initLangSwitch() {
  document.querySelectorAll('.flag-btn').forEach((btn) => {
    btn.addEventListener('click', () => setLang(btn.dataset.lang));
  });
  applyTranslations();
  updateFlagState();
}
