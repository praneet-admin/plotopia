// Builds the 3D hall for a hall definition: fabric and leather seats, occupants, acoustic walls, sconces,
// a curved screen with pleated masking, a projector beam. Returns what the app needs to pick, measure and render.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
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
  return noiseCanvas(w, (g) => { g.canvas.width = w; g.canvas.height = h; g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 2); });
}
const exitTex = new THREE.CanvasTexture(textCanvas('EXIT', '#8dffb0', '#0a3a1a')); exitTex.colorSpace = THREE.SRGBColorSpace;

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
  plastic: new THREE.MeshStandardMaterial({ color: 0x111113, roughness: 0.45, metalness: 0.1 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x8c8c90, roughness: 0.35, metalness: 0.9 }),
  led: new THREE.MeshBasicMaterial({ color: 0x9fd8ff }),
  sconce: new THREE.MeshBasicMaterial({ color: 0xffc88a }),
  exit: new THREE.MeshBasicMaterial({ map: exitTex }),
  person: new THREE.MeshStandardMaterial({ color: 0x141418, roughness: 0.95 }),
  hair: new THREE.MeshStandardMaterial({ color: 0x0c0a0a, roughness: 1 }),
  skin: new THREE.MeshStandardMaterial({ color: 0x3a2a24, roughness: 0.9 }),
  speaker: new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.6 }),
  beam: new THREE.MeshBasicMaterial({ color: 0xcfe3ff, transparent: true, opacity: 0.06, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
  dust: new THREE.PointsMaterial({ color: 0xdde8ff, size: 0.022, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending }),
  selected: new THREE.MeshStandardMaterial({ color: 0xffd98a, emissive: 0xffb340, emissiveIntensity: 1.2, roughness: 0.6 }),
  pinned: new THREE.MeshStandardMaterial({ color: 0x9fd8ff, emissive: 0x3fb4ff, emissiveIntensity: 1.2, roughness: 0.6 }),
  ring: new THREE.MeshBasicMaterial({ color: 0xffb340, transparent: true, opacity: 0.9 }),
};

export function buildHall(hall, scene) {
  const world = new THREE.Group(); scene.add(world);
  const scr = screenOf(hall);
  const seats = layoutSeats(hall);
  const pickables = [], occluders = [];
  const rows = hall.rows.length, backZ = hall.firstRowZ + rows * hall.rowPitch + 1.5, len = backZ + 2;
  const mesh = (geo, m, x, y, z, { cast = false, receive = false, rx = 0, ry = 0 } = {}) => {
    const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, 0); o.castShadow = cast; o.receiveShadow = receive; world.add(o); return o;
  };
  const box = (w, h, d, m, x, y, z, opts) => mesh(new THREE.BoxGeometry(w, h, d), m, x, y, z, opts);

  /* ---------- room ---------- */
  const shell = mesh(new THREE.BoxGeometry(hall.hallW, hall.hallH + 0.2, len), M.shell, 0, hall.hallH / 2 - 0.1, backZ / 2 - 1, { receive: true });
  box(hall.hallW, 0.2, len, M.floor, 0, -0.1, backZ / 2 - 1, { receive: true });
  /* acoustic panels along both side walls, with sconces between them */
  for (const sx of [-1, 1]) {
    let i = 0;
    for (let z = 1; z < backZ; z += 1.3, i++) {
      box(0.12, hall.hallH * 0.78, 1.15, i % 2 ? M.panelA : M.panelB, sx * (hall.hallW / 2 - 0.06), hall.hallH * 0.42, z);
      if (i % 4 === 2) {
        box(0.14, 0.28, 0.1, M.sconce, sx * (hall.hallW / 2 - 0.14), 2.6, z);
        if (i % 8 === 2) { const l = new THREE.PointLight(0xffb070, 6, 9, 1.6); l.position.set(sx * (hall.hallW / 2 - 0.5), 2.7, z); world.add(l); }
      }
    }
    mesh(new THREE.PlaneGeometry(0.9, 0.34), M.exit, sx * (hall.hallW / 2 - 0.13), 2.9, 0.4, { ry: -sx * Math.PI / 2 });
    for (let k = 0; k < 3; k++) box(0.32, 0.55, 0.32, M.speaker, sx * (hall.hallW / 2 - 0.3), hall.hallH * 0.55, 3 + k * backZ / 3.5);
  }
  /* stadium steps with carpet, nosings and LED strips in the aisle */
  seats.filter(s => s.num === 1).forEach(s => {
    const h = Math.max(s.y, 0.02);
    box(hall.hallW - 0.3, h, hall.rowPitch, M.step, 0, h / 2, s.z, { receive: true });
    box(hall.hallW - 0.3, 0.015, hall.rowPitch, M.floor, 0, h + 0.008, s.z, { receive: true });
    box(hall.hallW - 0.3, 0.03, 0.06, M.stepNose, 0, h, s.z - hall.rowPitch / 2 + 0.03);
    box(hall.aisle - 0.2, 0.012, 0.025, M.led, 0, h + 0.02, s.z - hall.rowPitch / 2 + 0.06);
  });
  box(hall.hallW - 0.3, 0.02, hall.firstRowZ - 1, M.floor, 0, 0.01, (hall.firstRowZ - 1) / 2 + 0.5, { receive: true });

  /* ---------- screen: slightly curved, with pleated masking and a black frame ---------- */
  const sag = scr.w * 0.025;
  const sgeo = new THREE.PlaneGeometry(scr.w, scr.h, 48, 1);
  const pos = sgeo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i) / (scr.w / 2); pos.setZ(i, -sag * (1 - x * x)); }
  sgeo.computeVertexNormals();
  const screenMesh = mesh(sgeo, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), 0, scr.cy, 0);
  box(scr.w + 0.6, scr.h + 0.6, 0.25, M.frame, 0, scr.cy, -sag - 0.2);
  const curtainW = Math.max(1.5, (hall.hallW - scr.w) / 2 - 0.3);
  for (const sx of [-1, 1]) mesh(new THREE.PlaneGeometry(curtainW, hall.hallH), M.curtain, sx * (scr.w / 2 + 0.3 + curtainW / 2), hall.hallH / 2, -0.3);
  mesh(new THREE.PlaneGeometry(scr.w + 1, (hall.hallH - scr.top) * 0.9), M.curtain, 0, (hall.hallH + scr.top) / 2, -0.3);
  box(hall.hallW, scr.bottom + 0.2, 0.3, M.frame, 0, (scr.bottom - 0.2) / 2, -0.3);

  /* screen light: a wide spot that washes the audience and casts head shadows */
  const glow = new THREE.SpotLight(0xbfd8ff, 140, backZ * 2.2, Math.PI / 2.4, 0.8, 1.1);
  glow.position.set(0, scr.cy, 0.3); glow.target.position.set(0, 2, backZ * 0.7);
  glow.castShadow = true; glow.shadow.mapSize.set(2048, 2048); glow.shadow.bias = -0.0004; glow.shadow.camera.near = 1; glow.shadow.camera.far = backZ * 2;
  world.add(glow, glow.target);

  /* ---------- projector and its beam ---------- */
  const projY = hall.hallH - 0.9, projZ = backZ + 0.7;
  box(0.7, 0.4, 0.9, M.plastic, 0, projY, projZ);
  box(0.16, 0.16, 0.05, M.led, 0, projY, projZ - 0.47);
  const beamLen = Math.hypot(projZ, projY - scr.cy);
  const coneGeo = new THREE.ConeGeometry((scr.w / 2) / 0.707, beamLen, 4, 1, true).rotateY(Math.PI / 4).translate(0, -beamLen / 2, 0);
  const beam = new THREE.Mesh(coneGeo, M.beam); beam.rotation.x = -Math.PI / 2; beam.scale.z = scr.h / scr.w;   // apex at the projector, pointing down local +z
  const beamGroup = new THREE.Group(); beamGroup.position.set(0, projY, projZ); beamGroup.lookAt(0, scr.cy, 0); beamGroup.add(beam); world.add(beamGroup);
  const dustN = 220, dustPos = new Float32Array(dustN * 3);
  for (let i = 0; i < dustN; i++) {
    const t = Math.random(); const spread = t * scr.w * 0.45;
    dustPos[i * 3] = (Math.random() - 0.5) * 2 * spread; dustPos[i * 3 + 1] = projY + (scr.cy - projY) * t + (Math.random() - 0.5) * spread * scr.h / scr.w; dustPos[i * 3 + 2] = projZ * (1 - t);
  }
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, M.dust); world.add(dust);

  /* ---------- seats ---------- */
  const geoCache = {};
  const seatTemplate = cat => {
    if (geoCache[cat]) return geoCache[cat];
    const c = CATEGORIES[cat], w = c.pitch - 0.05, d = c.depth, rec = cat === 'recliner';
    const soft = rec ? M.leather : cat === 'prime' ? M.fabricPrime : M.fabric;
    const g = new THREE.Group();
    const part = (geo, m, x, y, z, rx = 0, name = '') => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.x = rx; o.name = name; o.castShadow = o.receiveShadow = true; g.add(o); return o; };
    part(new RoundedBoxGeometry(w - 0.1, 0.16, d - 0.08, 4, 0.05), soft, 0, 0.46, -0.02, -0.08, 'cushion');           // seat cushion
    part(new RoundedBoxGeometry(w - 0.1, rec ? 0.78 : 0.62, 0.13, 4, 0.05), soft, 0, 0.46 + (rec ? 0.42 : 0.34), d / 2 - 0.08, 0.2, 'back'); // backrest, reclined
    if (rec) part(new RoundedBoxGeometry(w - 0.18, 0.18, 0.1, 3, 0.04), soft, 0, 1.22, d / 2 - 0.02, 0.2, 'headrest');
    if (rec) part(new RoundedBoxGeometry(w - 0.14, 0.1, 0.4, 3, 0.03), soft, 0, 0.36, -d / 2 - 0.1, 0.3, 'footrest');
    for (const sx of [-1, 1]) {
      part(new THREE.BoxGeometry(0.06, 0.24, d * 0.78), M.plastic, sx * (w / 2 - 0.03), 0.58, 0, 0, 'arm');
      part(new THREE.TorusGeometry(0.035, 0.008, 6, 14), M.steel, sx * (w / 2 - 0.03), 0.705, -d * 0.3, Math.PI / 2, 'cup');
    }
    part(new THREE.BoxGeometry(w - 0.2, 0.38, 0.12, 1, 1, 1), M.plastic, 0, 0.19, 0.08, 0, 'pedestal');
    return (geoCache[cat] = g);
  };
  for (const s of seats) {
    const g = seatTemplate(s.cat).clone();
    g.traverse(o => { if (o.isMesh) { o.userData.seat = s; pickables.push(o); if (o.name === 'back' || o.name === 'headrest') occluders.push(o); } });
    g.position.set(s.x, s.y, s.z); world.add(g); s.mesh = g;
    s.softParts = []; g.traverse(o => { if (o.isMesh && (o.name === 'cushion' || o.name === 'back' || o.name === 'headrest')) { s.softParts.push(o); s.baseMat = o.material; } });
    if (s.sold) {
      const p = new THREE.Group(); const lean = (Math.random() - 0.5) * 0.08, tall = (Math.random() - 0.5) * 0.07;
      const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; p.add(o); occluders.push(o); return o; };
      add(new THREE.CapsuleGeometry(0.13, 0.34, 4, 10), M.person, 0, 0.84 + tall, 0.02);                          // torso
      const sh = add(new THREE.CapsuleGeometry(0.075, 0.3, 4, 10), M.person, 0, 1.0 + tall, 0.02); sh.rotation.z = Math.PI / 2; // shoulders
      add(new THREE.CylinderGeometry(0.045, 0.05, 0.08, 10), M.skin, lean, 1.1 + tall, 0.02);                       // neck
      add(new THREE.SphereGeometry(0.105, 14, 12), M.skin, lean, EYE_HEIGHT + 0.04 + tall, 0.0);                   // head
      const hair = add(new THREE.SphereGeometry(0.112, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), M.hair, lean, EYE_HEIGHT + 0.05 + tall, -0.01);
      p.position.set(s.x, s.y, s.z); p.updateMatrixWorld(true); world.add(p);
      p.traverse(o => { if (o.isMesh) { o.updateMatrixWorld(true); const wp = new THREE.Vector3(); o.getWorldPosition(wp); o.userData.worldZ = wp.z; } });
    }
  }
  /* seat-back occluders live inside groups: record world z so the app can cull by row cheaply */
  world.updateMatrixWorld(true);
  for (const o of occluders) if (o.userData.worldZ === undefined) { const wp = new THREE.Vector3(); o.getWorldPosition(wp); o.userData.worldZ = wp.z; }

  /* selection ring on the floor */
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.38, 32), M.ring); ring.rotation.x = -Math.PI / 2; ring.visible = false; world.add(ring);

  const center = new THREE.Vector3(0, 2.5, backZ * 0.5);
  const overview = new THREE.Vector3(hall.hallW * 0.75, hall.hallH * 1.7, backZ * 1.55);

  function dispose() { world.traverse(o => { o.geometry?.dispose(); }); scene.remove(world); }
  function highlight(seat, kind) {
    for (const o of seat.softParts) o.material = kind === 'selected' ? M.selected : kind === 'pinned' ? M.pinned : seat.baseMat;
    if (kind === 'selected') { ring.visible = true; ring.position.set(seat.x, seat.y + 0.02, seat.z); } else if (ring.position.x === seat.x && ring.position.z === seat.z) ring.visible = false;
  }
  function tick(t) { dust.rotation.y = 0; const a = dust.geometry.attributes.position; for (let i = 0; i < dustN; i++) a.array[i * 3 + 1] += Math.sin(t * 0.7 + i) * 0.0006; a.needsUpdate = true; }

  return { hall, scr, seats, pickables, occluders, screenMesh, glow, center, overview, backZ, dispose, highlight, tick };
}
