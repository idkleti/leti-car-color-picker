/*
  Every car the picker knows about.

  Adding one means adding an entry here and dropping its .glb into models/:
  nothing else in the app is car-specific. The fields after `file` are tuning
  knobs, all optional except `length`.
*/

export const CARS = [
  {
    id: 'abarth595',
    name: 'Abarth 595',
    year: 2014,
    style: 'hatchback',
    file: 'models/2014_abarth_500_1.4_16v.glb',
    length: 3.66,        // real length in metres, so cars keep their relative size
    accent: '#d6243a',   // starting body colour, and the tint of its garage card
    // photo: 'images/cars/abarth595.jpg',   // optional, replaces the silhouette
    belt: 0.62,          // belt line (where the windows start) as a fraction of height
    beltTilt: -0.05,     // belt slope, dY/dX; negative dips toward the rear
    lid: 0.62,           // floor above which flat panels (hood, boot) count as roof
    credit: {
      title: '2014 Abarth 500 1.4 16v',
      author: 'Ddiaz Design (@ddiaz-design)',
      license: 'CC BY-NC-SA 4.0',
      url: 'https://sketchfab.com/3d-models/2014-abarth-500-14-16v-a7fe3d6fa0a44c83a62f21853256d166',
    },
  },
  {
    id: 'e36',
    name: 'BMW M3 Coupé E36',
    year: 1993,
    style: 'coupe',
    file: 'models/1993_bmw_m3_coupe_e36.glb',
    length: 4.43,
    accent: '#1f6fb2',
    // The author spelled the paint material "carpainbt", which the default
    // pattern doesn't catch. It carries no texture, so the picked colour comes
    // through at full strength with nothing to neutralise.
    bodyPattern: /^carpainbt$/,
    // Measured, not guessed: the window glass on this model starts at 0.662 of
    // the car's height, so the belt runs just under it.
    belt: 0.65,
    beltTilt: -0.03,
    lid: 0.65,
    credit: {
      title: '1993 BMW M3 Coupe (E36)',
      author: 'Ddiaz Design (@ddiaz-design)',
      license: 'CC BY-NC-SA 4.0',
      url: 'https://sketchfab.com/3d-models/1993-bmw-m3-coupe-e36-76401039fa80419ab036bea09acb898d',
    },
  },
  {
    id: 'impreza22b',
    name: 'Subaru Impreza 22B STI',
    year: 1998,
    style: 'sedan',
    file: 'models/subaru_impreza_22b_sti_1998.glb',
    length: 4.34,
    accent: '#2f6fd0',
    // Its materials are all called things like "material" and "mat_01": this is
    // the one covering the shell, from the sills up to the roof and the wing.
    bodyPattern: /^material$/,
    // That shell shares one atlas with the lights, badges and grille, and the
    // car's WR blue is painted into it. Since the picked colour multiplies the
    // texture, blue x red came out navy. Neutralising just the blue pixels
    // leaves the details alone and lets the picked colour read true.
    // The 22B's blue Alcantara is a solid blue texture of its own, on the seats
    // and door cards. It sits in the same hue band as the paint, so the rule
    // below neutralises it too and the cabin becomes paintable: the second
    // colour slot spends itself there instead of on a roof cut out of the shell.
    secondSlot: {
      name: 'interior',
      // The front seats and door cards are a material of their own.
      pattern: /^Mat00$/,
      // The rear seat back is not: it sits in "material_9", a catch-all that
      // also holds the rear wing. The cabin blue it is painted is what
      // separates it, 16 triangles out of that material's 774.
      claim: { from: /^material_9$/, band: { hue: 212, spread: 35, minSaturation: 0.20 } },
      accent: '#2f6fd0',
    },
    paintTweaks: [
      { hue: 208, spread: 22, minSaturation: 0.45, to: 'neutral' },
      // The atlas draws the Subaru oval in magenta, which only ever looked blue
      // because the blue paint multiplied it. With the paint neutral it shows
      // up pink, so put the badge back to its own blue. The band is kept tight:
      // the tail lights sit at hue 333-352 and much darker, and must not move.
      { hue: 318, spread: 14, minSaturation: 0.45, minValue: 0.75, to: '#1b3f8f' },
    ],
    belt: 0.62,
    beltTilt: -0.03,
    lid: 0.62,
    credit: {
      title: 'Subaru Impreza 22B STI 1998 | www.vecarz.com',
      author: 'vecarz (@heynic)',
      license: 'CC BY-NC-SA 4.0',
      url: 'https://sketchfab.com/3d-models/subaru-impreza-22b-sti-1998-wwwvecarzcom-20512df95cdf4114aa50b6005b5290a3',
    },
  },
  {
    id: 'yaris2001',
    name: 'Toyota Yaris',
    year: 2001,
    style: 'hatchback',
    file: 'models/2001_toyota_yaris.glb',
    length: 3.62,
    accent: '#8a9096',
    // The aerial pushes the bounding box ~12% above the roof, and the belt is a
    // fraction of that box, so it sits lower than on a car measured roof-high.
    belt: 0.60,
    beltTilt: -0.04,
    lid: 0.60,
    // Its aftermarket wheels came out of Sketchfab with no textures at all, so
    // every part of them rendered as the same flat light grey. Stand in with
    // believable rubber, alloy and chrome.
    materialFixes: [
      { match: /^fh_tire/,      color: '#18181a', roughness: 0.92, metalness: 0.0 },
      { match: /^fh_rim/,       color: '#c9ced3', roughness: 0.35, metalness: 0.85 },
      { match: /^fh_chrome/,    color: '#e9ebed', roughness: 0.12, metalness: 1.0 },
      { match: /^fh_lettering/, color: '#d8d6d0', roughness: 0.80, metalness: 0.0 },
      // The headlight covers declare no metallicFactor, and glTF reads that as
      // fully metallic; at roughness 0 over a near-black 16x16 texture they
      // became mirrors and hid the actual headlights behind them. Their texture
      // carries an alpha of 121, so smoked glass was the intent all along.
      { match: /^FOCOSDELYAR/, metalness: 0.0, roughness: 0.05, transparent: true, opacity: 0.4 },
      // Same defaulted metalness on the interior glass.
      { match: /^int_g/,       metalness: 0.0, roughness: 0.05 },
    ],
    credit: {
      title: '2001 Toyota Yaris',
      author: 'Dave Love (@Tyler_Dave)',
      license: 'CC BY 4.0',
      url: 'https://sketchfab.com/3d-models/2001-toyota-yaris-443fd49eb0844557a06854cae0b61267',
    },
  },
  {
    id: 'ramtrx',
    name: 'RAM 1500 TRX',
    year: 2021,
    style: 'pickup',
    file: 'models/2021_ram_1500_trx.glb',
    length: 5.92,
    accent: '#d1782a',
    // A pickup has no single belt line: the cab windows start much higher than
    // the bed walls, so the split is kept low and the lid floor high to stop the
    // bed sides being painted as roof.
    belt: 0.70,
    beltTilt: -0.02,
    lid: 0.80,
    credit: {
      title: '2021 RAM 1500 TRX',
      author: 'Outlaw Games (@Outlaw_Games)',
      license: 'CC BY-NC 4.0',
      url: 'https://sketchfab.com/3d-models/2021-ram-1500-trx-4fad9badee2449b9a5addadc11c3f4e1',
    },
  },
];

export const DEFAULT_CAR_ID = CARS[0].id;

export function getCar(id) {
  return CARS.find((c) => c.id === id) || CARS[0];
}

// The car to show: whatever the URL asks for, else the last one used, else the
// first in the list.
export function currentCarId() {
  const fromUrl = new URLSearchParams(location.search).get('car');
  if (fromUrl && CARS.some((c) => c.id === fromUrl)) return fromUrl;
  try {
    const stored = localStorage.getItem('lcp_car');
    if (stored && CARS.some((c) => c.id === stored)) return stored;
  } catch {}
  return DEFAULT_CAR_ID;
}

export function rememberCar(id) {
  try { localStorage.setItem('lcp_car', id); } catch {}
}
