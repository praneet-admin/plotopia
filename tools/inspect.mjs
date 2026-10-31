import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const f of process.argv.slice(2)) {
  const doc = await io.read(f); const r = doc.getRoot();
  console.log('\n==', f.split('/').slice(-2).join('/'));
  console.log(' meshes:', r.listMeshes().map(m => `${m.getName()}(${m.listPrimitives().map(p => p.getAttribute('POSITION').getCount()).join('+')} verts, skinned=${m.listPrimitives().some(p=>!!p.getAttribute('JOINTS_0'))})`).join(', '));
  console.log(' materials:', r.listMaterials().map(m => m.getName()).join(', '));
  console.log(' textures:', r.listTextures().length, ' skins:', r.listSkins().length, ' joints:', r.listSkins()[0]?.listJoints().length);
  console.log(' joint names:', (r.listSkins()[0]?.listJoints() || []).map(j => j.getName()).slice(0, 80).join(' '));
  console.log(' animations:', r.listAnimations().map(a => a.getName()).join(', '));
}
