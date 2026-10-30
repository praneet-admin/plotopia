// Builds the 3D hall for a hall definition. Returns everything the app needs to pick, measure and render.
import * as THREE from 'three';
import { CATEGORIES, layoutSeats, screenOf } from './halls.js';
import { EYE_HEIGHT } from './metrics.js';

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.92, ...extra });
const M = {
  wall: mat(0x3b1f22), shell: mat(0x2e1a1d, { side: THREE.BackSide }), floor: mat(0x2a1f1f), carpet: mat(0x4a2a2e, { roughness: 1 }), step: mat(0x1d1a1a),
  frame: mat(0x080808, { roughness: 0.6 }), curtain: mat(0x5a1b24, { roughness: 1 }),
  led: new THREE.MeshBasicMaterial({ color: 0x3fb4ff }), exit: new THREE.MeshBasicMaterial({ color: 0x2cff8a }),
  person: mat(0x1f2128), head: mat(0x2a2520), speaker: mat(0x111111, { roughness: 0.4 }),
  selected: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffc24d, emissiveIntensity: 0.9, roughness: 0.5 }),
  pinned: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x5ec8ff, emissiveIntensity: 0.9, roughness: 0.5 }),
};

export function buildHall(hall, scene) {
  const world = new THREE.Group(); scene.add(world);
  const scr = screenOf(hall);
  const seats = layoutSeats(hall);
  const pickables = [], occluders = [];
  const add = (geo, m, x, y, z, shadow) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); if (shadow) { o.castShadow = o.receiveShadow = true; } world.add(o); return o; };
  const box = (w, h, d, m, x, y, z, shadow = false) => add(new THREE.BoxGeometry(w, h, d), m, x, y, z, shadow);

  /* shell */
  const rows = hall.rows.length, backZ = hall.firstRowZ + rows * hall.rowPitch + 1.5, len = backZ + 2;
  box(hall.hallW, 0.2, len, M.floor, 0, -0.1, backZ / 2 - 1).receiveShadow = true;
  // One inward-facing box: from inside it is the walls and ceiling, from outside it is invisible, so the
  // overview camera can orbit freely without walls blocking the view.
  const shell = new THREE.Mesh(new THREE.BoxGeometry(hall.hallW, hall.hallH + 0.2, len), M.shell);
  shell.position.set(0, hall.hallH / 2 - 0.1, backZ / 2 - 1); shell.receiveShadow = true; world.add(shell);
  /* screen masking, curtains, speakers, exit signs */
  box(scr.w + 1.2, scr.h + 1.2, 0.3, M.frame, 0, scr.cy, -0.2);
  box(1.8, hall.hallH, 0.5, M.curtain, -scr.w / 2 - 1.5, hall.hallH / 2, -0.3);
  box(1.8, hall.hallH, 0.5, M.curtain, scr.w / 2 + 1.5, hall.hallH / 2, -0.3);
  for (const sx of [-1, 1]) {
    box(0.6, 0.25, 0.05, M.exit, sx * (hall.hallW / 2 - 1.2), 2.6, -0.95);
    for (let i = 0; i < 4; i++) box(0.3, 0.5, 0.3, M.speaker, sx * (hall.hallW / 2 - 0.3), 2.5, 4 + i * (backZ / 5));
  }
  /* stadium steps, carpet, step-nose LEDs */
  seats.filter(s => s.num === 1).forEach(s => {
    const h = Math.max(s.y, 0.02);
    box(hall.hallW - 0.4, h, hall.rowPitch, M.step, 0, h / 2, s.z).receiveShadow = true;
    box(hall.aisle, 0.01, hall.rowPitch, M.carpet, 0, h + 0.005, s.z);
    box(hall.aisle - 0.1, 0.02, 0.03, M.led, 0, h + 0.01, s.z - hall.rowPitch / 2 + 0.05);
  });
  box(hall.hallW - 0.4, 0.02, hall.firstRowZ - 1, M.carpet, 0, 0.01, (hall.firstRowZ - 1) / 2 + 0.5);

  /* screen */
  const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(scr.w, scr.h), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
  screenMesh.position.set(0, scr.cy, 0); world.add(screenMesh);

  /* screen light: a wide spot from the screen washes the audience and casts head shadows */
  const glow = new THREE.SpotLight(0xbfd8ff, 110, backZ * 2.2, Math.PI / 2.4, 0.7, 1.1);
  glow.position.set(0, scr.cy, 0.3); glow.target.position.set(0, 2, backZ * 0.7);
  glow.castShadow = true; glow.shadow.mapSize.set(2048, 2048); glow.shadow.bias = -0.0005; glow.shadow.camera.near = 1; glow.shadow.camera.far = backZ * 2;
  world.add(glow, glow.target);
  const wash = new THREE.PointLight(0xffd9a0, 30, backZ, 1.5); wash.position.set(0, hall.hallH - 1, backZ * 0.8); world.add(wash);

  /* seats */
  const geoCache = {};
  const seatGroupFor = cat => {
    if (geoCache[cat]) return geoCache[cat];
    const c = CATEGORIES[cat], w = c.pitch - 0.06, d = c.depth;
    const g = new THREE.Group();
    const part = (gw, gh, gd, x, y, z, name) => { const m = new THREE.Mesh(new THREE.BoxGeometry(gw, gh, gd)); m.position.set(x, y, z); m.name = name; m.castShadow = m.receiveShadow = true; g.add(m); };
    part(w, 0.14, d, 0, 0.44, 0, 'base');
    part(w, c.backH, 0.12, 0, 0.44 + c.backH / 2 + 0.07, d / 2 - 0.02, 'back');
    part(0.05, 0.1, d * 0.8, -w / 2 + 0.02, 0.6, 0.02, 'arm'); part(0.05, 0.1, d * 0.8, w / 2 - 0.02, 0.6, 0.02, 'arm');
    part(w * 0.8, 0.4, 0.1, 0, 0.2, 0.05, 'legs');
    return (geoCache[cat] = g);
  };
  const seatMats = {};
  for (const s of seats) {
    const key = s.cat + (s.sold ? '-sold' : '');
    seatMats[key] ??= mat(s.sold ? 0x3a3038 : CATEGORIES[s.cat].color, { roughness: 0.8 });
    const g = seatGroupFor(s.cat).clone();
    g.traverse(o => { if (o.isMesh) { o.material = seatMats[key]; o.userData.seat = s; pickables.push(o); if (o.name === 'back') occluders.push(o); } });
    g.position.set(s.x, s.y, s.z); world.add(g); s.mesh = g; s.baseMat = seatMats[key];
    if (s.sold) {
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.55, 0.26), M.person); torso.position.set(s.x, s.y + 0.78, s.z - 0.02);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), M.head); head.position.set(s.x, s.y + EYE_HEIGHT + 0.02, s.z - 0.02);
      torso.castShadow = head.castShadow = true; world.add(torso, head); occluders.push(torso, head);
    }
  }
  const center = new THREE.Vector3(0, 2.5, backZ * 0.5);
  const overview = new THREE.Vector3(hall.hallW * 0.75, hall.hallH * 1.7, backZ * 1.55);

  function dispose() { world.traverse(o => { o.geometry?.dispose(); if (o.material && !Object.values(M).includes(o.material)) o.material.dispose?.(); }); scene.remove(world); }
  function highlight(seat, kind) { seat.mesh.traverse(o => { if (o.isMesh) o.material = kind === 'selected' ? M.selected : kind === 'pinned' ? M.pinned : seat.baseMat; }); }

  return { hall, scr, seats, pickables, occluders, screenMesh, glow, center, overview, backZ, dispose, highlight };
}
