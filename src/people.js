// Seated audience meshes baked from Quaternius's CC0 Universal Base Characters + Universal Animation Library
// (see assets/people/CREDITS.md). Loads one quantised binary and hands out per-zone geometries.
import * as THREE from 'three';

export async function loadPeople(set = 'hi') {
  const base = `assets/people/people-${set}`;
  const [manifest, bin] = await Promise.all([fetch(`${base}.json`).then(r => r.json()), fetch(`${base}.bin`).then(r => r.arrayBuffer())]);
  const cache = new Map();
  const bodies = manifest.variants.filter(v => v.kind === 'body');
  const hairs = manifest.variants.filter(v => v.kind === 'hair');
  function raw(v) {
    const pos = new Int16Array(bin, v.pos, v.vcount * 3), zone = new Uint8Array(bin, v.zone, v.vcount), idx = new Uint32Array(bin, v.idx, v.icount);
    return { pos, zone, idx };
  }
  /** Geometry of one variant restricted to one zone (0 cloth, 1 skin, 2 trousers, 3 hair). Triangles follow their majority zone. */
  function geometryFor(v, zoneId) {
    const key = v.name + ':' + zoneId; if (cache.has(key)) return cache.get(key);
    const { pos, zone, idx } = raw(v);
    const tris = []; for (let i = 0; i < idx.length; i += 3) { const a = idx[i], b = idx[i + 1], c = idx[i + 2]; const n = (zone[a] === zoneId) + (zone[b] === zoneId) + (zone[c] === zoneId); if (n >= 2) tris.push(a, b, c); }
    if (!tris.length) { cache.set(key, null); return null; }
    const remap = new Map(), positions = []; const index = new Uint32Array(tris.length);
    for (let i = 0; i < tris.length; i++) { const o = tris[i]; let r = remap.get(o); if (r === undefined) { r = remap.size; remap.set(o, r); positions.push(pos[o * 3] / 1000, pos[o * 3 + 1] / 1000, pos[o * 3 + 2] / 1000); } index[i] = r; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setIndex(new THREE.BufferAttribute(index, 1)); g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(positions.length / 3 * 2), 2)); g.computeVertexNormals();   // uv so it merges with the other geometry
    cache.set(key, g); return g;
  }
  return { bodies, hairs, geometryFor, hairsFor: body => hairs.filter(h => h.body === body.name) };
}
