// Bake seated Quaternius characters (CC0) into compact static meshes for Plotopia.
// usage: node bake.mjs <ubcDir> <ualGlb> <outDir>
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import fs from 'node:fs'; import path from 'node:path';
import { simplify, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
const RATIO = parseFloat(process.env.RATIO || '1');
globalThis.self ??= globalThis;
const [,, UBC, UAL, OUT] = process.argv; fs.mkdirSync(OUT, { recursive: true });
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
async function loadThree(file) {   // bundle to a GLB in memory, then parse with three (no fetch, no textures)
  const doc = await io.read(file);
  if (RATIO < 1) { await MeshoptSimplifier.ready; await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: RATIO, error: 0.002, lockBorder: true })); }
  const glb = await io.writeBinary(doc);
  return await new Promise((res, rej) => new GLTFLoader().parse(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength), '', res, rej));
}
const bodies = { male: 'Superhero_Male_FullBody_notex.gltf', female: 'Superhero_Female_FullBody_notex.gltf' };
const hairs = ['Hair_Buzzed', 'Hair_BuzzedFemale', 'Hair_SimpleParted', 'Hair_Long', 'Hair_Buns', 'Hair_Beard'];
const poses = [['Sitting_Idle_Loop', 0.0], ['Sitting_Idle_Loop', 1.3], ['Sitting_Talking_Loop', 0.6]];
const anim = await loadThree(UAL); const clips = anim.animations;
const zoneOf = n => /Head|neck/.test(n) ? 1 : /hand|index|middle|pinky|ring|thumb/.test(n) ? 1 : /lowerarm/.test(n) ? 1 : /thigh|calf|foot|ball/.test(n) ? 2 : 0;   // 0 cloth, 1 skin, 2 trousers, 3 hair
const manifest = { zones: ['cloth', 'skin', 'pants', 'hair'], variants: [] }; const chunks = []; let offset = 0;
function bakeSkinned(mesh, zoneFixed) {
  mesh.updateMatrixWorld(true); const geo = mesh.geometry; const n = geo.attributes.position.count;
  const pos = new Float32Array(n * 3), zone = new Uint8Array(n), v = new THREE.Vector3();
  const names = mesh.skeleton.bones.map(b => b.name); const si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight;
  for (let i = 0; i < n; i++) {
    mesh.getVertexPosition(i, v); v.applyMatrix4(mesh.matrixWorld); pos.set([v.x, v.y, v.z], i * 3);
    if (zoneFixed != null) zone[i] = zoneFixed; else { let best = 0, bw = -1; for (let k = 0; k < 4; k++) { const w = sw.array[i * sw.itemSize + k]; if (w > bw) { bw = w; best = si.array[i * si.itemSize + k]; } } zone[i] = zoneOf(names[best] || ''); }
  }
  const idx = geo.index ? Array.from(geo.index.array) : [...Array(n).keys()];
  return { pos, zone, idx };
}
function pack(parts) {   // merge parts, quantise positions to mm, Uint16 indices
  let vcount = 0, icount = 0; for (const p of parts) { vcount += p.pos.length / 3; icount += p.idx.length; }
  const pos = new Int16Array(vcount * 3), zone = new Uint8Array(vcount), idx = new Uint32Array(icount); let vo = 0, io2 = 0;
  for (const p of parts) { for (let i = 0; i < p.pos.length; i++) pos[vo * 3 + i] = Math.round(p.pos[i] * 1000); zone.set(p.zone, vo); for (let i = 0; i < p.idx.length; i++) idx[io2 + i] = p.idx[i] + vo; vo += p.pos.length / 3; io2 += p.idx.length; }
  return { pos, zone, idx, vcount, icount };
}
function emit(name, packed, meta) {
  const entry = { name, ...meta, vcount: packed.vcount, icount: packed.icount };
  const add = (field, buf) => { while (offset % 4) { chunks.push(Buffer.alloc(1)); offset++; } entry[field] = offset; chunks.push(buf); offset += buf.length; };
  add('pos', Buffer.from(packed.pos.buffer)); add('zone', Buffer.from(packed.zone.buffer)); add('idx', Buffer.from(packed.idx.buffer));
  manifest.variants.push(entry);
}
for (const [sex, file] of Object.entries(bodies)) {
  for (const [clipName, t] of poses) {
    const g = await loadThree(path.join(UBC, 'Base Characters', 'Godot - UE', file)); const root = g.scene;
    const clip = clips.find(c => c.name === clipName); const mixer = new THREE.AnimationMixer(root); const a = mixer.clipAction(clip); a.play(); mixer.setTime(t); root.updateMatrixWorld(true);
    const skinned = []; root.traverse(o => { if (o.isSkinnedMesh) skinned.push(o); });
    const body = skinned.filter(m => !/Eye|Face\.001|Eyebrow/.test(m.name) || m.geometry.attributes.position.count > 5000);
    const parts = body.map(m => bakeSkinned(m, null));
    // facing: knees (calf joints) relative to pelvis in XZ tell us which way the person faces
    const bone = n => root.getObjectByName(n); const pel = bone('pelvis').getWorldPosition(new THREE.Vector3()), calf = bone('calf_l').getWorldPosition(new THREE.Vector3()).add(bone('calf_r').getWorldPosition(new THREE.Vector3())).multiplyScalar(0.5);
    const fwd = new THREE.Vector2(calf.x - pel.x, calf.z - pel.z).normalize(); const yaw = Math.atan2(fwd.x, fwd.y);   // rotate so forward becomes -z
    const headY = bone('Head').getWorldPosition(new THREE.Vector3()).y;
    let minY = Infinity; for (const p of parts) for (let i = 0; i < p.pos.length; i += 3) if (p.zone[i / 3] === 2 || true) minY = Math.min(minY, p.pos[i + 1]);
    // seat height: lowest point of the pelvis/thigh zone (what touches the cushion)
    let seatY = Infinity; for (const p of parts) for (let i = 0; i < p.pos.length; i += 3) if (p.zone[i / 3] !== 1 && Math.hypot(p.pos[i] - pel.x, p.pos[i + 2] - pel.z) < 0.25 && p.pos[i + 1] < pel.y) seatY = Math.min(seatY, p.pos[i + 1]);
    const packed = pack(parts); emit(`${sex}_${clipName}_${t}`, packed, { kind: 'body', sex, yaw, seatY, headY, pelvis: [pel.x, pel.y, pel.z] });
    for (const h of hairs) {
      const hg = await loadThree(path.join(UBC, 'Hairstyles', 'Rigged to Head Bone', 'glTF (Godot -Unreal)', `${h}_notex.gltf`));
      const hr = hg.scene; const hm = new THREE.AnimationMixer(hr); hm.clipAction(clip).play(); hm.setTime(t); hr.updateMatrixWorld(true);
      const hs = []; hr.traverse(o => { if (o.isSkinnedMesh) hs.push(o); });
      const hp = pack(hs.map(m => bakeSkinned(m, 3))); emit(`${sex}_${clipName}_${t}_${h}`, hp, { kind: 'hair', sex, hair: h, body: `${sex}_${clipName}_${t}` });
    }
    console.log(sex, clipName, t, 'verts', packed.vcount, 'tris', packed.icount / 3, 'yaw', yaw.toFixed(2), 'seatY', seatY.toFixed(3), 'headY', headY.toFixed(3));
  }
}
fs.writeFileSync(path.join(OUT, 'people.bin'), Buffer.concat(chunks)); fs.writeFileSync(path.join(OUT, 'people.json'), JSON.stringify(manifest));
console.log('wrote', (fs.statSync(path.join(OUT, 'people.bin')).size / 1048576).toFixed(2), 'MB,', manifest.variants.length, 'variants');
