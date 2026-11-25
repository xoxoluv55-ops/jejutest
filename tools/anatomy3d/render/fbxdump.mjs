// node fbxdump.mjs <in.fbx> <out_prefix>: dumps every mesh (world-space positions, indices) to <out>.json + <out>.bin
import fs from 'fs';
globalThis.self = globalThis; globalThis.window = globalThis;
globalThis.document = { createElementNS: () => ({ style: {}, addEventListener() {}, getContext: () => null }), createElement: () => ({ style: {} }) };
const THREE = await import('three');
const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
const [inp, out] = process.argv.slice(2);
const buf = fs.readFileSync(inp);
const root = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
root.updateMatrixWorld(true);
const index = []; const parts = []; let off = 0;
root.traverse(o => {
  if (!o.isMesh) return;
  const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld);
  const pos = g.getAttribute('position').array; const idx = g.index ? g.index.array : null;
  const p = new Float32Array(pos); const i = idx ? new Uint32Array(idx) : new Uint32Array(0);
  index.push({ name: o.name, parent: o.parent?.name, nv: p.length / 3, ni: i.length, off });
  parts.push(Buffer.from(p.buffer), Buffer.from(i.buffer)); off += p.byteLength + i.byteLength;
});
fs.writeFileSync(out + '.bin', Buffer.concat(parts)); fs.writeFileSync(out + '.json', JSON.stringify(index));
console.log(index.length, 'meshes');
