// find moments in the sitting clips where the hands sit lowest (resting in the lap)
import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import * as THREE from 'three'; import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
globalThis.self ??= globalThis;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(process.argv[2]); const glb = await io.writeBinary(doc);
const g = await new Promise((res, rej) => new GLTFLoader().parse(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength), '', res, rej));
for (const name of ['Sitting_Idle_Loop', 'Sitting_Talking_Loop']) {
  const clip = g.animations.find(c => c.name === name); const mixer = new THREE.AnimationMixer(g.scene); mixer.clipAction(clip).play();
  const out = [];
  for (let t = 0; t < clip.duration; t += 0.1) { mixer.setTime(t); g.scene.updateMatrixWorld(true); const h = ['hand_l', 'hand_r'].map(n => g.scene.getObjectByName(n).getWorldPosition(new THREE.Vector3())); const pel = g.scene.getObjectByName('pelvis').getWorldPosition(new THREE.Vector3()); out.push([t.toFixed(1), ((h[0].y + h[1].y) / 2 - pel.y).toFixed(3), (Math.abs(h[0].x - h[1].x)).toFixed(2)]); }
  out.sort((a, b) => a[1] - b[1]); console.log(name, 'duration', clip.duration.toFixed(2), 'lowest hands (t, handY-pelvisY, spread):', out.slice(0, 6).map(o => o.join('/')).join('  '));
}
