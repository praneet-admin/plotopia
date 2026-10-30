// Builds the 3D hall for a hall definition. Everything static is merged into a few dozen draw calls;
// invisible proxy boxes handle picking and sightline raycasts. Returns what the app needs to pick, measure and render.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CATEGORIES, layoutSeats, screenOf } from './halls.js';
import { EYE_HEIGHT } from './metrics.js';

/* ---------- procedural textures (no downloads, works offline) ---------- */
function noiseCanvas(size, draw) { const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size); return c; }
function makeTexture(canvas, repeat = 1, srgb = true) {
  const t = new THREE.CanvasTexture(canvas); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const fabricMap = makeTexture(noiseCanvas(256, (g, s) => {
  g.fillStyle = '#7a1f2b'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${90 + Math.random() * 60},${10 + Math.random() * 20},${20 + Math.random() * 25},.35)`; g.fillRect(Math.random() * s, Math.random() * s, 2, 2); }
}), 2);
const fabricBump = makeTexture(noiseCanvas(256, (g, s) => {
  g.fillStyle = '#808080'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 14000; i++) { const v = 100 + Math.random() * 110; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(Math.random() * s, Math.random() * s, 1.5, 1.5); }
}), 2, false);
const carpetMap = makeTexture(noiseCanvas(512, (g, s) => {
  g.fillStyle = '#2b1216'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 40000; i++) { g.fillStyle = `rgba(${40 + Math.random() * 60},${15 + Math.random() * 20},${20 + Math.random() * 25},.5)`; g.fillRect(Math.random() * s, Math.random() * s, 2, 2); }
  g.strokeStyle = 'rgba(160,110,60,.18)'; g.lineWidth = 2;
  for (let i = 0; i < 10; i++) { g.beginPath(); g.arc(Math.random() * s, Math.random() * s, 20 + Math.random() * 60, 0, Math.PI * 2); g.stroke(); }
}), 6);
const pleatMap = makeTexture(noiseCanvas(256, (g, s) => {
  for (let x = 0; x < s; x++) { const v = 0.55 + 0.45 * Math.sin((x / s) * Math.PI * 16); g.fillStyle = `rgb(${Math.round(70 * v)},${Math.round(14 * v)},${Math.round(22 * v)})`; g.fillRect(x, 0, 1, s); }
}), 1);
const panelMap = makeTexture(noiseCanvas(128, (g, s) => {
  g.fillStyle = '#231a1c'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 3000; i++) { const v = 25 + Math.random() * 25; g.fillStyle = `rgb(${v + 10},${v},${v + 2})`; g.fillRect(Math.random() * s, Math.random() * s, 2, 2); }
}), 4);
function textCanvas(text, fg, bg, w = 256, h = 96, font = 'bold 60px Helvetica,Arial') {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 2); return c;
}
const exitTex = new THREE.CanvasTexture(textCanvas('EXIT', '#8dffb0', '#0a3a1a')); exitTex.colorSpace = THREE.SRGBColorSpace;
/* one atlas with A–Z so every lit row letter on the steps merges into a single mesh */
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const letterTex = (() => { const c = document.createElement('canvas'); c.width = 26 * 64; c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#2a1d10'; g.fillRect(0, 0, c.width, 64); g.fillStyle = '#ffd9a0'; g.font = 'bold 48px Helvetica,Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; [...LETTERS].forEach((ch, i) => g.fillText(ch, i * 64 + 32, 34)); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
function letterPlane(ch, w, h) { const i = LETTERS.indexOf(ch); const g = new THREE.PlaneGeometry(w, h); const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setX(k, (i + uv.getX(k)) / 26); return g; }

/* ---------- materials ---------- */
const M = {
  shell: new THREE.MeshStandardMaterial({ color: 0x1b1316, roughness: 1, side: THREE.BackSide }),
  floor: new THREE.MeshStandardMaterial({ map: carpetMap, roughness: 1 }),
  step: new THREE.MeshStandardMaterial({ color: 0x1a1214, roughness: 0.95 }),
  stepNose: new THREE.MeshStandardMaterial({ color: 0x3a2e2a, roughness: 0.6, metalness: 0.4 }),
  panelA: new THREE.MeshStandardMaterial({ map: panelMap, color: 0x8a7a7c, roughness: 1 }),
  panelB: new THREE.MeshStandardMaterial({ map: panelMap, color: 0x5a4a4c, roughness: 1 }),
  curtain: new THREE.MeshStandardMaterial({ map: pleatMap, roughness: 1 }),
  frame: new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.9 }),
  fabric: new THREE.MeshStandardMaterial({ map: fabricMap, bumpMap: fabricBump, bumpScale: 0.004, roughness: 0.95 }),
  fabricPrime: new THREE.MeshStandardMaterial({ map: fabricMap, bumpMap: fabricBump, bumpScale: 0.004, color: 0xb0a0a8, roughness: 0.95 }),
  leather: new THREE.MeshPhysicalMaterial({ color: 0x17171a, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.35, bumpMap: fabricBump, bumpScale: 0.002 }),
  leatherLite: new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.5 }),
  plastic: new THREE.MeshStandardMaterial({ color: 0x111113, roughness: 0.45, metalness: 0.1 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x8c8c90, roughness: 0.35, metalness: 0.9 }),
  led: new THREE.MeshBasicMaterial({ color: 0x9fd8ff }),
  sconce: new THREE.MeshBasicMaterial({ color: 0xffc88a }),
  downlight: new THREE.MeshBasicMaterial({ color: 0x3a2a1c }),
  exit: new THREE.MeshBasicMaterial({ map: exitTex }),
  rowLabel: new THREE.MeshBasicMaterial({ map: letterTex }),
  person: new THREE.MeshStandardMaterial({ color: 0x141418, roughness: 0.95 }),
  hair: new THREE.MeshStandardMaterial({ color: 0x0c0a0a, roughness: 1 }),
  skin: new THREE.MeshStandardMaterial({ color: 0x3a2a24, roughness: 0.9 }),
  speaker: new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.6 }),
  beam: new THREE.MeshBasicMaterial({ color: 0xcfe3ff, transparent: true, opacity: 0.06, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
  dust: new THREE.PointsMaterial({ color: 0xdde8ff, size: 0.022, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending }),
  selected: new THREE.MeshStandardMaterial({ color: 0xffd98a, emissive: 0xffb340, emissiveIntensity: 1.2, roughness: 0.6 }),
  pinned: new THREE.MeshStandardMaterial({ color: 0x9fd8ff, emissive: 0x3fb4ff, emissiveIntensity: 1.2, roughness: 0.6 }),
  ring: new THREE.MeshBasicMaterial({ color: 0xffb340, transparent: true, opacity: 0.9 }),
  proxy: new THREE.MeshBasicMaterial({ visible: false }),
};
const SHADOW_KEYS = new Set(['fabric', 'fabricPrime', 'leather', 'plastic', 'steel', 'person', 'hair', 'skin', 'step', 'floor', 'stepNose', 'panelA', 'panelB', 'speaker']);

export function buildHall(hall, scene, { lite = false } = {}) {
  if (lite) { M.leather = M.leatherLite; }   // clearcoat physical material is the costliest shader; skip it on weak GPUs
  const world = new THREE.Group(); scene.add(world);
  const scr = screenOf(hall);
  const seats = layoutSeats(hall);
  const pickables = [], occluders = [];
  const rows = hall.rows.length, backZ = hall.firstRowZ + rows * hall.rowPitch + 1.5, len = backZ + 2;

  /* Static geometry goes into bins by material and is merged into one mesh per bin. */
  const bins = {}; const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(1, 1, 1), tmpP = new THREE.Vector3(), tmpE = new THREE.Euler();
  const put = (key, geo, x, y, z, rx = 0, ry = 0, rz = 0) => {
    tmpM.compose(tmpP.set(x, y, z), tmpQ.setFromEuler(tmpE.set(rx, ry, rz)), tmpS);
    const g = geo.clone().applyMatrix4(tmpM); g.deleteAttribute('uv2'); (bins[key] ??= []).push(g);
  };
  const BOX = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const mesh = (geo, m, x, y, z, { cast = false, receive = false, rx = 0, ry = 0 } = {}) => {
    const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, 0); o.castShadow = cast; o.receiveShadow = receive; world.add(o); return o;
  };

  /* ---------- room ---------- */
  mesh(new THREE.BoxGeometry(hall.hallW, hall.hallH + 0.2, len), M.shell, 0, hall.hallH / 2 - 0.1, backZ / 2 - 1, { receive: true });
  put('floor', BOX(hall.hallW, 0.2, len), 0, -0.1, backZ / 2 - 1);
  const houseLights = [];
  for (const sx of [-1, 1]) {
    let i = 0;
    for (let z = 1; z < backZ; z += 1.3, i++) {
      put(i % 2 ? 'panelA' : 'panelB', BOX(0.12, hall.hallH * 0.78, 1.15), sx * (hall.hallW / 2 - 0.06), hall.hallH * 0.42, z);
      if (i % 4 === 2) {
        put('sconce', BOX(0.14, 0.28, 0.1), sx * (hall.hallW / 2 - 0.14), 2.6, z);
        if (i % 8 === 2) { const l = new THREE.PointLight(0xffb070, 3.5, 9, 1.7); l.position.set(sx * (hall.hallW / 2 - 0.5), 2.7, z); world.add(l); houseLights.push(l); }
      }
    }
    mesh(new THREE.PlaneGeometry(0.9, 0.34), M.exit, sx * (hall.hallW / 2 - 0.13), 2.9, 0.4, { ry: -sx * Math.PI / 2 });
    for (let k = 0; k < 3; k++) put('speaker', BOX(0.32, 0.55, 0.32), sx * (hall.hallW / 2 - 0.3), hall.hallH * 0.55, 3 + k * backZ / 3.5);
  }
  seats.filter(s => s.num === 1).forEach(s => {
    const h = Math.max(s.y, 0.02);
    put('step', BOX(hall.hallW - 0.3, h, hall.rowPitch), 0, h / 2, s.z);
    put('floor', BOX(hall.hallW - 0.3, 0.015, hall.rowPitch), 0, h + 0.008, s.z);
    put('stepNose', BOX(hall.hallW - 0.3, 0.03, 0.06), 0, h, s.z - hall.rowPitch / 2 + 0.03);
    put('led', BOX(hall.aisle - 0.2, 0.012, 0.025), 0, h + 0.02, s.z - hall.rowPitch / 2 + 0.06);
    for (const sx of [-1, 1]) put('rowLabel', letterPlane(s.row, 0.16, 0.16), sx * (hall.aisle / 2 + 0.12), h + 0.012, s.z + hall.rowPitch * 0.1, -Math.PI / 2);
  });
  put('floor', BOX(hall.hallW - 0.3, 0.02, hall.firstRowZ - 1), 0, 0.01, (hall.firstRowZ - 1) / 2 + 0.5);
  for (let z = 3; z < backZ; z += 3) for (const x of [-hall.hallW / 3, 0, hall.hallW / 3]) put('downlight', new THREE.CircleGeometry(0.12, 12), x, hall.hallH - 0.01, z, Math.PI / 2);

  /* ---------- screen: slightly curved, with pleated masking and a black frame ---------- */
  const sag = scr.w * 0.025;
  const sgeo = new THREE.PlaneGeometry(scr.w, scr.h, 48, 1);
  const pos = sgeo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i) / (scr.w / 2); pos.setZ(i, -sag * (1 - x * x)); }
  sgeo.computeVertexNormals();
  const screenMesh = mesh(sgeo, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), 0, scr.cy, 0);
  put('frame', BOX(scr.w + 0.6, scr.h + 0.6, 0.25), 0, scr.cy, -sag - 0.2);
  const curtainW = Math.max(1.5, (hall.hallW - scr.w) / 2 - 0.3);
  for (const sx of [-1, 1]) put('curtain', new THREE.PlaneGeometry(curtainW, hall.hallH), sx * (scr.w / 2 + 0.3 + curtainW / 2), hall.hallH / 2, -0.3);
  put('curtain', new THREE.PlaneGeometry(scr.w + 1, (hall.hallH - scr.top) * 0.9), 0, (hall.hallH + scr.top) / 2, -0.3);
  put('frame', BOX(hall.hallW, scr.bottom + 0.2, 0.3), 0, (scr.bottom - 0.2) / 2, -0.3);

  /* A real screen is the only big light source in the room: a soft wash on the front rows with faint head shadows. */
  const glow = new THREE.SpotLight(0xc8dcff, 55, backZ * 2.2, Math.PI / 2.4, 0.9, 1.3);
  glow.position.set(0, scr.cy, 0.3); glow.target.position.set(0, 2, backZ * 0.7);
  glow.castShadow = !lite; glow.shadow.mapSize.set(1024, 1024); glow.shadow.bias = -0.0004; glow.shadow.camera.near = 1; glow.shadow.camera.far = backZ * 2;
  world.add(glow, glow.target);

  /* ---------- projector and its beam ---------- */
  const projY = hall.hallH - 0.9, projZ = backZ + 0.7;
  put('plastic', BOX(0.7, 0.4, 0.9), 0, projY, projZ);
  put('led', BOX(0.16, 0.16, 0.05), 0, projY, projZ - 0.47);
  const beamLen = Math.hypot(projZ, projY - scr.cy);
  const coneGeo = new THREE.ConeGeometry((scr.w / 2) / 0.707, beamLen, 4, 1, true).rotateY(Math.PI / 4).translate(0, -beamLen / 2, 0);
  const beam = new THREE.Mesh(coneGeo, M.beam); beam.rotation.x = -Math.PI / 2; beam.scale.z = scr.h / scr.w;
  const beamGroup = new THREE.Group(); beamGroup.position.set(0, projY, projZ); beamGroup.lookAt(0, scr.cy, 0); beamGroup.add(beam); world.add(beamGroup);
  const dustN = 220, dustPos = new Float32Array(dustN * 3);
  for (let i = 0; i < dustN; i++) {
    const t = Math.random(); const spread = t * scr.w * 0.45;
    dustPos[i * 3] = (Math.random() - 0.5) * 2 * spread; dustPos[i * 3 + 1] = projY + (scr.cy - projY) * t + (Math.random() - 0.5) * spread * scr.h / scr.w; dustPos[i * 3 + 2] = projZ * (1 - t);
  }
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, M.dust); world.add(dust);

  /* ---------- seats: one template per category, stamped into the bins ---------- */
  const templates = {};
  const template = cat => {
    if (templates[cat]) return templates[cat];
    const c = CATEGORIES[cat], w = c.pitch - 0.05, d = c.depth, rec = cat === 'recliner';
    const soft = rec ? 'leather' : cat === 'prime' ? 'fabricPrime' : 'fabric';
    const parts = [];
    const part = (geo, key, x, y, z, rx = 0, name = '') => parts.push({ geo, key, x, y, z, rx, name });
    const seg = lite ? 1 : 3;
    part(new RoundedBoxGeometry(w - 0.1, 0.16, d - 0.08, seg, 0.05), soft, 0, 0.46, -0.02, -0.08, 'cushion');
    part(new RoundedBoxGeometry(w - 0.1, rec ? 0.78 : 0.62, 0.13, seg, 0.05), soft, 0, 0.46 + (rec ? 0.42 : 0.34), d / 2 - 0.08, 0.2, 'back');
    if (rec) part(new RoundedBoxGeometry(w - 0.18, 0.18, 0.1, 2, 0.04), soft, 0, 1.22, d / 2 - 0.02, 0.2, 'headrest');
    if (rec) part(new RoundedBoxGeometry(w - 0.14, 0.1, 0.4, 2, 0.03), soft, 0, 0.36, -d / 2 - 0.1, 0.3, 'footrest');
    for (const sx of [-1, 1]) {
      part(BOX(0.06, 0.24, d * 0.78), 'plastic', sx * (w / 2 - 0.03), 0.58, 0);
      part(new THREE.TorusGeometry(0.035, 0.008, 5, 12), 'steel', sx * (w / 2 - 0.03), 0.705, -d * 0.3, Math.PI / 2);
    }
    part(BOX(w - 0.2, 0.38, 0.12), 'plastic', 0, 0.19, 0.08);
    return (templates[cat] = { parts, w, d, soft });
  };
  for (const s of seats) {
    const t = template(s.cat);
    for (const p of t.parts) put(p.key, p.geo, s.x + p.x, s.y + p.y, s.z + p.z, p.rx);
    /* invisible proxies: one for picking the seat, one thin slab where the backrest is for sightlines */
    const pick = new THREE.Mesh(BOX(t.w, 1.2, t.d + 0.1), M.proxy); pick.position.set(s.x, s.y + 0.6, s.z); pick.userData.seat = s; world.add(pick); pickables.push(pick); s.mesh = pick;
    const backH = s.cat === 'recliner' ? 1.35 : 1.1;
    const back = new THREE.Mesh(BOX(t.w - 0.1, backH, 0.13), M.proxy); back.position.set(s.x, s.y + backH / 2, s.z + t.d / 2 - 0.05); back.userData.worldZ = back.position.z; back.userData.worldX = s.x; world.add(back); occluders.push(back);
    if (s.sold) {
      const lean = (Math.random() - 0.5) * 0.08, tall = (Math.random() - 0.5) * 0.07, y = s.y + tall;
      put('person', new THREE.CapsuleGeometry(0.13, 0.34, 3, 8), s.x, y + 0.84, s.z + 0.02);
      put('person', new THREE.CapsuleGeometry(0.075, 0.3, 3, 8), s.x, y + 1.0, s.z + 0.02, 0, 0, Math.PI / 2);
      put('skin', new THREE.CylinderGeometry(0.045, 0.05, 0.08, 8), s.x + lean, y + 1.1, s.z + 0.02);
      put('skin', new THREE.SphereGeometry(0.105, 12, 10), s.x + lean, y + EYE_HEIGHT + 0.04, s.z);
      put('hair', new THREE.SphereGeometry(0.112, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), s.x + lean, y + EYE_HEIGHT + 0.05, s.z - 0.01);
      /* one proxy per person: head and shoulders as a box plus a head sphere */
      const body = new THREE.Mesh(BOX(0.44, 0.62, 0.28), M.proxy); body.position.set(s.x, y + 0.82, s.z + 0.02); body.userData.worldZ = s.z; body.userData.worldX = s.x; world.add(body); occluders.push(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 8, 6), M.proxy); head.position.set(s.x + lean, y + EYE_HEIGHT + 0.04, s.z); head.userData.worldZ = s.z; head.userData.worldX = s.x; world.add(head); occluders.push(head);
    }
  }

  /* merge the bins */
  for (const [key, list] of Object.entries(bins)) {
    const merged = mergeGeometries(list, false); list.forEach(g => g.dispose());
    const m = new THREE.Mesh(merged, M[key]); m.castShadow = m.receiveShadow = SHADOW_KEYS.has(key); world.add(m);
  }

  /* highlight overlays: the soft parts of a seat, re-drawn in a glowing material on top of the merged seat */
  const overlays = { selected: null, pinned: null };
  const overlayFor = (kind, seat) => {
    overlays[kind]?.removeFromParent();
    const t = template(seat.cat); const g = new THREE.Group();
    for (const p of t.parts) if (p.name === 'cushion' || p.name === 'back' || p.name === 'headrest') {
      const o = new THREE.Mesh(p.geo, M[kind]); o.position.set(p.x, p.y, p.z); o.rotation.x = p.rx; o.scale.setScalar(1.02); g.add(o);
    }
    g.position.set(seat.x, seat.y, seat.z); world.add(g); overlays[kind] = g; g.userData.seat = seat;
  };
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.38, 32), M.ring); ring.rotation.x = -Math.PI / 2; ring.visible = false; world.add(ring);
  /* tiny stand-ins so the highlight shaders compile with the rest of the hall, not on the first tap */
  for (const k of ['selected', 'pinned']) { const d = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01), M[k]); d.position.set(0, -5, 0); world.add(d); }

  const center = new THREE.Vector3(0, 2.5, backZ * 0.5);
  const overview = new THREE.Vector3(hall.hallW * 0.75, hall.hallH * 1.7, backZ * 1.55);

  function dispose() { world.traverse(o => { o.geometry?.dispose(); }); for (const t of Object.values(templates)) t.parts.forEach(p => p.geo.dispose()); scene.remove(world); }
  function highlight(seat, kind) {
    if (kind === 'selected' || kind === 'pinned') { overlayFor(kind, seat); }
    else for (const k of ['selected', 'pinned']) if (overlays[k]?.userData.seat === seat) { overlays[k].removeFromParent(); overlays[k] = null; }
    if (kind === 'selected') { ring.visible = true; ring.position.set(seat.x, seat.y + 0.02, seat.z); }
    else if (ring.position.x === seat.x && ring.position.z === seat.z && !kind) ring.visible = false;
  }
  function tick(t) { const a = dust.geometry.attributes.position; for (let i = 0; i < dustN; i++) a.array[i * 3 + 1] += Math.sin(t * 0.7 + i) * 0.0006; a.needsUpdate = true; }
  let houseLevel = -1;
  function setHouse(k) {
    if (Math.abs(k - houseLevel) < 0.002) return; houseLevel = k;
    for (const l of houseLights) l.intensity = 3.5 + k * 14;
    M.downlight.color.setHex(0x3a2a1c).lerp(new THREE.Color(0xffe2b8), k);
    M.sconce.color.setHex(0xffc88a).multiplyScalar(0.6 + k * 0.6);
  }

  return { hall, scr, seats, pickables, occluders, screenMesh, glow, center, overview, backZ, dispose, highlight, tick, setHouse };
}
