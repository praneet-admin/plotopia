// Pure sightline mathematics. Standards used:
//  - SMPTE EG-18 / THX: horizontal viewing angle ≥ 30° (SMPTE) / ≥ 36° (THX), ideal around 40–50°.
//  - SMPTE: vertical angle from eye to the TOP of the screen ≤ 35°.
//  - Centre of screen within ~15° of eye level avoids sustained neck extension.
import * as THREE from 'three';

export const EYE_HEIGHT = 1.15;   // seated eye height above the row floor
const deg = x => x * 180 / Math.PI;

export function eyeOf(seat) { return new THREE.Vector3(seat.x, seat.y + EYE_HEIGHT, seat.z + 0.05); }

export function geometry(seat, scr) {
  const e = eyeOf(seat);
  const v = (x, y) => new THREE.Vector3(x, y, 0).sub(e);
  const hfov = deg(v(-scr.w / 2, scr.cy).angleTo(v(scr.w / 2, scr.cy)));
  const vfov = deg(v(0, scr.top).angleTo(v(0, scr.bottom)));
  const off = deg(Math.atan2(Math.abs(e.x), e.z));
  const up = deg(Math.atan2(scr.cy - e.y, e.z));
  const upTop = deg(Math.atan2(scr.top - e.y, e.z));
  const dist = e.distanceTo(new THREE.Vector3(0, scr.cy, 0));
  return { hfov, vfov, off, up, upTop, dist, eye: e };
}

/** Fraction of the screen visible past heads, torsos and seat backs. Samples a grid of points. */
export function visibility(seat, scr, occluders, raycaster, cols = 9, rows = 5) {
  const e = eyeOf(seat); let seen = 0, total = 0; const dir = new THREE.Vector3(); const blockedCells = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const p = new THREE.Vector3(-scr.w / 2 + scr.w * (i + 0.5) / cols, scr.bottom + scr.h * (j + 0.5) / rows, 0);
    dir.subVectors(p, e); const len = dir.length(); dir.normalize();
    raycaster.set(e, dir); raycaster.far = len - 0.05;
    total++;
    if (raycaster.intersectObjects(occluders, false).length === 0) seen++; else blockedCells.push([i, j]);
  }
  return { visible: seen / total, blockedCells, cols, rows };
}

export function score(g, vis) {
  let s = 100;
  if (g.hfov > 58) s -= (g.hfov - 58) * 1.4;      // too close: eyes pan across the frame
  if (g.hfov < 34) s -= (34 - g.hfov) * 3;        // too far: below SMPTE/THX minimum
  s -= Math.max(0, g.off - 12) * 1.6;             // off-axis keystone
  s -= Math.max(0, g.up - 8) * 2.2;               // neck extension
  s -= Math.max(0, g.upTop - 35) * 1.5;           // top of screen above SMPTE limit
  s -= (1 - vis) * 160;                           // heads in the way hurt most
  return Math.round(Math.max(3, Math.min(100, s)));
}

export function verdict(g, vis, s) {
  const parts = [];
  parts.push(g.hfov > 58 ? 'very close, you will be panning your eyes' : g.hfov < 34 ? 'far back, the picture looks small' : 'great picture size, right in the sweet spot');
  if (g.off > 25) parts.push('strong side angle'); else if (g.off > 12) parts.push('slightly off-centre');
  if (g.up > 18) parts.push('you will be craning your neck'); else if (g.up > 8) parts.push('mild look-up');
  if (vis < 0.9) parts.push(`${Math.round((1 - vis) * 100)}% of the screen is hidden behind heads`);
  const label = s >= 80 ? 'Excellent' : s >= 60 ? 'Good' : s >= 40 ? 'Okay' : 'Poor';
  return { label, text: parts.join(' · ') };
}

export function scoreColor(s) {            // red → amber → green
  const t = Math.max(0, Math.min(1, (s - 20) / 70));
  const h = t * 120; return `hsl(${h} 80% 55%)`;
}
