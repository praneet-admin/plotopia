// Show: controller. Owns the renderer, modes (hall / seat / compare), the seat map, media, gyro and share links.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { HALLS, CATEGORIES } from './halls.js';
import { buildHall } from './scene.js';
import { geometry, visibility, score, verdict, scoreColor, eyeOf } from './metrics.js';
import { ScreenMedia } from './media.js';

const $ = id => document.getElementById(id);
const stage = $('stage');

/* ---------------- renderer, scene, cameras ---------------- */
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setScissorTest(false);
stage.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05060a);
scene.add(new THREE.HemisphereLight(0x8aa0c8, 0x201a1a, 0.9), new THREE.AmbientLight(0x404050, 0.6));

const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 160);
const camB = new THREE.PerspectiveCamera(62, 1, 0.05, 160);   // right half in compare mode
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.49; controls.minDistance = 3; controls.maxDistance = 70;

const media = new ScreenMedia();
media.onchange = t => { if (state.view) { state.view.screenMesh.material.map = t; state.view.screenMesh.material.needsUpdate = true; } };

/* ---------------- state ---------------- */
const state = { hallId: 'audi3', view: null, selected: null, pinned: null, mode: 'hall', heat: false, gyro: false, scores: new Map(), flying: null };
const look = { yaw: 0, pitch: 0 }, lookB = { yaw: 0, pitch: 0 };
const base = { A: new THREE.Euler(0, 0, 0, 'YXZ'), B: new THREE.Euler(0, 0, 0, 'YXZ') };
const ray = new THREE.Raycaster();

/* ---------------- hall loading ---------------- */
function loadHall(id, { keepUrl = false } = {}) {
  state.view?.dispose(); state.selected = state.pinned = null; state.scores.clear();
  state.hallId = id;
  const view = buildHall(HALLS[id], scene); state.view = view;
  view.screenMesh.material.map = media.texture; view.screenMesh.material.needsUpdate = true;
  scene.fog = new THREE.Fog(0x05060a, view.backZ * 2.5, view.backZ * 6);
  controls.target.copy(view.center); camera.position.copy(view.overview);
  buildSeatMap(view); buildLegend();
  $('modeSeat').disabled = $('modeCompare').disabled = $('viewBtn').disabled = $('bookBtn').disabled = $('pinBtn').disabled = true;
  $('details').hidden = true; $('empty').hidden = false; $('hudSeat').textContent = 'Pick a seat to preview the screen from it';
  if (state.mode !== 'hall') enterHallView(true);
  scoreAllSeats(view).then(() => { if (state.heat) paintHeat(); });
  if (!keepUrl) writeUrl();
  $('loading').hidden = true;
}

/* Score every seat in idle chunks so the heatmap and "best available" never block the UI. */
function scoreAllSeats(view) {
  return new Promise(resolve => {
    const list = view.seats.slice(); let i = 0;
    const step = () => {
      const t0 = performance.now();
      while (i < list.length && performance.now() - t0 < 12) { const s = list[i++]; state.scores.set(s.id, evaluate(s, view, 5, 3)); }
      if (i < list.length) setTimeout(step, 0); else resolve();
    };
    step();
  });
}
function evaluate(seat, view, cols = 9, rows = 5) {
  const g = geometry(seat, view.scr);
  const occ = view.occluders.filter(o => o.position.z < seat.z - 0.3);   // only things in front can block
  const vis = visibility(seat, view.scr, occ, ray, cols, rows);
  const s = score(g, vis.visible);
  return { g, vis, score: s, verdict: verdict(g, vis.visible, s) };
}

/* ---------------- seat map (DOM) ---------------- */
function buildSeatMap(view) {
  const rowsEl = $('rows'); rowsEl.innerHTML = '';
  const byRow = new Map(); view.seats.forEach(s => (byRow.get(s.row) ?? byRow.set(s.row, []).get(s.row)).push(s));
  for (const [row, list] of byRow) {
    const div = document.createElement('div'); div.className = 'row'; div.style.setProperty('--c', CATEGORIES[list[0].cat].css);
    const lbl = document.createElement('span'); lbl.className = 'lbl'; lbl.textContent = row; div.appendChild(lbl);
    list.forEach((s, i) => {
      if (i === list.length / 2) { const a = document.createElement('span'); a.className = 'aisle'; div.appendChild(a); }
      const b = document.createElement('button'); b.className = 'seat' + (s.sold ? ' sold' : ''); b.textContent = s.num; b.title = `${s.id} · ${CATEGORIES[s.cat].name}`;
      b.disabled = s.sold; b.addEventListener('click', () => selectSeat(s)); s.btn = b; div.appendChild(b);
    });
    div.appendChild(lbl.cloneNode(true)); rowsEl.appendChild(div);
  }
}
function buildLegend() {
  $('legend').innerHTML = Object.values(CATEGORIES).map(c => `<span style="--c:${c.css}"><i></i>${c.name} ₹${c.price}</span>`).join('') +
    `<span style="--c:#888"><i class="s"></i>Sold</span><span style="--c:#fff"><i class="f"></i>Selected</span>`;
}
function paintHeat() {
  $('rows').classList.toggle('heat', state.heat); $('heatBtn').classList.toggle('on', state.heat);
  state.view.seats.forEach(s => { const r = state.scores.get(s.id); if (r && s.btn) s.btn.style.setProperty('--h', scoreColor(r.score)); });
}

/* ---------------- selection & details ---------------- */
function selectSeat(s, opts = {}) {
  if (s.sold) return;
  const view = state.view;
  if (state.selected && state.selected !== state.pinned) { state.selected.btn.classList.remove('sel'); view.highlight(state.selected, null); state.selected.mesh.visible = true; }
  state.selected = s; s.btn.classList.add('sel'); view.highlight(s, 'selected');
  s.btn.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  const r = evaluate(s, view); state.scores.set(s.id, r);
  const c = CATEGORIES[s.cat], g = r.g, vis = r.vis.visible;
  $('empty').hidden = true; $('details').hidden = false;
  $('cTitle').textContent = `Row ${s.row} · Seat ${s.num}`;
  $('cSub').textContent = `${c.name} · ₹${c.price} · ${HALLS[state.hallId].name}`;
  $('cScore').textContent = r.score; $('cScore').style.borderColor = scoreColor(r.score);
  $('cVerdict').innerHTML = `<b>${r.verdict.label} seat.</b> ${r.verdict.text}.`;
  $('mDist').innerHTML = `${g.dist.toFixed(1)} m`;
  $('mFov').innerHTML = `${g.hfov.toFixed(0)}°<small>${g.hfov >= 34 && g.hfov <= 58 ? 'ideal 34–58°' : g.hfov > 58 ? 'too wide' : 'too narrow'}</small>`;
  $('mOff').innerHTML = `${g.off.toFixed(0)}°<small>${g.off <= 12 ? 'centred' : g.off <= 25 ? 'mild' : 'strong'}</small>`;
  $('mUp').innerHTML = `${g.up.toFixed(0)}°<small>top edge ${g.upTop.toFixed(0)}°</small>`;
  $('mVis').innerHTML = `${Math.round(vis * 100)}%<small>${vis >= 0.97 ? 'clear' : vis >= 0.9 ? 'a head or two' : 'blocked'}</small>`;
  const nb = view.seats.filter(o => o.r === s.r && o !== s && Math.abs(o.x - s.x) < CATEGORIES[s.cat].pitch * 1.1);
  $('mNb').innerHTML = `${nb.filter(o => o.sold).length}/${nb.length}<small>taken next to you</small>`;
  $('viewBtn').disabled = $('bookBtn').disabled = $('modeSeat').disabled = $('pinBtn').disabled = false;
  $('modeCompare').disabled = !state.pinned || state.pinned === s;
  $('hudSeat').innerHTML = `Row <b>${s.row}</b> · Seat <b>${s.num}</b> · ${c.name} · score <b>${r.score}</b>`;
  if (state.mode === 'seat' || opts.fly) enterSeatView();
  else if (state.mode === 'compare') enterCompare();
  writeUrl();
}

/* ---------------- camera moves ---------------- */
const ease = t => t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
function flyTo(cam, pos, quat, dur, after) { state.flying = { cam, p0: cam.position.clone(), q0: cam.quaternion.clone(), p1: pos, q1: quat, t0: performance.now(), dur, after }; }
function seatPose(s) {
  const eye = eyeOf(s); const tmp = new THREE.PerspectiveCamera(); tmp.position.copy(eye); tmp.lookAt(0, state.view.scr.cy, 0);   // a camera looks down -z, a plain Object3D looks down +z
  return { eye, quat: tmp.quaternion.clone() };
}
function setMode(m) {
  state.mode = m;
  for (const [id, mm] of [['modeHall', 'hall'], ['modeSeat', 'seat'], ['modeCompare', 'compare']]) $(id).classList.toggle('active', mm === m);
  $('back').hidden = m === 'hall'; $('splitLabels').hidden = m !== 'compare'; $('hudSeat').hidden = m === 'compare' && portrait();
  $('viewBtn').textContent = m === 'hall' ? 'View from seat' : 'Back to hall';
  $('gyroBtn').hidden = !(m !== 'hall' && 'DeviceOrientationEvent' in window && matchMedia('(pointer:coarse)').matches);
  $('hint').textContent = m === 'hall' ? 'Drag to orbit · scroll to zoom · click a seat in 3D or on the map' : 'Drag to look around · arrow keys hop between seats';
  controls.enabled = m === 'hall';
  writeUrl();
}
function enterSeatView() {
  if (!state.selected) return;
  setMode('seat'); look.yaw = look.pitch = 0;
  state.view.seats.forEach(s => s.mesh.visible = true); state.selected.mesh.visible = false;
  const { eye, quat } = seatPose(state.selected);
  camera.fov = 62; camera.updateProjectionMatrix();
  flyTo(camera, eye, quat, 1100, () => base.A.setFromQuaternion(quat, 'YXZ'));
}
function enterHallView(instant = false) {
  setMode('hall');
  state.view.seats.forEach(s => s.mesh.visible = true);
  const tmp = new THREE.PerspectiveCamera(); tmp.position.copy(state.view.overview); tmp.lookAt(state.view.center);
  camera.fov = 55; camera.updateProjectionMatrix();
  if (instant) { camera.position.copy(state.view.overview); camera.quaternion.copy(tmp.quaternion); controls.update(); }
  else flyTo(camera, state.view.overview.clone(), tmp.quaternion.clone(), 900, () => controls.update());
}
function enterCompare() {
  if (!state.pinned || !state.selected || state.pinned === state.selected) return;
  setMode('compare'); look.yaw = look.pitch = lookB.yaw = lookB.pitch = 0;
  state.view.seats.forEach(s => s.mesh.visible = true); state.pinned.mesh.visible = state.selected.mesh.visible = false;
  const A = seatPose(state.pinned), B = seatPose(state.selected);
  camera.fov = 62; camera.updateProjectionMatrix();
  camera.position.copy(A.eye); camera.quaternion.copy(A.quat); base.A.setFromQuaternion(A.quat, 'YXZ');
  camB.position.copy(B.eye); camB.quaternion.copy(B.quat); base.B.setFromQuaternion(B.quat, 'YXZ');
  const lab = (s, pin) => { const r = state.scores.get(s.id); return `${pin ? '📌 ' : ''}Row ${s.row} · Seat ${s.num} · ${CATEGORIES[s.cat].name} · score ${r?.score ?? '…'}`; };
  $('labA').textContent = lab(state.pinned, true); $('labB').textContent = lab(state.selected, false);
}

/* ---------------- toolbar ---------------- */
$('viewBtn').onclick = () => state.mode === 'hall' ? enterSeatView() : enterHallView();
$('back').onclick = () => enterHallView(); $('modeHall').onclick = () => enterHallView();
$('modeSeat').onclick = enterSeatView; $('modeCompare').onclick = enterCompare;
$('heatBtn').onclick = () => { state.heat = !state.heat; paintHeat(); };
$('pinBtn').onclick = () => {
  if (!state.selected) return;
  if (state.pinned) { state.pinned.btn.classList.remove('pin'); if (state.pinned !== state.selected) state.view.highlight(state.pinned, null); }
  state.pinned = state.selected; state.pinned.btn.classList.add('pin'); state.view.highlight(state.pinned, 'pinned');
  $('pinBtn').classList.add('on'); toast(`Pinned ${state.pinned.id}. Now pick another seat and hit Compare.`);
  $('modeCompare').disabled = true;
};
$('bestBtn').onclick = () => {
  const ranked = state.view.seats.filter(s => !s.sold).map(s => ({ s, r: state.scores.get(s.id) ?? evaluate(s, state.view, 5, 3) })).sort((a, b) => b.r.score - a.r.score);
  document.querySelectorAll('.seat.best').forEach(b => b.classList.remove('best'));
  ranked.slice(0, 6).forEach(x => x.s.btn.classList.add('best'));
  selectSeat(ranked[0].s);
};
$('bookBtn').onclick = () => { const s = state.selected; toast(`Booked ${s.id} · ${CATEGORIES[s.cat].name} · ₹${CATEGORIES[s.cat].price} (demo)`); };
$('shareBtn').onclick = async () => { writeUrl(); try { await navigator.clipboard.writeText(location.href); toast('Link copied'); } catch { toast(location.href); } };
$('mediaInput').onchange = e => { const f = e.target.files[0]; if (f) media.load(f).then(() => toast(`Screening ${f.name}`)); };
stage.addEventListener('dragover', e => e.preventDefault());
stage.addEventListener('drop', e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) media.load(f).then(() => toast(`Screening ${f.name}`)); });
Object.values(HALLS).forEach(h => { const o = document.createElement('option'); o.value = h.id; o.textContent = `${h.venue} · ${h.name}`; $('hallSelect').appendChild(o); });
$('hallSelect').onchange = e => loadHall(e.target.value);

let toastTimer; function toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => t.hidden = true, 2600); }

/* ---------------- gyro (phones) ---------------- */
let gyroRef = null;
function onOrient(e) {
  if (e.alpha == null) return;
  gyroRef ??= { a: e.alpha, b: e.beta };
  const dy = THREE.MathUtils.degToRad(((e.alpha - gyroRef.a + 540) % 360) - 180);
  const dp = THREE.MathUtils.degToRad(e.beta - gyroRef.b);
  look.yaw = THREE.MathUtils.clamp(-dy, -1.2, 1.2); look.pitch = THREE.MathUtils.clamp(-dp, -0.7, 0.7);
  lookB.yaw = look.yaw; lookB.pitch = look.pitch;
}
$('gyroBtn').onclick = async () => {
  if (state.gyro) { removeEventListener('deviceorientation', onOrient); state.gyro = false; $('gyroBtn').classList.remove('on'); return; }
  try { if (typeof DeviceOrientationEvent.requestPermission === 'function') { if (await DeviceOrientationEvent.requestPermission() !== 'granted') return toast('Motion permission denied'); } }
  catch { return toast('Motion permission denied'); }
  gyroRef = null; addEventListener('deviceorientation', onOrient); state.gyro = true; $('gyroBtn').classList.add('on'); toast('Move your phone to look around');
};

/* ---------------- pointer: pick in hall, look in seat/compare ---------------- */
const ptr = new THREE.Vector2(); let down = null, drag = null;
renderer.domElement.addEventListener('pointerdown', e => {
  down = { x: e.clientX, y: e.clientY };
  if (state.mode !== 'hall') {
    const r = renderer.domElement.getBoundingClientRect(); const second = portrait() ? e.clientY - r.top > r.height / 2 : e.clientX - r.left > r.width / 2; const half = state.mode === 'compare' && second ? lookB : look;
    drag = { x: e.clientX, y: e.clientY, yaw: half.yaw, pitch: half.pitch, half }; renderer.domElement.setPointerCapture(e.pointerId);
  }
});
renderer.domElement.addEventListener('pointermove', e => {
  if (!drag || state.flying) return;
  drag.half.yaw = THREE.MathUtils.clamp(drag.yaw + (e.clientX - drag.x) * 0.004, -1.2, 1.2);
  drag.half.pitch = THREE.MathUtils.clamp(drag.pitch + (e.clientY - drag.y) * 0.004, -0.7, 0.7);
});
renderer.domElement.addEventListener('pointerup', e => {
  drag = null;
  if (!down || state.mode !== 'hall' || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
  const r = renderer.domElement.getBoundingClientRect();
  ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ptr, camera); ray.far = Infinity;
  const hit = ray.intersectObjects(state.view.pickables, false)[0];
  if (hit) { const s = hit.object.userData.seat; s.sold ? toast(`${s.id} is already sold`) : selectSeat(s); }
});
addEventListener('keydown', e => {
  if (state.mode === 'hall' || !state.selected) return;
  const sel = state.selected, seats = state.view.seats; let cand = null;
  const nearest = list => list.sort((a, b) => Math.abs(a.x - sel.x) - Math.abs(b.x - sel.x))[0];
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { const d = e.key === 'ArrowLeft' ? -1 : 1; cand = nearest(seats.filter(s => s.r === sel.r && !s.sold && Math.sign(s.x - sel.x) === d)); }
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') cand = nearest(seats.filter(s => s.r === sel.r + (e.key === 'ArrowUp' ? 1 : -1) && !s.sold));
  if (e.key === 'Escape') enterHallView();
  if (cand) { e.preventDefault(); selectSeat(cand); }
});

/* ---------------- share links ---------------- */
function writeUrl() {
  const p = new URLSearchParams({ hall: state.hallId }); if (state.selected) p.set('seat', state.selected.id); if (state.mode !== 'hall') p.set('view', state.mode);
  if (state.pinned) p.set('pin', state.pinned.id);
  history.replaceState(null, '', '#' + p);
}
function readUrl() {
  const p = new URLSearchParams(location.hash.slice(1));
  const hall = HALLS[p.get('hall')] ? p.get('hall') : 'audi3';
  loadHall(hall, { keepUrl: true });
  const find = id => state.view.seats.find(s => s.id === id && !s.sold);
  const pin = find(p.get('pin')); if (pin) { selectSeat(pin); $('pinBtn').onclick(); }
  const seat = find(p.get('seat')); if (seat) selectSeat(seat);
  if (p.get('view') === 'seat' && seat) enterSeatView();
  if (p.get('view') === 'compare' && seat && pin) enterCompare();
}

/* ---------------- resize & loop ---------------- */
const portrait = () => stage.clientWidth < 640;   // phones: stack compare views top / bottom
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight; renderer.setSize(w, h, false);
  const half = portrait() ? w / (h / 2) : (w / 2) / h;
  camera.aspect = state.mode === 'compare' ? half : w / h; camera.updateProjectionMatrix();
  camB.aspect = half; camB.updateProjectionMatrix();
  $('splitLabels').classList.toggle('stack', portrait());
}
new ResizeObserver(resize).observe(stage);

renderer.setAnimationLoop(now => {
  media.tick(now);
  const f = state.flying;
  if (f) {
    const k = Math.min(1, (now - f.t0) / f.dur), e = ease(k);
    f.cam.position.lerpVectors(f.p0, f.p1, e); f.cam.quaternion.slerpQuaternions(f.q0, f.q1, e);
    if (k >= 1) { state.flying = null; f.after?.(); }
  } else if (state.mode === 'seat') camera.rotation.set(base.A.x - look.pitch, base.A.y - look.yaw, 0, 'YXZ');
  else if (state.mode === 'compare') { camera.rotation.set(base.A.x - look.pitch, base.A.y - look.yaw, 0, 'YXZ'); camB.rotation.set(base.B.x - lookB.pitch, base.B.y - lookB.yaw, 0, 'YXZ'); }
  else controls.update();

  const sz = renderer.getSize(new THREE.Vector2()), w = sz.x, h = sz.y;   // CSS pixels: setViewport applies the pixel ratio itself
  if (state.mode === 'compare') {
    resizeIfNeeded();
    renderer.setScissorTest(true);
    if (portrait()) {   // phones: stack the two seats top / bottom
      renderer.setViewport(0, h / 2, w, h / 2); renderer.setScissor(0, h / 2, w, h / 2); renderer.render(scene, camera);
      renderer.setViewport(0, 0, w, h / 2); renderer.setScissor(0, 0, w, h / 2); renderer.render(scene, camB);
    } else {
      renderer.setViewport(0, 0, w / 2, h); renderer.setScissor(0, 0, w / 2, h); renderer.render(scene, camera);
      renderer.setViewport(w / 2, 0, w / 2, h); renderer.setScissor(w / 2, 0, w / 2, h); renderer.render(scene, camB);
    }
    renderer.setScissorTest(false);
  } else { resizeIfNeeded(); renderer.setViewport(0, 0, w, h); renderer.render(scene, camera); }
});
let lastAspectMode = null;
function resizeIfNeeded() { if (lastAspectMode !== state.mode) { lastAspectMode = state.mode; resize(); } }

readUrl();
window.__show = { camera, camB, controls, state, scene, THREE, renderer, resize };
