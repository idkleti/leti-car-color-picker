import * as i18n from './i18n.js';
import { CARS, rememberCar } from './cars.js';

i18n.initLangSwitch();

/*
  Side-view silhouettes, one per body style. They stand in for photos: drop a
  picture at images/cars/<id>.jpg and it takes over the card automatically.
  Drawn in a 160x60 box with the ground at y=54.
*/
const SILHOUETTES = {
  hatchback: {
    body: 'M8,45 L9,35 Q10,31 18,29 L52,27 L66,13 Q68,11 74,11 L106,11 Q111,11 113,14 L124,27 L142,29 Q148,30 148,36 L148,45 Z',
    wheels: [42, 122],
  },
  sedan: {
    body: 'M6,45 L7,35 Q8,31 16,29 L50,27 L64,12 Q66,10 72,10 L100,10 Q105,10 107,13 L118,26 L148,28 Q154,29 154,36 L154,45 Z',
    wheels: [40, 126],
  },
  coupe: {
    body: 'M6,45 L7,36 Q8,31 17,29 L56,27 L72,13 Q75,11 81,11 L99,11 Q105,12 108,16 L128,27 L150,30 Q156,31 156,37 L156,45 Z',
    wheels: [40, 128],
  },
  pickup: {
    body: 'M6,45 L7,32 Q8,27 18,25 L48,23 L60,9 Q62,7 68,7 L98,7 Q103,7 103,11 L103,23 L150,23 L153,26 L153,45 Z',
    wheels: [40, 132],
  },
};

function silhouette(style, accent) {
  const s = SILHOUETTES[style] || SILHOUETTES.hatchback;
  const wheels = s.wheels
    .map((x) => `<circle cx="${x}" cy="45" r="9" fill="rgba(0,0,0,0.55)"/>
                 <circle cx="${x}" cy="45" r="4" fill="rgba(255,255,255,0.35)"/>`)
    .join('');
  return `<svg class="car-art" viewBox="0 0 160 60" aria-hidden="true">
            <path d="${s.body}" fill="${accent}"/>
            ${wheels}
          </svg>`;
}

const grid = document.getElementById('carGrid');

for (const car of CARS) {
  const card = document.createElement('div');
  card.className = 'car-card';
  card.style.setProperty('--accent', car.accent);
  card.innerHTML = `
    <button class="car-pick glass" type="button">
      <span class="car-thumb">
        ${silhouette(car.style, car.accent)}
        ${car.photo ? `<img class="car-photo" src="${car.photo}" alt="" />` : ''}
        <span class="car-flag" data-i18n="modelMissing" hidden>Modello mancante</span>
      </span>
      <span class="car-info">
        <span class="car-name">${car.name}</span>
        <span class="car-meta">${car.year} &middot; <span data-i18n="car_${car.style}">${car.style}</span></span>
      </span>
    </button>
    <p class="car-hint" hidden>
      <span data-i18n="modelMissingHint">Scarica il modello e salvalo come</span>
      <code>${car.file}</code>
      &mdash; <a href="${car.credit.url}" target="_blank" rel="noopener">Sketchfab</a>
    </p>`;

  const pick = card.querySelector('.car-pick');
  const photo = card.querySelector('.car-photo');
  const hint = card.querySelector('.car-hint');

  // A card shows its silhouette unless the car names a photo, and keeps the
  // silhouette if that photo turns out to be missing.
  if (photo) {
    card.classList.add('has-photo');
    photo.addEventListener('error', () => {
      photo.remove();
      card.classList.remove('has-photo');
    });
  }

  pick.addEventListener('click', () => {
    // Missing model: say what to do instead of walking into a load error.
    if (card.classList.contains('missing')) {
      hint.hidden = !hint.hidden;
      return;
    }
    rememberCar(car.id);
    window.location.href = `configurator.html?car=${encodeURIComponent(car.id)}`;
  });

  grid.appendChild(card);

  // Flag the cars whose .glb isn't in the repo yet. A failed request (file://,
  // offline) tells us nothing, so only a real 404 marks the card.
  fetch(car.file, { method: 'HEAD' })
    .then((res) => {
      if (res.status !== 404) return;
      card.classList.add('missing');
      card.querySelector('.car-flag').hidden = false;
    })
    .catch(() => {});
}

// The cards are built after the initial pass, so translate them now. Later
// language switches re-query the DOM and pick these up on their own.
i18n.applyTranslations?.();

document.getElementById('backBtn').addEventListener('click', () => {
  window.location.href = 'index.html';
});
