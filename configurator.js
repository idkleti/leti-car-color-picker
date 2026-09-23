import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
// Namespace import on purpose: a named import of something a stale cached
// i18n.js doesn't export yet fails module linking and blanks the whole page.
import * as i18n from './i18n.js';
import { getCar, currentCarId, rememberCar } from './cars.js';

i18n.initLangSwitch();

// The car this page is configuring. Everything model-specific comes from here,
// so the rest of the file stays the same whichever car is loaded.
const carSpec = getCar(currentCarId());
rememberCar(carSpec.id);

const tr = (key) => (i18n.t ? i18n.t(key) : key);


// Scene, renderer, camera

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true, // needed for toDataURL screenshots
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe8ecf1);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(5.5, 2.6, 6.0);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.8, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 3.2;
controls.maxDistance = 12;
controls.minPolarAngle = 0.15;
controls.maxPolarAngle = Math.PI / 2 - 0.05;
controls.enablePan = false;
controls.update();

/*
  Framing. The viewing angle is fixed, the distance comes from the size of the
  car that actually loaded, so a 3.6 m hatchback and a 5.9 m pickup are both
  shown whole and at the same apparent size.
*/
const VIEW_DIR = new THREE.Vector3(5.5, 2.6, 6.0).normalize();
const GROUND_FIT_DIST = 8.34;   // camera distance the ground disc was sized for
let fitRadius = 0;
const fitTarget = new THREE.Vector3(0, 0.8, 0);
let userMovedCamera = false;

function applyFraming() {
  if (!fitRadius) return;
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  // The tighter of the two fields decides the distance, so nothing is cut off
  // on a narrow window.
  const dist = (fitRadius * 1.25) / Math.sin(Math.min(vFov, hFov) / 2);
  controls.target.copy(fitTarget);
  camera.position.copy(fitTarget).addScaledVector(VIEW_DIR, dist);
  controls.minDistance = dist * 0.45;
  controls.maxDistance = dist * 2.4;
  controls.update();

  // The asphalt disc is modelled at radius 8, which is what the first car was
  // framed against. Holding that ratio keeps the ground the same apparent size
  // instead of shrinking to an island when the camera pulls back for a pickup
  // or a portrait phone. The texture repeat follows so the grain stays put.
  const groundScale = dist / GROUND_FIT_DIST;
  floor.scale.setScalar(groundScale);
  shadowCatcher.scale.setScalar(groundScale);
  if (floor.material.map) floor.material.map.repeat.set(18 * groundScale, 18 * groundScale);
}

function frameCar(bbox) {
  const size = bbox.getSize(new THREE.Vector3());
  bbox.getCenter(fitTarget);
  fitRadius = size.length() / 2;
  applyFraming();

  // Keep the shadow map wrapped around the car instead of a fixed box: a tight
  // frustum is what keeps the contact shadow sharp on a small car.
  const span = Math.max(size.x, size.z) * 0.9;
  const shadowCam = keyLight.shadow.camera;
  shadowCam.left = -span;
  shadowCam.right = span;
  shadowCam.top = span;
  shadowCam.bottom = -span;
  shadowCam.far = span * 8;
  shadowCam.updateProjectionMatrix();
}


// Lights and floor

scene.add(new THREE.HemisphereLight(0xffffff, 0xb8bec6, 0.35));

const keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
keyLight.position.set(4, 8, 5);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.near = 1;
keyLight.shadow.camera.far = 25;
keyLight.shadow.camera.left = -6;
keyLight.shadow.camera.right = 6;
keyLight.shadow.camera.top = 6;
keyLight.shadow.camera.bottom = -6;
keyLight.shadow.bias = -0.0005;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xc8d4e5, 0.45);
fillLight.position.set(-5, 3, -4);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xfff0d6, 0.35);
rimLight.position.set(-3, 4, 6);
scene.add(rimLight);

const groundDisc = new THREE.CircleGeometry(8, 64);
groundDisc.rotateX(-Math.PI / 2);

const shadowCatcher = new THREE.Mesh(groundDisc, new THREE.ShadowMaterial({ opacity: 0.45 }));
shadowCatcher.receiveShadow = true;
scene.add(shadowCatcher);

// Procedural asphalt: dark base, fine noise grain, scattered pebbles and oil patches.
function createAsphaltTexture() {
  const size = 512;
  const cvs = document.createElement('canvas');
  cvs.width = cvs.height = size;
  const ctx = cvs.getContext('2d');

  // base
  ctx.fillStyle = '#3d3d3f';
  ctx.fillRect(0, 0, size, size);

  // fine grain
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 50;
    img.data[i    ] = Math.max(0, Math.min(255, img.data[i    ] + n));
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);

  // lighter pebbles
  for (let i = 0; i < 350; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 0.7 + Math.random() * 2.0;
    const v = 90 + Math.random() * 60;
    ctx.fillStyle = `rgb(${v},${v},${v - 5})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // darker oil patches
  for (let i = 0; i < 30; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 8 + Math.random() * 18;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(20,20,22,0.35)');
    grad.addColorStop(1, 'rgba(20,20,22,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(cvs);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(18, 18);
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const floor = new THREE.Mesh(
  groundDisc.clone(),
  new THREE.MeshStandardMaterial({
    map: createAsphaltTexture(),
    roughness: 0.95,
    metalness: 0.0,
  })
);
floor.position.y = -0.002;
floor.receiveShadow = true;
scene.add(floor);


// Car model

const car = new THREE.Group();
scene.add(car);

const bodyMaterials = new Set();
const roofMaterials = new Set();
let modelLoaded = false;

const loadingOverlay = document.getElementById('loadingOverlay');
const loadingProgress = document.getElementById('loadingProgress');
const loadingCar = document.getElementById('loadingCar');
if (loadingCar) loadingCar.textContent = carSpec.name;

new GLTFLoader().load(
  carSpec.file,
  onModelLoaded,
  (xhr) => {
    if (xhr.lengthComputable && loadingProgress) {
      // Cap at 100: with gzip/brotli on the server, xhr.loaded counts the
      // decompressed bytes while xhr.total is the compressed size, so the
      // raw ratio can go above 1.
      const pct = Math.min(100, Math.round((xhr.loaded / xhr.total) * 100));
      loadingProgress.textContent = pct + '%';
    }
  },
  (err) => {
    console.error('GLB load error:', err);
    if (!loadingOverlay) return;
    // Four of the five cars ship without their .glb, so name the file that is
    // missing rather than sending people to the console.
    loadingOverlay.innerHTML = `
      <div class="load-error text-center px-4">
        <p class="load-error-title mb-1">${tr('loadError')}</p>
        <p class="load-error-hint mb-2">${tr('loadErrorHint')}</p>
        <code class="load-error-file">${carSpec.file}</code>
        <div class="mt-3">
          <a class="btn btn-dark btn-sm rounded-pill px-3" href="garage.html">${tr('changeCar')}</a>
        </div>
      </div>`;
  }
);

/*
  Split a mesh in two along a tilted belt plane (Y = beltCenter + beltSlope * X).
  Triangles crossing the plane are clipped exactly on it so the seam stays clean.
  Horizontal panels above lidFloorY (hood, trunk) go to the upper half.
  Position, normal and UV are interpolated for new vertices.
*/
function splitMeshBicolor(mesh, beltCenter, beltSlope, lidFloorY, normalUpThreshold = 0.5) {
  const geom = mesh.geometry;
  const posAttr = geom.attributes.position;
  if (!posAttr) return null;
  const normalAttr = geom.attributes.normal;
  const uvAttr = geom.attributes.uv;
  const hasIndex = !!geom.index;

  mesh.updateWorldMatrix(true, false);
  const M = mesh.matrixWorld;

  // 1. Copy attributes into growable arrays.
  const newPositions = [];
  const newNormals   = normalAttr ? [] : null;
  const newUVs       = uvAttr     ? [] : null;

  for (let i = 0; i < posAttr.count; i++) {
    newPositions.push(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
    if (newNormals) newNormals.push(normalAttr.getX(i), normalAttr.getY(i), normalAttr.getZ(i));
    if (newUVs)     newUVs.push(uvAttr.getX(i), uvAttr.getY(i));
  }

  // Precompute world X and Y per vertex for fast plane tests.
  const worldX = new Float32Array(posAttr.count);
  const worldY = new Float32Array(posAttr.count);
  const tmp = new THREE.Vector3();
  for (let i = 0; i < posAttr.count; i++) {
    tmp.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i)).applyMatrix4(M);
    worldX[i] = tmp.x;
    worldY[i] = tmp.y;
  }

  // Signed distance from the belt plane (positive means above).
  function distFromBelt(idx) {
    return worldY[idx] - (beltCenter + beltSlope * worldX[idx]);
  }

  // Linear interpolation along edge a..b at parameter t in [0,1].
  // Works in local space since the mesh transform is affine.
  function lerpVertex(ai, bi, t) {
    const u = 1 - t;
    const newIdx = newPositions.length / 3;
    newPositions.push(
      u * newPositions[ai*3]   + t * newPositions[bi*3],
      u * newPositions[ai*3+1] + t * newPositions[bi*3+1],
      u * newPositions[ai*3+2] + t * newPositions[bi*3+2],
    );
    if (newNormals) {
      let nx = u * newNormals[ai*3]   + t * newNormals[bi*3];
      let ny = u * newNormals[ai*3+1] + t * newNormals[bi*3+1];
      let nz = u * newNormals[ai*3+2] + t * newNormals[bi*3+2];
      const len = Math.hypot(nx, ny, nz) || 1;
      newNormals.push(nx/len, ny/len, nz/len);
    }
    if (newUVs) {
      newUVs.push(
        u * newUVs[ai*2]   + t * newUVs[bi*2],
        u * newUVs[ai*2+1] + t * newUVs[bi*2+1],
      );
    }
    return newIdx;
  }

  // 2. Walk every triangle, classify or clip.
  const lowerIdx = [];
  const upperIdx = [];

  const v0 = new THREE.Vector3();
  const v1 = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  const edge1 = new THREE.Vector3();
  const edge2 = new THREE.Vector3();
  const normal = new THREE.Vector3();

  const triCount = hasIndex ? geom.index.count / 3 : posAttr.count / 3;

  for (let t = 0; t < triCount; t++) {
    let i0, i1, i2;
    if (hasIndex) {
      i0 = geom.index.getX(t * 3);
      i1 = geom.index.getX(t * 3 + 1);
      i2 = geom.index.getX(t * 3 + 2);
    } else {
      i0 = t * 3; i1 = t * 3 + 1; i2 = t * 3 + 2;
    }

    // World-space face normal for the lid test.
    v0.fromBufferAttribute(posAttr, i0).applyMatrix4(M);
    v1.fromBufferAttribute(posAttr, i1).applyMatrix4(M);
    v2.fromBufferAttribute(posAttr, i2).applyMatrix4(M);
    edge1.subVectors(v1, v0);
    edge2.subVectors(v2, v0);
    normal.crossVectors(edge1, edge2).normalize();

    const centroidY = (worldY[i0] + worldY[i1] + worldY[i2]) / 3;

    // Lid rule: a flat panel above the lid floor goes straight to the upper half.
    if (centroidY > lidFloorY && normal.y > normalUpThreshold) {
      upperIdx.push(i0, i1, i2);
      continue;
    }

    // Belt rule: classify by signed distance, clip when the triangle straddles.
    const d0 = distFromBelt(i0);
    const d1 = distFromBelt(i1);
    const d2 = distFromBelt(i2);
    const a0 = d0 > 0, a1 = d1 > 0, a2 = d2 > 0;
    const above = (a0?1:0) + (a1?1:0) + (a2?1:0);

    if (above === 3) {
      upperIdx.push(i0, i1, i2);
    } else if (above === 0) {
      lowerIdx.push(i0, i1, i2);
    } else {
      // Triangle crosses the belt plane. Clip into 3 sub-triangles.
      let alone, other1, other2, dAlone, dOther1, dOther2, aloneAbove;
      if (above === 1) {
        if (a0)      { alone = i0; other1 = i1; other2 = i2; dAlone = d0; dOther1 = d1; dOther2 = d2; }
        else if (a1) { alone = i1; other1 = i2; other2 = i0; dAlone = d1; dOther1 = d2; dOther2 = d0; }
        else         { alone = i2; other1 = i0; other2 = i1; dAlone = d2; dOther1 = d0; dOther2 = d1; }
        aloneAbove = true;
      } else { // above === 2
        if (!a0)      { alone = i0; other1 = i1; other2 = i2; dAlone = d0; dOther1 = d1; dOther2 = d2; }
        else if (!a1) { alone = i1; other1 = i2; other2 = i0; dAlone = d1; dOther1 = d2; dOther2 = d0; }
        else          { alone = i2; other1 = i0; other2 = i1; dAlone = d2; dOther1 = d0; dOther2 = d1; }
        aloneAbove = false;
      }

      // t where the distance crosses 0 along edge alone..other:
      //   d(t) = dAlone + t * (dOther - dAlone)
      //   t = dAlone / (dAlone - dOther)
      const t1 = dAlone / (dAlone - dOther1);
      const t2 = dAlone / (dAlone - dOther2);
      const ni1 = lerpVertex(alone, other1, t1);
      const ni2 = lerpVertex(alone, other2, t2);

      if (aloneAbove) {
        upperIdx.push(alone, ni1, ni2);
        lowerIdx.push(other1, other2, ni1);
        lowerIdx.push(ni1, other2, ni2);
      } else {
        lowerIdx.push(alone, ni1, ni2);
        upperIdx.push(other1, other2, ni1);
        upperIdx.push(ni1, other2, ni2);
      }
    }
  }

  if (lowerIdx.length === 0 || upperIdx.length === 0) return null;

  // 3. Rebuild geometry with the new attributes and a grouped index.
  geom.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));
  if (newNormals) geom.setAttribute('normal', new THREE.Float32BufferAttribute(newNormals, 3));
  if (newUVs)     geom.setAttribute('uv',     new THREE.Float32BufferAttribute(newUVs, 2));

  const newIdxArr = new Uint32Array(lowerIdx.length + upperIdx.length);
  newIdxArr.set(lowerIdx, 0);
  newIdxArr.set(upperIdx, lowerIdx.length);
  geom.setIndex(new THREE.BufferAttribute(newIdxArr, 1));

  geom.clearGroups();
  geom.addGroup(0, lowerIdx.length, 0);
  geom.addGroup(lowerIdx.length, upperIdx.length, 1);

  const original = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  const lowerMat = original.clone();
  const upperMat = original.clone();
  mesh.material = [lowerMat, upperMat];

  return {
    lowerMat, upperMat,
    lowerCount: lowerIdx.length / 3,
    upperCount: upperIdx.length / 3,
  };
}

// Is this pixel inside a hue band? Shared by the texture retint and by the
// triangle claim below, so both read a colour the same way.
function inHueBand(r, g, b, band) {
  const max = Math.max(r, g, b);
  if (!max) return false;
  const c = max - Math.min(r, g, b);
  if (c / max < (band.minSaturation ?? 0.45)) return false;
  if (max / 255 < (band.minValue ?? 0)) return false;
  let h = 0;
  if (c) {
    if (max === r) h = ((g - b) / c) % 6;
    else if (max === g) h = (b - r) / c + 2;
    else h = (r - g) / c + 4;
    h = (h * 60 + 360) % 360;
  }
  // circular distance, so a band straddling 0 degrees still works
  let delta = Math.abs(h - band.hue) % 360;
  if (delta > 180) delta = 360 - delta;
  return delta <= (band.spread ?? 20);
}

/*
  Model textures sometimes need a touch-up before the picker can use them.

  A car's showroom colour is often painted straight into the base colour
  texture, which then multiplies whatever colour is picked: a blue atlas turns a
  red pick into navy. And because that same atlas usually carries the lights and
  badges too, it can't simply be thrown away.

  Each rule claims the pixels inside a hue band and either strips their tint
  ("neutral", keeping the shading so the picked colour reads true) or repaints
  them in a fixed colour. Everything else is left exactly as it was.
*/
function retintedTexture(src, rules) {
  const img = src && src.image;
  if (!img || !img.width || !img.height) return null;

  const cvs = document.createElement('canvas');
  cvs.width = img.width;
  cvs.height = img.height;
  const ctx = cvs.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const pixels = ctx.getImageData(0, 0, cvs.width, cvs.height);
  const d = pixels.data;

  const bands = rules.map((rule) => ({
    test: rule,
    // Parsed by hand rather than through THREE.Color: these bytes go straight
    // into an sRGB texture, with none of the working-space conversion a
    // material colour needs.
    target: rule.to === 'neutral' ? null : [
      parseInt(rule.to.slice(1, 3), 16),
      parseInt(rule.to.slice(3, 5), 16),
      parseInt(rule.to.slice(5, 7), 16),
    ],
    hist: new Uint32Array(256),
    count: 0,
    peak: 255,
  }));

  // Which band claims a pixel, if any. First one wins.
  function bandOf(r, g, b) {
    for (let i = 0; i < bands.length; i++) {
      if (inHueBand(r, g, b, bands[i].test)) return i;
    }
    return -1;
  }

  // Pass 1: how bright each band sits, taken as its 90th percentile. Mapping
  // that to full strength keeps panel lines and creases proportionally darker.
  for (let i = 0; i < d.length; i += 4) {
    const k = bandOf(d[i], d[i + 1], d[i + 2]);
    if (k < 0) continue;
    bands[k].hist[Math.max(d[i], d[i + 1], d[i + 2])]++;
    bands[k].count++;
  }
  let matched = false;
  for (const band of bands) {
    if (!band.count) continue;
    matched = true;
    let seen = 0;
    for (let v = 0; v < 256; v++) {
      seen += band.hist[v];
      if (seen >= band.count * 0.9) { band.peak = Math.max(1, v); break; }
    }
  }
  if (!matched) return null;

  // Pass 2: rewrite them.
  for (let i = 0; i < d.length; i += 4) {
    const k = bandOf(d[i], d[i + 1], d[i + 2]);
    if (k < 0) continue;
    const band = bands[k];
    const level = Math.min(1, Math.max(d[i], d[i + 1], d[i + 2]) / band.peak);
    if (band.target) {
      d[i]     = Math.round(band.target[0] * level);
      d[i + 1] = Math.round(band.target[1] * level);
      d[i + 2] = Math.round(band.target[2] * level);
    } else {
      d[i] = d[i + 1] = d[i + 2] = Math.round(level * 255);
    }
  }
  ctx.putImageData(pixels, 0, 0);

  // The clone keeps the glTF's own wrapping, flipY and colour space; the canvas
  // goes in as a fresh Source so the original texture is left alone.
  const tex = src.clone();
  tex.source = new THREE.Source(cvs);
  tex.needsUpdate = true;
  return tex;
}

// Parts that are never body paint, however the model names them.
const NOT_PAINT = /glass|window|windscreen|windshield|tyre|tire|rubber|wheel|rim|tread|chrome|mirror|light|lamp|led|glow|interior|seat|dash|leather|carpet|grill|badge|logo|plate|brake|caliper|disc|exhaust|shadow|decal|dirt|sticker|screw|bolt/i;

/*
  Rank materials by how much surface they cover, biggest first. A car's paint is
  almost always the largest opaque patch once glass, rubber and trim are out of
  the way, which gives us a usable guess for models whose materials aren't named
  anything we recognise. Areas are in local units: only the ranking matters.
*/
function rankPaintCandidates(root) {
  const area = new Map();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3();

  root.traverse((obj) => {
    const pos = obj.isMesh && obj.geometry && obj.geometry.attributes.position;
    if (!pos) return;
    const index = obj.geometry.index;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    const groups = obj.geometry.groups && obj.geometry.groups.length
      ? obj.geometry.groups
      : [{ start: 0, count: index ? index.count : pos.count, materialIndex: 0 }];

    for (const g of groups) {
      const mat = mats[g.materialIndex] || mats[0];
      if (!mat || !mat.color) continue;
      if (mat.transparent && mat.opacity < 0.9) continue;
      if (NOT_PAINT.test(mat.name || '')) continue;

      let sum = 0;
      const end = g.start + g.count;
      for (let i = g.start; i < end; i += 3) {
        const i0 = index ? index.getX(i)     : i;
        const i1 = index ? index.getX(i + 1) : i + 1;
        const i2 = index ? index.getX(i + 2) : i + 2;
        a.fromBufferAttribute(pos, i0);
        b.fromBufferAttribute(pos, i1);
        c.fromBufferAttribute(pos, i2);
        sum += ab.subVectors(b, a).cross(ac.subVectors(c, a)).length() * 0.5;
      }
      area.set(mat, (area.get(mat) || 0) + sum);
    }
  });

  return [...area.entries()]
    .map(([material, value]) => ({ material, area: value }))
    .sort((x, y) => y.area - x.area);
}

/*
  Read a texture's pixels once so triangles can be tested against it. glTF puts
  UV (0,0) at the top left, same as a canvas, so v needs no flipping.
*/
function textureProbe(tex) {
  const img = tex && tex.image;
  if (!img || !img.width || !img.height) return null;
  const cvs = document.createElement('canvas');
  cvs.width = img.width;
  cvs.height = img.height;
  const ctx = cvs.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, cvs.width, cvs.height);
  return (u, v, band) => {
    // floor, not round: a texel covers [i/w, (i+1)/w), so rounding lands half a
    // texel over and picks the neighbour at any boundary.
    const x = Math.min(cvs.width - 1, Math.max(0, Math.floor((u - Math.floor(u)) * cvs.width)));
    const y = Math.min(cvs.height - 1, Math.max(0, Math.floor((v - Math.floor(v)) * cvs.height)));
    const o = (y * cvs.width + x) * 4;
    return inHueBand(data[o], data[o + 1], data[o + 2], band);
  };
}

/*
  Split a mesh by what its triangles sample from the base colour texture: the
  ones landing inside the hue band get a material of their own, so they can take
  a colour the rest of the mesh doesn't.

  The Impreza needs this. Its rear seats aren't a material of their own, they
  sit in a catch-all material that also carries trim all over the car; the blue
  they are painted is what tells them apart, where a bounding box could only cut
  blindly through the shell.
*/
function splitMeshByHue(mesh, band) {
  const geom = mesh.geometry;
  const uv = geom.attributes.uv;
  const probe = textureProbe(mesh.material.map);
  if (!uv || !probe) return null;

  const index = geom.index;
  const triCount = index ? index.count / 3 : geom.attributes.position.count / 3;
  const claimed = [];
  const rest = [];

  for (let t = 0; t < triCount; t++) {
    const i0 = index ? index.getX(t * 3)     : t * 3;
    const i1 = index ? index.getX(t * 3 + 1) : t * 3 + 1;
    const i2 = index ? index.getX(t * 3 + 2) : t * 3 + 2;
    const u = (uv.getX(i0) + uv.getX(i1) + uv.getX(i2)) / 3;
    const v = (uv.getY(i0) + uv.getY(i1) + uv.getY(i2)) / 3;
    (probe(u, v, band) ? claimed : rest).push(i0, i1, i2);
  }
  if (!claimed.length || !rest.length) return null;

  const merged = new Uint32Array(rest.length + claimed.length);
  merged.set(rest, 0);
  merged.set(claimed, rest.length);
  geom.setIndex(new THREE.BufferAttribute(merged, 1));
  geom.clearGroups();
  geom.addGroup(0, rest.length, 0);
  geom.addGroup(rest.length, claimed.length, 1);

  const claimedMat = mesh.material.clone();
  mesh.material = [mesh.material, claimedMat];
  return claimedMat;
}

function onModelLoaded(gltf) {
  const root = gltf.scene;

  // 1. Auto-orient so the longest axis becomes X (car length).
  let bbox = new THREE.Box3().setFromObject(root);
  let bsize = bbox.getSize(new THREE.Vector3());

  if (bsize.z > bsize.x && bsize.z > bsize.y) {
    root.rotation.y = Math.PI / 2;
  } else if (bsize.y > bsize.x && bsize.y > bsize.z) {
    root.rotation.x = -Math.PI / 2;
  }
  root.updateMatrixWorld(true);
  bbox = new THREE.Box3().setFromObject(root);
  bsize = bbox.getSize(new THREE.Vector3());

  // 2. Scale to the car's real length in metres, so the cars keep their size
  //    relative to each other.
  const scale = carSpec.length / bsize.x;
  root.scale.setScalar(scale);

  // 3. Re-measure and center: X and Z centered, Y resting on the ground.
  root.updateMatrixWorld(true);
  bbox = new THREE.Box3().setFromObject(root);
  const bcenter = bbox.getCenter(new THREE.Vector3());
  root.position.x = -bcenter.x;
  root.position.z = -bcenter.z;
  root.position.y = -bbox.min.y;

  // Re-measure where the car now actually is. The belt plane below and the
  // camera framing both work in world space, and until this point bbox still
  // described the model before it was moved onto the ground: fine for a model
  // already authored at the origin, off by its own offset for any other.
  root.updateMatrixWorld(true);
  bbox = new THREE.Box3().setFromObject(root);

  // 4. Enable shadows and collect every unique material.
  const allMaterials = new Set();
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = true;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) if (m) allMaterials.add(m);
  });

  // 4b. Exporters sometimes write a specular tint far outside its sane range.
  //     It tints the reflection and belongs in 0..1, so a red component of 24
  //     turns a chrome badge pink and one of 4 turns a windscreen maroon.
  //     Anything over 1 is export damage: put it back to a white specular.
  let wildSpecular = 0;
  for (const m of allMaterials) {
    const spec = m.specularColor;
    if (!spec || (spec.r <= 1 && spec.g <= 1 && spec.b <= 1)) continue;
    spec.setRGB(1, 1, 1);
    m.needsUpdate = true;
    wildSpecular++;
  }
  if (wildSpecular) {
    console.info(`[${carSpec.id}] reset ${wildSpecular} out-of-range specular tint(s)`);
  }

  // 4c. Per-car touch-ups for materials that lost their textures on export and
  //     would otherwise render as flat grey.
  for (const fix of carSpec.materialFixes || []) {
    for (const m of allMaterials) {
      if (!fix.match.test(m.name || '')) continue;
      if (fix.color !== undefined && m.color) m.color.set(fix.color);
      if (fix.roughness !== undefined) m.roughness = fix.roughness;
      if (fix.metalness !== undefined) m.metalness = fix.metalness;
      if (fix.transparent !== undefined) m.transparent = fix.transparent;
      if (fix.opacity !== undefined) m.opacity = fix.opacity;
      m.needsUpdate = true;
    }
  }

  // 5. Classify materials by name, letting a car override the patterns.
  const bodyPattern = carSpec.bodyPattern || /body|paint|carrosserie|carrozzeria|shell|exterior/;
  const roofPattern = carSpec.roofPattern || /roof|tetto|toit/;
  for (const m of allMaterials) {
    const n = (m.name || '').toLowerCase();
    if (bodyPattern.test(n)) bodyMaterials.add(m);
    if (roofPattern.test(n)) roofMaterials.add(m);
  }

  if (new URLSearchParams(location.search).has('debug')) {
    console.log(`[${carSpec.id}] materials:`, [...allMaterials].map((m) => m.name || '(unnamed)'));
  }

  // 5b. Nothing matched: guess the paint from the surface areas and say so, so
  //     the car can be given a bodyPattern in cars.js.
  if (bodyMaterials.size === 0) {
    const ranked = rankPaintCandidates(root);
    if (ranked.length) bodyMaterials.add(ranked[0].material);
    console.warn(
      `[${carSpec.id}] no material matched the body pattern, painting ` +
      `"${ranked[0] ? ranked[0].material.name || '(unnamed)' : 'nothing'}". ` +
      'Set bodyPattern in cars.js if that is the wrong one. Candidates by area:',
      ranked.map((r) => `${r.material.name || '(unnamed)'}: ${r.area.toFixed(2)}`)
    );
  }

  // 6. Bicolor split parameters, per car (see cars.js):
  //    BELT_RATIO: where the windows start (above goes to roof color).
  //    BELT_TILT:  belt plane slope (dY/dX); positive rises toward the rear.
  //    LID_RATIO:  floor for horizontal panels that go to roof color (hood, trunk).
  //    NORMAL_UP:  how flat a panel must be to count as a lid (0..1).
  const BELT_RATIO = carSpec.belt;
  const BELT_TILT  = carSpec.beltTilt;
  const LID_RATIO  = carSpec.lid;
  const NORMAL_UP  = 0.85;
  const carHeight  = bbox.max.y - bbox.min.y;
  const beltCenter = bbox.min.y + BELT_RATIO * carHeight;
  const lidFloor   = bbox.min.y + LID_RATIO  * carHeight;

  // Find the single-material body meshes worth splitting.
  const candidates = [];
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    if (Array.isArray(obj.material)) return;
    if (bodyMaterials.has(obj.material)) candidates.push(obj);
  });

  // Reset the sets and refill them with cloned half-materials.
  bodyMaterials.clear();
  roofMaterials.clear();

  if (carSpec.secondSlot) {
    // This car spends its second colour on its own materials rather than on a
    // roof cut out of the shell, so the body is left whole.
    for (const mesh of candidates) bodyMaterials.add(mesh.material);
    for (const m of allMaterials) {
      if (carSpec.secondSlot.pattern.test(m.name || '')) roofMaterials.add(m);
    }
  } else {
    for (const mesh of candidates) {
      const r = splitMeshBicolor(mesh, beltCenter, BELT_TILT, lidFloor, NORMAL_UP);
      if (r) {
        bodyMaterials.add(r.lowerMat);
        roofMaterials.add(r.upperMat);
      } else {
        bodyMaterials.add(mesh.material);
      }
    }
  }

  // 6b. Touch up the paint atlas, once per source texture: the split above
  //     cloned the material, so several of them share one.
  if (carSpec.paintTweaks) {
    const done = new Map();
    for (const m of [...bodyMaterials, ...roofMaterials]) {
      if (!m.map) continue;
      if (!done.has(m.map)) done.set(m.map, retintedTexture(m.map, carSpec.paintTweaks));
      const tex = done.get(m.map);
      if (tex) {
        m.map = tex;
        m.needsUpdate = true;
      }
    }
  }

  // 6c. Claim triangles out of a shared material for the second slot, and
  //     strip their baked colour here: this band is the claim's own, and the
  //     material they were cloned from has to stay exactly as it was.
  const claim = carSpec.secondSlot && carSpec.secondSlot.claim;
  if (claim) {
    const taken = [];
    root.traverse((obj) => {
      if (!obj.isMesh || Array.isArray(obj.material)) return;
      if (!claim.from.test(obj.material.name || '')) return;
      const mat = splitMeshByHue(obj, claim.band);
      if (mat) taken.push(mat);
    });
    for (const mat of taken) {
      const tex = mat.map && retintedTexture(mat.map, [{ ...claim.band, to: 'neutral' }]);
      if (tex) mat.map = tex;
      mat.needsUpdate = true;
      roofMaterials.add(mat);
    }
    if (!taken.length) console.warn(`[${carSpec.id}] the second slot claimed nothing`);
  }

  // 6d. Say what the second slot paints, when it isn't the roof.
  if (carSpec.secondSlot && roofMaterials.size > 0) {
    const label = roofTab && roofTab.querySelector('.slot-name');
    if (label) {
      label.dataset.i18n = carSpec.secondSlot.name;
      if (i18n.applyTranslations) i18n.applyTranslations();
    }
  }

  // 7. If no roof material was produced, hide the bicolor toggle.
  if (roofMaterials.size === 0) {
    const twoBtn = document.querySelector('.mode-btn[data-mode="two"]');
    if (twoBtn) twoBtn.style.display = 'none';
  }

  car.add(root);
  frameCar(bbox);
  modelLoaded = true;
  loadingOverlay?.remove();

  // Apply the current picker values to the freshly loaded materials.
  refreshAll();
}

function applyColorTo(materialSet, hex) {
  const c = new THREE.Color(hex);
  for (const m of materialSet) {
    if (!m) continue;
    if (m.color) m.color.copy(c);
    m.needsUpdate = true;
  }
}


// Color utilities (HSV, RGB, HEX)

function hsvToRgb(h, s, v) {
  h = ((h % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r, g, b;
  if      (h <  60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else              [r, g, b] = [c, 0, x];
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}
function hsvToHex(h, s, v) {
  const [r, g, b] = hsvToRgb(h, s, v);
  return '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('');
}
function hexToHsv(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  if (hex.length !== 6 || /[^0-9a-f]/i.test(hex)) return null;
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  const s = max === 0 ? 0 : d / max;
  return [h, s, max];
}


// UI: mode toggle, HSV picker, presets, hex input

const modeButtons = document.querySelectorAll('.mode-btn');
const roofTab = document.getElementById('roofTab');
const slotTabs = document.querySelectorAll('.slot-tab');
const bodySwatch = document.getElementById('bodySwatch');
const roofSwatch = document.getElementById('roofSwatch');
const svSquare = document.getElementById('svSquare');
const svCursor = document.getElementById('svCursor');
const hueStrip = document.getElementById('hueStrip');
const hueCursor = document.getElementById('hueCursor');
const hexInput = document.getElementById('hexInput');

let mode = 'single';     // 'single' | 'two'
let activeSlot = 'body'; // 'body'   | 'roof'

const slots = {
  body: { h: 354, s: 0.83, v: 0.84 },
  roof: { h:   0, s: 0.00, v: 0.96 },
};

// Each car opens on its own signature colour.
const accentHsv = hexToHsv(carSpec.accent);
if (accentHsv) [slots.body.h, slots.body.s, slots.body.v] = accentHsv;

// ...and so does its second slot, when that isn't a roof: the cabin should
// start out the colour it already is on the real car.
const secondHsv = carSpec.secondSlot && hexToHsv(carSpec.secondSlot.accent || '');
if (secondHsv) [slots.roof.h, slots.roof.s, slots.roof.v] = secondHsv;

function slotHex(slot) { return hsvToHex(slot.h, slot.s, slot.v); }

function syncMaterials() {
  const bodyHex = slotHex(slots.body);
  // Single-colour mode paints the roof along with the body, because that is
  // what one colour means for a car. A cabin is not part of that: it keeps its
  // own colour until the second slot is actually in use.
  const roofHex = (mode === 'single' && !carSpec.secondSlot)
    ? bodyHex
    : slotHex(slots.roof);
  // No-op before the model loads, since both sets are empty.
  applyColorTo(bodyMaterials, bodyHex);
  applyColorTo(roofMaterials, roofHex);
  bodySwatch.style.background = bodyHex;
  roofSwatch.style.background = roofHex;
}

function updatePickerUI() {
  const slot = slots[activeSlot];
  // SV square background tracks the current hue.
  svSquare.style.background = `
    linear-gradient(to bottom, rgba(0,0,0,0), #000),
    linear-gradient(to right, #fff, hsl(${slot.h}, 100%, 50%))
  `;
  svCursor.style.left = (slot.s * 100) + '%';
  svCursor.style.top  = ((1 - slot.v) * 100) + '%';
  hueCursor.style.left = (slot.h / 360 * 100) + '%';
  hexInput.value = slotHex(slot).slice(1).toUpperCase();
}

function refreshAll() {
  syncMaterials();
  updatePickerUI();
}

// Mode toggle
modeButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    modeButtons.forEach((b) => b.classList.toggle('active', b === btn));
    mode = btn.dataset.mode;
    if (mode === 'single') {
      roofTab.classList.add('hidden');
      if (activeSlot === 'roof') selectSlot('body');
    } else {
      roofTab.classList.remove('hidden');
    }
    refreshAll();
  });
});

// Slot tabs
function selectSlot(name) {
  activeSlot = name;
  slotTabs.forEach((t) => t.classList.toggle('active', t.dataset.slot === name));
  updatePickerUI();
}
slotTabs.forEach((tab) => {
  tab.addEventListener('click', () => selectSlot(tab.dataset.slot));
});

// Drag helper for the HSV picker. Pointer events cover both touch and mouse.
function setupDrag(el, onMove) {
  let dragging = false;
  function handle(e) {
    const rect = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top)  / rect.height));
    onMove(x, y);
  }
  el.addEventListener('pointerdown', (e) => {
    dragging = true;
    el.setPointerCapture(e.pointerId);
    handle(e);
  });
  el.addEventListener('pointermove', (e) => { if (dragging) handle(e); });
  el.addEventListener('pointerup', (e) => {
    dragging = false;
    try { el.releasePointerCapture(e.pointerId); } catch {}
  });
  el.addEventListener('pointercancel', () => { dragging = false; });
}

setupDrag(svSquare, (x, y) => {
  const slot = slots[activeSlot];
  slot.s = x;
  slot.v = 1 - y;
  refreshAll();
});

setupDrag(hueStrip, (x) => {
  const slot = slots[activeSlot];
  slot.h = x * 360;
  refreshAll();
});

// Hex input
hexInput.addEventListener('input', () => {
  const hsv = hexToHsv('#' + hexInput.value.trim());
  if (!hsv) return;
  const slot = slots[activeSlot];
  [slot.h, slot.s, slot.v] = hsv;
  // Refresh without overwriting what the user is typing.
  syncMaterials();
  svSquare.style.background = `
    linear-gradient(to bottom, rgba(0,0,0,0), #000),
    linear-gradient(to right, #fff, hsl(${slot.h}, 100%, 50%))
  `;
  svCursor.style.left = (slot.s * 100) + '%';
  svCursor.style.top  = ((1 - slot.v) * 100) + '%';
  hueCursor.style.left = (slot.h / 360 * 100) + '%';
});
hexInput.addEventListener('blur', () => updatePickerUI());

refreshAll();


// Screenshot

const shotBtn = document.getElementById('shotBtn');
const flashEl = document.getElementById('flash');

shotBtn.addEventListener('click', () => {
  flashEl.classList.add('active');
  setTimeout(() => flashEl.classList.remove('active'), 300);

  // Force a fresh render so the buffer matches the current camera.
  renderer.render(scene, camera);

  const dataURL = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  link.download = `${carSpec.id}-${ts}.png`;
  link.href = dataURL;
  document.body.appendChild(link);
  link.click();
  link.remove();
});


// Material inspector: Shift + Click logs the material under the cursor.

{
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  canvas.addEventListener('click', (e) => {
    if (!e.shiftKey || !modelLoaded) return;
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObject(car, true);
    if (hits.length === 0) { console.log('[inspect] no hit'); return; }

    const hit = hits[0];
    const mesh = hit.object;
    let mat = mesh.material;
    if (Array.isArray(mesh.material)) {
      const f3 = hit.faceIndex * 3;
      const groups = mesh.geometry.groups || [];
      const group = groups.find(g => f3 >= g.start && f3 < g.start + g.count);
      mat = group ? mesh.material[group.materialIndex] : mesh.material[0];
    }
    console.log('[inspect] mesh:', mesh.name.slice(-60));
    console.log('[inspect] material:', mat?.name || '(unnamed)',
                'type:', mat?.type,
                'color:', mat?.color ? '#' + mat.color.getHexString() : 'n/a');
  });
}


// Back button

document.getElementById('backBtn').addEventListener('click', () => {
  window.location.href = 'garage.html';
});


// Background picker
// Drop your own images into images/backgrounds/ as bg1.jpg through bg3.jpg.
// The fourth slot is a "+" — the user uploads a custom photo (mobile = file
// picker, desktop = file picker OR drag-and-drop anywhere on the page).

const BACKGROUNDS = {
  studio: { color: 0xe8ecf1 },
  bg1: { image: 'images/backgrounds/bg1.jpg' },
  bg2: { image: 'images/backgrounds/bg2.jpg' },
  bg3: { image: 'images/backgrounds/bg3.jpg' },
  custom: { image: null },   // populated when user picks / drops a photo
};
const bgTexLoader = new THREE.TextureLoader();
const bgCache = new Map();
let currentBgId = 'studio';

function setBackground(id) {
  const cfg = BACKGROUNDS[id];
  if (!cfg) return;
  currentBgId = id;

  if (cfg.color !== undefined) {
    scene.background = new THREE.Color(cfg.color);
    return;
  }
  if (bgCache.has(id)) {
    scene.background = bgCache.get(id);
    fitBackground();
    return;
  }
  bgTexLoader.load(
    cfg.image,
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearFilter;
      bgCache.set(id, tex);
      if (currentBgId === id) {
        scene.background = tex;
        fitBackground();
      }
    },
    undefined,
    () => {
      console.warn(`Background "${id}" not found at ${cfg.image}. Add the image and refresh.`);
    }
  );
}

// Cover-fit the background image, cropping any overflow.
// BG_VERTICAL_BIAS shifts the visible window vertically:
//   0 = centered, +1 = pushed up, -1 = pushed down.
const BG_VERTICAL_BIAS = 0.4;
function fitBackground() {
  const tex = scene.background;
  if (!tex || !tex.isTexture || !tex.image) return;
  const imgAspect = tex.image.width / tex.image.height;
  const canvasAspect = canvas.clientWidth / canvas.clientHeight;

  // The imported photo uses the window the user framed instead of the default
  // cover-fit. UV space has its origin bottom-left, hence the flipped y.
  if (currentBgId === 'custom') {
    const r = cropRect(imgAspect, canvasAspect, customCrop);
    tex.repeat.set(r.w, r.h);
    tex.offset.set(r.x, 1 - r.y - r.h);
    return;
  }

  if (canvasAspect > imgAspect) {
    // Crop top and bottom, shifting the sampling window by the bias.
    const repeatY = imgAspect / canvasAspect;
    const maxOffset = 1 - repeatY;
    tex.repeat.set(1, repeatY);
    tex.offset.set(0, (maxOffset / 2) * (1 - BG_VERTICAL_BIAS));
  } else {
    tex.repeat.set(canvasAspect / imgAspect, 1);
    tex.offset.set((1 - canvasAspect / imgAspect) / 2, 0);
  }
}

document.querySelectorAll('.bg-thumb').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (btn.dataset.bg === 'custom') {
      const isEmpty  = !btn.classList.contains('has-image');
      const isActive =  btn.classList.contains('active');
      // Empty slot → open the picker. Already-active photo → reopen the
      // framing editor, which also offers to swap the image.
      if (isEmpty)  { customBgInput.click(); return; }
      if (isActive) { openCropEditor(null);  return; }
      // Has image but currently not active → just activate it.
    }
    document.querySelectorAll('.bg-thumb').forEach((b) =>
      b.classList.toggle('active', b === btn)
    );
    setBackground(btn.dataset.bg);
  });
});

// ---- Custom background: file picker + drag-and-drop ---------------------
const customBgInput = document.getElementById('customBgInput');
const customThumb = document.querySelector('.bg-thumb[data-bg="custom"]');
let customObjectUrl = null;

// The photo isn't applied straight away: the user first frames it, and
// applyCrop() below installs it as the background.
function loadCustomBackground(file) {
  if (!file || !file.type || !file.type.startsWith('image/')) return;
  openCropEditor(file);
}

customBgInput.addEventListener('change', () => {
  const file = customBgInput.files && customBgInput.files[0];
  if (file) loadCustomBackground(file);
  customBgInput.value = '';   // allow re-selecting the same file later
});

// Whole-page drag-and-drop (desktop). Mobile browsers don't fire these,
// so this is effectively desktop-only without any UA sniffing.
let dragDepth = 0;
window.addEventListener('dragenter', (e) => {
  if (!e.dataTransfer || !Array.from(e.dataTransfer.types).includes('Files')) return;
  dragDepth++;
  document.body.classList.add('dragging-file');
});
window.addEventListener('dragover', (e) => {
  if (!e.dataTransfer || !Array.from(e.dataTransfer.types).includes('Files')) return;
  e.preventDefault();   // required to allow drop
  e.dataTransfer.dropEffect = 'copy';
});
window.addEventListener('dragleave', () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) document.body.classList.remove('dragging-file');
});
window.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  document.body.classList.remove('dragging-file');
  const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if (file) loadCustomBackground(file);
});


// Framing editor: pick which part of the imported photo stays visible.
// The frame always carries the aspect ratio of the browser window, so whatever
// it covers is exactly what shows up behind the car.

const cropOverlay   = document.getElementById('cropOverlay');
const cropStage     = document.getElementById('cropStage');
const cropImage     = document.getElementById('cropImage');
const cropFrame     = document.getElementById('cropFrame');
const cropZoom      = document.getElementById('cropZoom');
const cropChangeBtn = document.getElementById('cropChangeBtn');
const cropCancelBtn = document.getElementById('cropCancelBtn');
const cropApplyBtn  = document.getElementById('cropApplyBtn');

// A browser can serve this script from cache next to a page it doesn't match
// (GitHub Pages hands everything a 10 minute max-age, and a plain reload only
// revalidates the document). Missing panel = no framing editor, never a crash.
const cropReady = !!(cropOverlay && cropStage && cropImage && cropFrame &&
                     cropZoom && cropChangeBtn && cropCancelBtn && cropApplyBtn);

// Framing in use, in normalized image coordinates: cx/cy is the center of the
// visible window, zoom 1 shows as much as the window aspect allows and higher
// values crop in further.
const customCrop = { cx: 0.5, cy: 0.5, zoom: 1 };
const MAX_ZOOM = 4;

let editCrop = { ...customCrop };   // working copy while the editor is open
let pendingObjectUrl = null;        // photo being framed, not applied yet

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Largest window with the wanted aspect that fits the image, shrunk by zoom and
// kept inside the image bounds. y grows downwards, like the image itself.
function cropRect(imgAspect, viewAspect, crop) {
  let w = 1, h = 1;
  if (viewAspect > imgAspect) h = imgAspect / viewAspect;
  else                        w = viewAspect / imgAspect;
  w /= crop.zoom;
  h /= crop.zoom;
  const cx = clamp(crop.cx, w / 2, 1 - w / 2);
  const cy = clamp(crop.cy, h / 2, 1 - h / 2);
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

function isCropOpen() {
  return cropReady && cropOverlay.classList.contains('open');
}

function drawCropFrame() {
  // Closed editor means no layout to measure, so nothing to draw either.
  if (!isCropOpen() || !cropImage.naturalWidth) return;
  // The stage is the frame's reference box: hold it to the size the photo is
  // actually rendered at, whatever the browser makes of fit-content.
  cropStage.style.width = cropImage.clientWidth + 'px';
  const r = cropRect(
    cropImage.naturalWidth / cropImage.naturalHeight,
    canvas.clientWidth / canvas.clientHeight,
    editCrop
  );
  // Store the clamped center back, otherwise dragging past an edge would wind
  // up an offset the frame never shows.
  editCrop.cx = r.x + r.w / 2;
  editCrop.cy = r.y + r.h / 2;
  cropFrame.style.left   = (r.x * 100) + '%';
  cropFrame.style.top    = (r.y * 100) + '%';
  cropFrame.style.width  = (r.w * 100) + '%';
  cropFrame.style.height = (r.h * 100) + '%';
}

// file = null reframes the photo already in use.
function openCropEditor(file) {
  if (!cropReady) {
    // No panel to frame it with: fall back to using the photo as it comes.
    if (file) {
      pendingObjectUrl = URL.createObjectURL(file);
      editCrop = { cx: 0.5, cy: 0.5, zoom: 1 };
      applyCrop();
    }
    return;
  }
  if (file) {
    if (pendingObjectUrl) URL.revokeObjectURL(pendingObjectUrl);
    pendingObjectUrl = URL.createObjectURL(file);
    editCrop = { cx: 0.5, cy: 0.5, zoom: 1 };
    cropImage.src = pendingObjectUrl;
  } else {
    if (!customObjectUrl) return;
    editCrop = { ...customCrop };
    cropImage.src = customObjectUrl;
  }
  cropZoom.value = editCrop.zoom;
  // The hidden attribute is the fallback guard, the class carries the layout.
  cropOverlay.hidden = false;
  cropOverlay.classList.add('open');
  // naturalWidth stays 0 until the image decodes; the load handler covers that.
  if (cropImage.complete) drawCropFrame();
}

function closeCropEditor() {
  if (!cropReady) return;
  cropOverlay.classList.remove('open');
  cropOverlay.hidden = true;
}

function cancelCrop() {
  if (pendingObjectUrl) {
    URL.revokeObjectURL(pendingObjectUrl);
    pendingObjectUrl = null;
  }
  closeCropEditor();
}

function applyCrop() {
  Object.assign(customCrop, editCrop);

  if (pendingObjectUrl) {
    // A new photo was picked: swap it in and drop the stale cached texture.
    if (customObjectUrl) URL.revokeObjectURL(customObjectUrl);
    customObjectUrl = pendingObjectUrl;
    pendingObjectUrl = null;
    BACKGROUNDS.custom.image = customObjectUrl;
    const old = bgCache.get('custom');
    if (old) { old.dispose(); bgCache.delete('custom'); }

    // Update thumb appearance: hide the "+" and show the photo as the preview.
    customThumb.classList.add('has-image');
    customThumb.style.backgroundImage = `url("${customObjectUrl}")`;
    // From now on the thumb reopens this editor, so say so on hover. Setting
    // the key (not just the title) keeps it translated on a language switch.
    customThumb.dataset.i18nTitle = 'bgCustomFrame';
    if (i18n.t) customThumb.title = i18n.t('bgCustomFrame');
  }

  document.querySelectorAll('.bg-thumb').forEach((b) =>
    b.classList.toggle('active', b === customThumb)
  );
  // setBackground reframes the cached texture, or does it once the new one loads.
  setBackground('custom');
  closeCropEditor();
}

function setCropZoom(z) {
  editCrop.zoom = clamp(z, 1, MAX_ZOOM);
  cropZoom.value = editCrop.zoom;
  drawCropFrame();
}

// Drag the frame with one pointer, pinch with two, wheel or slider to zoom.
const cropPointers = new Map();
let cropDragStart = null;
let cropPinchStart = null;

function cropPinchDistance() {
  const [a, b] = [...cropPointers.values()];
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function startCropDrag(x, y) {
  cropDragStart = { x, y, cx: editCrop.cx, cy: editCrop.cy };
}

function onCropPointerDown(e) {
  cropStage.setPointerCapture(e.pointerId);
  cropPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (cropPointers.size === 1) {
    startCropDrag(e.clientX, e.clientY);
    cropStage.classList.add('grabbing');
  } else if (cropPointers.size === 2) {
    const dist = cropPinchDistance();
    // Two fingers on the same spot would make the zoom ratio blow up.
    cropPinchStart = dist > 0 ? { dist, zoom: editCrop.zoom } : null;
    cropDragStart = null;   // panning resumes when a finger lifts
  }
}

function onCropPointerMove(e) {
  if (!cropPointers.has(e.pointerId)) return;
  cropPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (cropPinchStart && cropPointers.size >= 2) {
    const dist = cropPinchDistance();
    if (dist > 0) setCropZoom(cropPinchStart.zoom * (dist / cropPinchStart.dist));
    return;
  }
  if (!cropDragStart) return;
  const rect = cropStage.getBoundingClientRect();
  editCrop.cx = cropDragStart.cx + (e.clientX - cropDragStart.x) / rect.width;
  editCrop.cy = cropDragStart.cy + (e.clientY - cropDragStart.y) / rect.height;
  drawCropFrame();
}

function endCropPointer(e) {
  cropPointers.delete(e.pointerId);
  try { cropStage.releasePointerCapture(e.pointerId); } catch {}
  if (cropPointers.size < 2) cropPinchStart = null;
  if (cropPointers.size === 0) {
    cropDragStart = null;
    cropStage.classList.remove('grabbing');
  } else {
    // A finger lifted mid-pinch: restart the pan from the one still down.
    const [p] = [...cropPointers.values()];
    startCropDrag(p.x, p.y);
  }
}
function onCropWheel(e) {
  e.preventDefault();
  setCropZoom(editCrop.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12));
}

// Wiring lives here on its own so a missing panel simply skips it.
if (cropReady) {
  cropZoom.max = MAX_ZOOM;
  cropImage.addEventListener('load', drawCropFrame);
  cropStage.addEventListener('pointerdown', onCropPointerDown);
  cropStage.addEventListener('pointermove', onCropPointerMove);
  cropStage.addEventListener('pointerup', endCropPointer);
  cropStage.addEventListener('pointercancel', endCropPointer);
  cropStage.addEventListener('wheel', onCropWheel, { passive: false });
  cropZoom.addEventListener('input', () => setCropZoom(parseFloat(cropZoom.value)));
  cropChangeBtn.addEventListener('click', () => customBgInput.click());
  cropCancelBtn.addEventListener('click', cancelCrop);
  cropApplyBtn.addEventListener('click', applyCrop);
  cropOverlay.addEventListener('pointerdown', (e) => {
    if (e.target === cropOverlay) cancelCrop();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isCropOpen()) cancelCrop();
  });
}


// Resize

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  // Re-fit only while the view is still the one we chose: once the user has
  // orbited or zoomed, a resize must not yank the camera back.
  if (!userMovedCamera) applyFraming();
  fitBackground();
  // The frame follows the window aspect, so it has to be redrawn too.
  drawCropFrame();
});


// Animation: idle rotation that pauses while the user is interacting.

let lastInteractionTime = -Infinity;
let isInteracting = false;
const IDLE_DELAY = 1500;

controls.addEventListener('start', () => { isInteracting = true; userMovedCamera = true; });
controls.addEventListener('end',   () => { isInteracting = false; lastInteractionTime = performance.now(); });

function animate() {
  requestAnimationFrame(animate);
  controls.update();

  const idle = !isInteracting && (performance.now() - lastInteractionTime > IDLE_DELAY);
  if (idle) car.rotation.y += 0.0035;

  renderer.render(scene, camera);
}
animate();
