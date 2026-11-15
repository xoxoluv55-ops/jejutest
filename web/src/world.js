// NERVE RUNNER web - the world: STAR-01 rides INSIDE the nervous system.
//  * every road is the inside of an axon: a translucent membrane tube with ion channels; the
//    membrane lights up (depolarises) around STAR-01 = the action potential travelling with you
//  * myelin sheath wraps with nodes of Ranvier, a soma chamber with nucleus / ER / mitochondria,
//    dendrites with spines, an axon terminal full of vesicles, a synaptic cleft with receptors
//  * outside the tube: a bundle of neighbouring fibres carrying their own signals, glia,
//    capillaries and a distant network of neurons; chapter themes change the scenery
//  * all branches of a fork look identical (no colour / orb / shape hint of the answer)
"use strict";
// created after three.js (ES module) has loaded
window.NRW_INIT = function () { window.NRW = (function () {
  const M = v => new THREE.Vector3(-v.x, v.y, v.z);       // Unity (left-handed) -> three: mirror X
  const C = h => new THREE.Color(h);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const U = { uTime: { value: 0 }, uStar: { value: new THREE.Vector3(0, -999, 0) }, fogColor: { value: C(0x0A0724) }, fogNear: { value: 40 }, fogFar: { value: 340 }, uFire: { value: 0 }, uSeize: { value: 0 } };
  const LANE = [0x2EE6D6, 0xFF5CC8, 0xFFD34D, 0x8CFF6B];
  const THEME = { spinal: 0x6CFF8A, tract: 0xFF6FD0, brainstem: 0xFF8A4D, cerebellum: 0xFF9AD8, diencephalon: 0x8CA8FF, cranial: 0xFFD34D, frontal: 0x5C9CFF, parietal: 0x5CFF9D, temporal: 0xFFB627, occipital: 0xFF6FD0, boss: 0xFF4DA6 };
  const MEMBRANE = 0x7FA8FF;

  function frameAt(seg, s, x = 0, y = 0) {
    const p = M(seg.worldPos(s, x, y)), f = M(seg.tangentAt(s)), up = new THREE.Vector3(0, 1, 0);
    const z = f.clone().negate(), xa = new THREE.Vector3().crossVectors(up, z).normalize(), ya = new THREE.Vector3().crossVectors(z, xa);
    return { p, q: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xa, ya, z)), f };
  }
  const short = (s, n = 15) => s.length > n ? s.slice(0, n - 1) + "…" : s;
  function labelTex(lines, opts = {}) {
    const W = opts.w || 512, H = opts.h || 256, c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
    x.fillStyle = opts.bg || "rgba(14,10,44,0.86)"; x.beginPath(); if (x.roundRect) x.roundRect(6, 6, W - 12, H - 12, 40); else x.rect(6, 6, W - 12, H - 12); x.fill();
    x.lineWidth = 10; x.strokeStyle = opts.border || "#FF5CC8"; x.stroke();
    x.textAlign = "center"; x.textBaseline = "middle"; let y = opts.big ? H * 0.36 : H / 2 - (lines.length - 1) * 30;
    lines.forEach((l, i) => {
      const big = opts.big && i === 0; x.fillStyle = big ? (opts.bigColor || "#2EE6D6") : "#F2F0FF";
      let size = big ? 120 : 52; const font = s => `${big ? "" : "bold "}${s}px Jua, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`; x.font = font(size);
      while (x.measureText(l).width > W - 50 && size > 22) { size -= 2; x.font = font(size); }
      x.fillText(l, W / 2, y); y += big ? H * 0.38 : 62;
    });
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }

  //================== SHADERS ==================
  const FOG_V = `varying float vD;`, FOG_F = `uniform vec3 fogColor;uniform float fogNear,fogFar;varying float vD;`;
  const VS = `varying vec2 vUv;varying vec3 vW;varying vec3 vN;${FOG_V}
    void main(){vUv=uv;vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;vN=normalize(mat3(modelMatrix)*normal);vec4 mv=viewMatrix*w;vD=-mv.z;gl_Position=projectionMatrix*mv;}`;
  const shader = (uniforms, frag, o = {}) => new THREE.ShaderMaterial(Object.assign({ uniforms: Object.assign({}, U, uniforms), vertexShader: VS, fragmentShader: frag, transparent: !!o.transparent, depthWrite: !o.transparent, side: o.side || THREE.DoubleSide, blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending }));

  // axon membrane (inside view): lipid bilayer shimmer, ion-channel dots, AP glow around STAR-01
  const MEMB_F = `uniform vec3 uCol,uStar;uniform float uTime,uAlpha,uFire,uSeize;varying vec2 vUv;varying vec3 vW;varying vec3 vN;${FOG_F}
    float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
    void main(){vec3 V=normalize(cameraPosition-vW);float fr=pow(1.-abs(dot(normalize(vN),V)),2.2);
     float u=vUv.x,v=vUv.y;float lip=.5+.5*sin(v*1.7+sin(u*37.)*.8);
     vec2 g=vec2(u*30.,v/3.2);vec2 f=fract(g)-.5;float ch=smoothstep(.2,.05,length(f))*step(.62,h(floor(g)));
     float d=length(vW-uStar);float ap=exp(-d*.12);
     float wave=smoothstep(.965,1.,fract(v/55.-uTime*.7));
     vec3 c=uCol*(.10+.42*fr+.07*lip)+vec3(.35,1.,.95)*ch*(.25+1.8*ap)+vec3(1.,.82,.38)*ap*(.3+.4*fr)+uCol*wave*.35;
     float fw=uFire*smoothstep(.0,.2,fract(v/30.-uTime*2.5));c+=vec3(1.,.92,.55)*fw*(.5+fr)*1.2;c+=vec3(1.,.08,.2)*uSeize*(.3+fr);
     float a=clamp(uAlpha+.55*fr+.35*ap+ch*.35+fw*.4+uSeize*.3,0.,1.);float fg=smoothstep(fogNear,fogFar,vD);
     gl_FragColor=vec4(mix(c,fogColor,fg),a*(1.-fg*.6));
     gl_FragColor.rgb=pow(max(gl_FragColor.rgb,vec3(0.)),vec3(2.2));
#include <colorspace_fragment>
    }`;
  // floor = cytoplasm with microtubule tracks and vesicles riding them (axonal transport)
  const FLOOR_F = `uniform vec3 uCol,uStar;uniform float uTime;varying vec2 vUv;varying vec3 vW;${FOG_F}
    void main(){float u=vUv.x,v=vUv.y,au=abs(u);vec3 c=vec3(.035,.03,.09)+uCol*.035;
     for(int i=0;i<4;i++){float k=-.66+float(i)*.44;float line=smoothstep(.035,.0,abs(u-k));
      float ves=step(.93,fract(v/9.+uTime*(.8+.3*float(i))+float(i)*.37));c+=uCol*line*(.22+ves*1.6);}
     c+=uCol*smoothstep(.86,1.,au)*1.1;
     c+=vec3(.8,.85,1.)*step(au,.02)*step(fract(v/10.),.4)*.18;
     float d=length(vW-uStar);c+=vec3(1.,.8,.35)*exp(-d*.22)*.2;
     float fg=smoothstep(fogNear,fogFar,vD);gl_FragColor=vec4(mix(c,fogColor,fg),1.);
     gl_FragColor.rgb=pow(max(gl_FragColor.rgb,vec3(0.)),vec3(2.2));
#include <colorspace_fragment>
    }`;
  // myelin: glossy cream wraps (spiral lamellae)
  const MYELIN_F = `uniform vec3 uCol,uStar;uniform float uTime,uDamaged;varying vec2 vUv;varying vec3 vW;varying vec3 vN;${FOG_F}
    void main(){vec3 N=normalize(vN),V=normalize(cameraPosition-vW);float fr=pow(1.-abs(dot(N,V)),2.);
     float lam=.5+.5*sin((vUv.x*6.2832+vUv.y*.35)*9.);
     vec3 base=mix(vec3(1.,.9,.66),vec3(.92,.7,.42),lam*.6);
     if(uDamaged>.5){base=mix(vec3(.55,.18,.25),vec3(.25,.06,.12),lam);base*=.6+.4*step(.5,fract(sin(floor(vUv.y/4.)*91.7)*437.1+uTime*.9));}
     float ndl=abs(dot(N,normalize(vec3(.3,.9,.2))))*.5+.5;float d=length(vW-uStar);
     vec3 c=base*(.13+.2*ndl)+uCol*fr*.22+vec3(1.,.85,.4)*exp(-d*.15)*.2;
     float fg=smoothstep(fogNear,fogFar,vD);gl_FragColor=vec4(mix(c,fogColor,fg),(uDamaged>.5?.7:.82)*(1.-fg*.5));
     gl_FragColor.rgb=pow(max(gl_FragColor.rgb,vec3(0.)),vec3(2.2));
#include <colorspace_fragment>
    }`;
  // neighbouring fibres in the nerve bundle, each carrying travelling impulses
  const FIBER_F = `uniform vec3 uCol;uniform float uTime,uSpeed,uMy;varying vec2 vUv;varying vec3 vW;varying vec3 vN;${FOG_F}
    void main(){vec3 V=normalize(cameraPosition-vW);float fr=pow(1.-abs(dot(normalize(vN),V)),1.6);
     float p=smoothstep(.9,1.,fract(vUv.y/48.-uTime*uSpeed));float band=uMy>.5?step(.1,fract(vUv.y/13.)):1.;
     vec3 base=mix(uCol*.32,vec3(.95,.88,.74)*.5,uMy*band);
     vec3 c=base*(.45+.9*fr)+uCol*p*2.2+(uMy>.5?(1.-band)*uCol*1.4:vec3(0.));
     float fg=smoothstep(fogNear,fogFar*1.3,vD);gl_FragColor=vec4(mix(c,fogColor,fg),1.);
     gl_FragColor.rgb=pow(max(gl_FragColor.rgb,vec3(0.)),vec3(2.2));
#include <colorspace_fragment>
    }`;
  const CONN_F = `uniform vec3 uCol;uniform float uTime;varying vec2 vUv;varying vec3 vW;varying vec3 vN;${FOG_F}
    void main(){float p=smoothstep(.88,1.,fract(vUv.x*3.-uTime*.35+vUv.y*.0));vec3 c=uCol*(.18+p*2.4);
     float fg=smoothstep(fogNear*3.,fogFar*3.,vD);gl_FragColor=vec4(mix(c,fogColor,fg*.8),1.);
     gl_FragColor.rgb=pow(max(gl_FragColor.rgb,vec3(0.)),vec3(2.2));
#include <colorspace_fragment>
    }`;
  // a big thin membrane shell (soma chamber, synapse walls)
  const SHELL_F = `uniform vec3 uCol,uStar;uniform float uTime;varying vec2 vUv;varying vec3 vW;varying vec3 vN;${FOG_F}
    void main(){vec3 V=normalize(cameraPosition-vW);float fr=pow(1.-abs(dot(normalize(vN),V)),2.);
     float cells=smoothstep(.45,.5,abs(sin(vUv.x*70.)*sin(vUv.y*40.)));
     vec3 c=uCol*(.12+.7*fr+.15*cells);float fg=smoothstep(fogNear*1.5,fogFar*1.6,vD);
     gl_FragColor=vec4(mix(c,fogColor,fg),clamp(.08+.6*fr+.08*cells,0.,1.));
     gl_FragColor.rgb=pow(max(gl_FragColor.rgb,vec3(0.)),vec3(2.2));
#include <colorspace_fragment>
    }`;
  const matCache = new Map();
  const cached = (key, make) => { if (!matCache.has(key)) matCache.set(key, make()); return matCache.get(key); };
  const membraneMat = col => cached("memb" + col, () => shader({ uCol: { value: C(col) }, uAlpha: { value: 0.07 } }, MEMB_F, { transparent: true }));
  const floorMat = col => cached("floor" + col, () => shader({ uCol: { value: C(col) } }, FLOOR_F));
  const myelinMat = (col, dmg) => cached("my" + col + dmg, () => shader({ uCol: { value: C(col) }, uDamaged: { value: dmg ? 1 : 0 } }, MYELIN_F, { transparent: true }));
  const fiberMat = (col, my, speed) => cached("fib" + col + my + speed, () => shader({ uCol: { value: C(col) }, uMy: { value: my ? 1 : 0 }, uSpeed: { value: speed } }, FIBER_F));
  const connMat = col => cached("conn" + col, () => shader({ uCol: { value: C(col) } }, CONN_F));
  const shellMat = col => cached("shell" + col, () => shader({ uCol: { value: C(col) } }, SHELL_F, { transparent: true }));
  const glow = (col, op = 0.9) => cached("glow" + col + op, () => new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  const solid = (col, em = 0.3) => cached("sol" + col + em, () => new THREE.MeshLambertMaterial({ color: col, emissive: col, emissiveIntensity: em }));
  const clear = (col, op, em = 0.4) => cached("clr" + col + op + em, () => new THREE.MeshLambertMaterial({ color: col, emissive: col, emissiveIntensity: em, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide }));

  //================== GEOMETRY HELPERS ==================
  // sweep a cross-section ring (array of [x,y] in road-local metres) along a segment
  function sweep(seg, s0, s1, step, ring, opts = {}) {
    const n = ring.length, pos = [], uv = [], idx = []; let rows = 0;
    for (let s = s0; ; s = Math.min(s1, s + step)) {
      const k = opts.scale ? opts.scale(s) : 1;
      for (let i = 0; i < n; i++) { const p = M(seg.worldPos(s, ring[i][0] * k + (opts.ox || 0), ring[i][1] * k + (opts.oy || 0))); pos.push(p.x, p.y, p.z); uv.push(opts.u ? opts.u[i] : i / (n - 1), s + (opts.vOff || 0)); }
      if (rows > 0) for (let i = 0; i < n - 1; i++) { const a = (rows - 1) * n + i, b = rows * n + i; idx.push(a, b, a + 1, a + 1, b, b + 1); }
      rows++; if (s >= s1) break;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  // long sweeps are cut into ~110 m pieces so off-screen parts are culled
  const parts = (s0, s1, L = 110) => { const a = []; for (let x = s0; x < s1 - 0.5; x += L) a.push([x, Math.min(s1, x + L + 0.01)]); return a; };
  function sweepN(seg, s0, s1, step, ring, opts) { return parts(s0, s1).map(([a, b]) => sweep(seg, a, b, step, ring, opts)); }
  const archRing = (Rw, H, n = 20) => { const r = []; for (let i = 0; i <= n; i++) { const t = (-0.07 + 1.14 * i / n) * Math.PI; r.push([Math.cos(t) * Rw, Math.sin(t) * H]); } return r; };
  const circleRing = (r, n = 7) => { const a = []; for (let i = 0; i <= n; i++) { const t = i / n * Math.PI * 2; a.push([Math.cos(t) * r, Math.sin(t) * r]); } return a; };
  const tubeRadius = hw => [hw + 1.6, hw * 0.85 + 3.6];   // [half-width, height] of the membrane arch

  // static geometry batching (one draw call per material)
  function merge(list) {
    let nv = 0, ni = 0; const hasUv = list.every(g => g.attributes.uv);
    for (const g of list) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
    const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), T = hasUv ? new Float32Array(nv * 2) : null, I = new Uint32Array(ni); let ov = 0, oi = 0;
    for (const g of list) {
      const c = g.attributes.position.count; P.set(g.attributes.position.array, ov * 3);
      if (!g.attributes.normal) g.computeVertexNormals(); N.set(g.attributes.normal.array, ov * 3); if (T) T.set(g.attributes.uv.array, ov * 2);
      if (g.index) { const a = g.index.array; for (let i = 0; i < a.length; i++) I[oi + i] = a[i] + ov; oi += a.length; } else { for (let i = 0; i < c; i++) I[oi + i] = ov + i; oi += c; }
      ov += c; g.dispose();
    }
    const m = new THREE.BufferGeometry(); m.setAttribute("position", new THREE.BufferAttribute(P, 3)); m.setAttribute("normal", new THREE.BufferAttribute(N, 3)); if (T) m.setAttribute("uv", new THREE.BufferAttribute(T, 2)); m.setIndex(new THREE.BufferAttribute(I, 1)); return m;
  }
  class Batch {
    constructor() { this.m = new Map(); }
    // batched per material AND per 160 m map cell, so the camera only draws what it can see
    add(mat, geo, matrix) {
      const g = matrix ? geo.clone().applyMatrix4(matrix) : geo; if (!g.boundingSphere) g.computeBoundingSphere(); const c = g.boundingSphere.center;
      const key = mat.uuid + ":" + Math.floor(c.x / 160) + ":" + Math.floor(c.z / 160) + ":" + Math.floor(c.y / 160);
      let b = this.m.get(key); if (!b) this.m.set(key, b = { mat, list: [] }); b.list.push(g);
    }
    flush(root) { for (const { mat, list } of this.m.values()) { const geo = merge(list); geo.computeBoundingSphere(); root.add(new THREE.Mesh(geo, mat)); } this.m.clear(); }
  }
  const G = {
    ico: new THREE.IcosahedronGeometry(1, 2), ico1: new THREE.IcosahedronGeometry(1, 1), cyl: new THREE.CylinderGeometry(0.55, 1, 1, 6, 1, true), cylS: new THREE.CylinderGeometry(1, 1, 1, 6, 1, true),
    cap: new THREE.CapsuleGeometry(1, 2.4, 4, 8), box: new THREE.BoxGeometry(1, 1, 1), tor: new THREE.TorusGeometry(1, 0.08, 6, 28),
  };
  const UPV = new THREE.Vector3(0, 1, 0);
  const mtx = (p, q, s) => new THREE.Matrix4().compose(p, q || new THREE.Quaternion(), s instanceof THREE.Vector3 ? s : new THREE.Vector3(s, s, s));
  // tapered cylinder from a to b
  function limb(B, mat, a, b, r) { const d = b.clone().sub(a), L = d.length(); if (L < 1e-3) return; B.add(mat, G.cyl, mtx(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(UPV, d.normalize()), new THREE.Vector3(r, L, r))); }
  function dendrite(B, mat, p, dir, len, r, depth) {
    const e = p.clone().addScaledVector(dir, len); limb(B, mat, p, e, r);
    if (depth > 0) for (let k = 0; k < 2; k++) { const nd = dir.clone().add(new THREE.Vector3().randomDirection().multiplyScalar(0.75)).normalize(); dendrite(B, mat, e, nd, len * 0.68, r * 0.62, depth - 1); }
  }
  function neuron(B, p, r, col, o = {}) {
    B.add(solid(col, 0.35), G.ico, mtx(p, new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd(0, 3), rnd(0, 3), 0)), new THREE.Vector3(r, r * rnd(0.8, 1.1), r * rnd(0.85, 1.15))));
    const dm = solid(col, 0.18), nd = o.dendrites || 6;
    for (let k = 0; k < nd; k++) { const dir = new THREE.Vector3().randomDirection(); if (o.apical && k === 0) dir.set(0, 1, 0); dendrite(B, dm, p.clone().addScaledVector(dir, r * 0.8), dir, r * rnd(2.2, 3.4) * (o.apical && k === 0 ? 2 : 1), r * 0.3, o.depth == null ? 2 : o.depth); }
    if (o.axon) limb(B, dm, p, p.clone().addScaledVector(o.axon, r * 14), r * 0.14);
  }

  //================== BUILD ==================
  function segColor(seg) {
    const Z = NR.ZONE;
    if (seg.zone === Z.Myelin) return 0xFFB627; if (seg.zone === Z.Damaged) return 0xFF4D6D; if (seg.zone === Z.Synapse) return 0xC07CFF;
    const base = THEME[seg.theme] || MEMBRANE;
    return base;   // approach, shortcut and review all share the theme colour: no hint
  }
  const isSoma = seg => /세포체|Soma/.test(seg.name), isDendrite = seg => /가지돌기|Dendrite/.test(seg.name), isTerminal = seg => /축삭종말|시냅스전 막/.test(seg.name);

  function build(scene, stage, graph, bank, quality) {
    const root = new THREE.Group(); scene.add(root);
    const W = { root, graph, stage, orbs: [], rings: [], obstacles: [], gates: [], forks: new Map(), nodes: [], anim: [], flashes: [], particles: null, nt: null, boss: null, bounds: new THREE.Box3(), low: quality === "low", mid: quality === "mid", psp: [] };
    const B = new Batch(), Z = NR.ZONE;
    for (const seg of graph.segments) {
      const col = segColor(seg), hw = seg.halfWidth, [Rw, H] = tubeRadius(hw);
      for (const floor of sweepN(seg, 0, seg.length, 2, [[-hw, 0.01], [hw, 0.01]], { u: [-1, 1] })) { root.add(new THREE.Mesh(floor, floorMat(col))); floor.computeBoundingBox(); W.bounds.union(floor.boundingBox); }
      if (seg.zone === Z.Myelin || seg.zone === Z.Damaged) buildMyelin(W, B, seg, col);
      else if (seg.zone === Z.Synapse) buildCleft(W, B, seg);
      else if (!isSoma(seg)) for (const g of sweepN(seg, 0, seg.length, 3, archRing(Rw, H, W.low ? 12 : 18))) root.add(new THREE.Mesh(g, membraneMat(col)));
      // edge light strips (the membrane meets the floor)
      for (const side of [-1, 1]) for (const g of sweepN(seg, 0, seg.length, 4, [[side * (hw + 0.05), 0.02], [side * (hw + 0.05), 0.45]])) B.add(glow(col, 0.75), g);
      if (isSoma(seg)) buildSoma(W, B, seg);
      if (isDendrite(seg)) buildDendrites(W, B, seg, Rw, H);
      if (isTerminal(seg)) buildVesicles(W, B, seg, Rw, H);
      buildBundle(W, B, seg, Rw, H, stage);
      buildChevrons(W, seg, Rw, H);
      if (seg.fork) buildForkPortals(W, B, seg, bank);
      for (const e of seg.events) buildEvent(W, B, seg, e, bank);
    }
    buildOrbs(W); buildBackdrop(W, B, stage); buildThemeDecor(W, B, stage);
    if (graph.segments.some(s => s.theme === "boss")) buildBoss(W);
    B.flush(root); buildParticles(W);
    return Object.assign(W, api(W));
  }

  function buildMyelin(W, B, seg, col) {
    const dmg = seg.zone === NR.ZONE.Damaged, hw = seg.halfWidth, [Rw, H] = tubeRadius(hw);
    const nodesS = seg.events.filter(e => e.type === NR.EV.NodeRing).map(e => e.s);
    const cuts = nodesS.length ? nodesS : (() => { const a = []; for (let s = 45; s < seg.length - 20; s += 55) a.push(s); return a; })();
    // bare axon membrane everywhere (visible in the node gaps)
    for (const g of sweepN(seg, 0, seg.length, 3, archRing(Rw - 0.3, H - 0.3, W.low ? 12 : 18))) W.root.add(new THREE.Mesh(g, membraneMat(dmg ? 0xFF6D8D : 0x5CE6FF)));
    let prev = 0, k = 0;
    for (const sN of cuts.concat([seg.length])) {
      const a = prev + 3.2, b = sN - 3.2; prev = sN; k++;
      if (b - a > 6) {
        const ring = dmg ? archRing(Rw + 0.4, H + 0.4).filter((_, i) => (i + k) % 7 > 1) : archRing(Rw + 0.4, H + 0.4);
        // lamellae: a sheath is several wraps -> two layers, the outer one a bit fatter and bulging in the middle
        const bulge = s => 1 + 0.08 * Math.sin(Math.PI * (s - a) / (b - a));
        W.root.add(new THREE.Mesh(sweep(seg, a, b, 2, ring, { scale: bulge }), myelinMat(col, dmg)));
        if (!W.low) B.add(myelinMat(col, dmg), sweep(seg, a + 1.5, b - 1.5, 3, archRing(Rw + 1.6, H + 1.4, 14), { scale: bulge }));
        if (dmg && k % 2) for (let j = 0; j < 4; j++) { const f = frameAt(seg, rnd(a, b), rnd(-1, 1) * (Rw + 2), rnd(1, H)); B.add(solid(0x8a2840, 0.3), G.ico1, mtx(f.p, null, new THREE.Vector3(rnd(0.6, 1.6), rnd(0.3, 0.6), rnd(0.8, 2)))); }
      }
      if (sN < seg.length - 3) {   // node of Ranvier: ring of voltage-gated Na+ channels
        const n = 22, chans = new THREE.InstancedMesh(G.cap, new THREE.MeshBasicMaterial({ color: dmg ? 0xFF6D8D : 0x2EE6D6 }), n);
        for (let i = 0; i < n; i++) { const t = (-0.07 + 1.14 * i / (n - 1)) * Math.PI, f = frameAt(seg, sN, Math.cos(t) * (Rw - 0.2), Math.sin(t) * (H - 0.2)); chans.setMatrixAt(i, mtx(f.p, f.q, 0.32)); }
        W.root.add(chans); W.nodes.push({ s: sN, seg, m: chans, t: 0 });
      }
    }
    // oligodendrocytes outside, reaching for the sheaths
    if (!dmg) for (let i = 0; i < 4; i++) {
      const s = rnd(30, seg.length - 30), side = i % 2 ? 1 : -1, f = frameAt(seg, s, side * (Rw + 14), H + 6);
      neuron(B, f.p, 2.2, 0x5E8FB0, { dendrites: 5, depth: 1 });
    }
  }

  function buildCleft(W, B, seg) {
    const hw = seg.halfWidth, len = seg.length;
    for (const [s, col, rec] of [[0.5, 0xC07CFF, false], [len - 0.5, 0x6FA8FF, true]]) {
      const f = frameAt(seg, s, 0, 4), ring = new THREE.Mesh(new THREE.RingGeometry(9, 80, 64, 3), shellMat(col)); ring.position.copy(f.p); ring.quaternion.copy(f.q); W.root.add(ring);
      // receptors (post) or docked vesicles (pre) around the opening
      for (let i = 0; i < 30; i++) {
        const a = rnd(0, Math.PI * 2), r = rnd(12, 40), p = new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0).applyQuaternion(f.q).add(f.p);
        if (rec) B.add(solid(0x2EE6D6, 0.7), G.cap, mtx(p, f.q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)), new THREE.Vector3(0.45, 0.9, 0.45)));
        else B.add(solid(0xFF7AD0, 0.6), G.ico1, mtx(p, null, 0.9));
      }
    }
    // neurotransmitter cloud crossing the cleft
    const n = W.low ? 120 : 320, pos = new Float32Array(n * 3), seeds = [];
    for (let i = 0; i < n; i++) seeds.push({ s: rnd(0, len), x: rnd(-14, 14), y: rnd(-6, 14), v: rnd(6, 14) });
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xFF7AD0, size: 0.32, map: dotTex(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    pts.frustumCulled = false; W.root.add(pts); W.nt = { seg, seeds, g, len };
  }

  function buildSoma(W, B, seg) {
    const mid = seg.length / 2, f = frameAt(seg, mid, 0, 6), road = [];
    for (let s = 0; s <= seg.length; s += 6) road.push(M(seg.worldPos(s, 0, 0)));
    const R = Math.min(260, Math.max(70, ...road.map(p => p.distanceTo(f.p))) + 18);
    const clearOf = (p, r) => road.every(q => q.distanceTo(p) > r);
    const spot = (r, prefer) => { for (const [ds, x, y] of prefer) { const c = frameAt(seg, NR.clamp(mid + ds, 0, seg.length), x, y); if (clearOf(c.p, r)) return c; } return frameAt(seg, mid, 60, 30); };
    const shell = new THREE.Mesh(new THREE.SphereGeometry(R, 48, 32), shellMat(0xB18CFF)); shell.position.copy(f.p); W.root.add(shell);
    // nucleus with nucleolus and nuclear pores
    const nf = spot(44, [[0, 48, 16], [0, -48, 16], [40, 52, 16], [-40, -52, 16], [0, 64, 22], [0, -64, 22]]), nuc = new THREE.Mesh(G.ico, clear(0x9B5CFF, 0.5, 0.5)); nuc.scale.setScalar(17); nuc.position.copy(nf.p); W.root.add(nuc);
    const nl = new THREE.Mesh(G.ico, solid(0xFF7AD0, 0.9)); nl.scale.setScalar(5.5); nl.position.copy(nf.p).add(new THREE.Vector3(3, 2, 0)); W.root.add(nl);
    for (let i = 0; i < 60; i++) { const d = new THREE.Vector3().randomDirection(); B.add(glow(0xE0C8FF, 0.9), G.ico1, mtx(nf.p.clone().addScaledVector(d, 17.1), null, 0.45)); }
    W.anim.push({ o: nuc, spin: 0.05 });
    // rough ER sheets wrapping the nucleus, Golgi stacks, mitochondria
    for (let i = 0; i < 7; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(19.5 + i * 1.6, 0.3, 6, 48, rnd(2, 3.6)), solid(0xFF8FC8, 0.45)); t.position.copy(nf.p); t.rotation.set(rnd(0, 3), rnd(0, 3), rnd(0, 3)); W.root.add(t); }
    const gf = spot(14, [[25, -32, 10], [-25, 32, 10], [60, -30, 12], [-60, 30, 12]]);
    for (let i = 0; i < 6; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(7 - i * 0.6, 0.5, 6, 30, 2.2), solid(0xFFD34D, 0.5)); t.position.copy(gf.p).add(new THREE.Vector3(0, i * 1.3, 0)); t.rotation.set(Math.PI / 2, 0, 0.6); W.root.add(t); }
    for (let i = 0; i < 26; i++) {
      const s = rnd(5, seg.length - 5), side = Math.random() < 0.5 ? -1 : 1, p = frameAt(seg, s, side * rnd(seg.halfWidth + 6, 45), rnd(-4, 30)).p;
      if (!clearOf(p, seg.halfWidth + 3)) continue;
      B.add(solid(0xFF9A4D, 0.45), G.cap, mtx(p, new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd(0, 3), rnd(0, 3), rnd(0, 3))), new THREE.Vector3(1.3, 1.3, 1.3)));
    }
  }

  function buildDendrites(W, B, seg, Rw, H) {
    const dm = solid(0x5A7FC8, 0.2);
    for (let s = 10; s < seg.length; s += 3.5) {   // spines on the outside of the membrane
      const t = rnd(0.05, 0.95) * Math.PI, f = frameAt(seg, s, Math.cos(t) * Rw, Math.sin(t) * H), out = f.p.clone().sub(frameAt(seg, s, 0, H * 0.3).p).normalize();
      const tip = f.p.clone().addScaledVector(out, rnd(1.2, 2.4)); limb(B, dm, f.p, tip, 0.18); B.add(solid(0x8FA8E0, 0.35), G.ico1, mtx(tip, null, rnd(0.45, 0.7)));
    }
    for (let i = 0; i < 9; i++) {   // side dendrites with incoming synapses (EPSPs flow into the trunk)
      const s = rnd(20, seg.length - 20), side = i % 2 ? 1 : -1, a = frameAt(seg, s, side * Rw, rnd(2, H)).p, dir = new THREE.Vector3(-side * 0 + rnd(-0.3, 0.3), rnd(-0.1, 0.6), 0);
      const away = frameAt(seg, s, side * (Rw + 10), 0).p.sub(frameAt(seg, s, 0, 0).p).normalize(); dir.add(away).normalize();
      dendrite(B, dm, a, dir, rnd(14, 22), 1.4, 2);
      const tip = a.clone().addScaledVector(dir, 20); const b = new THREE.Mesh(G.ico, solid(0xFF7AD0, 0.9)); b.scale.setScalar(1.6); b.position.copy(tip); W.root.add(b); W.flashes.push({ m: b, ph: rnd(0, 6) });
    }
  }

  function buildVesicles(W, B, seg, Rw, H) {
    for (let i = 0; i < (W.low ? 50 : 140); i++) {
      const s = rnd(0, seg.length), t = rnd(0.1, 0.9) * Math.PI, k = rnd(0.72, 0.95), p = frameAt(seg, s, Math.cos(t) * Rw * k, Math.sin(t) * H * k).p;
      B.add(solid(0xFF7AD0, 0.55), G.ico1, mtx(p, null, rnd(0.35, 0.6)));
    }
    for (let i = 0; i < 6; i++) { const p = frameAt(seg, rnd(0, seg.length), (i % 2 ? 1 : -1) * Rw * 0.7, H * 0.6).p; B.add(solid(0xFF9A4D, 0.45), G.cap, mtx(p, new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd(0, 3), rnd(0, 3), 0)), 0.9)); }
  }

  // the nerve: neighbouring fibres, glia and capillaries around the road
  function buildBundle(W, B, seg, Rw, H, stage) {
    if (seg.zone === NR.ZONE.Synapse || isSoma(seg)) return;
    const theme = THEME[seg.theme] || MEMBRANE, myel = /spinal|tract|cranial/.test(seg.theme || "") || seg.zone === NR.ZONE.Myelin;
    const n = W.low ? 2 : W.mid ? (seg.zone === NR.ZONE.Review || seg.zone === NR.ZONE.Shortcut ? 2 : 4) : (seg.zone === NR.ZONE.Review || seg.zone === NR.ZONE.Shortcut ? 3 : 6);
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1, ox = side * (Rw + rnd(5, 26)), oy = rnd(-8, H + 18), r = rnd(0.8, 2.6);
      const col = seg.theme === "tract" ? (i % 2 ? 0x5C9CFF : 0xFF5C7A) : i % 3 === 0 ? 0xFFD34D : theme;
      const sp = seg.theme === "tract" ? (i % 2 ? 0.6 : -0.6) : rnd(0.3, 0.9);
      const fm = fiberMat(col, myel && i % 2 === 0, +sp.toFixed(1)), vOff = rnd(0, 100);
      for (const g of sweepN(seg, 0, seg.length, 8, circleRing(r, W.mid || W.low ? 5 : 7), { ox, oy, vOff })) B.add(fm, g);
    }
    if (!W.low && seg.length > 60) for (let s = rnd(20, 60); s < seg.length - 10; s += rnd(70, 140)) {
      const side = Math.random() < 0.5 ? -1 : 1, p = frameAt(seg, s, side * (Rw + rnd(8, 20)), rnd(2, H + 10)).p;
      neuron(B, p, rnd(1.2, 2), 0x3F9C86, { dendrites: 7, depth: 1 });          // astrocyte
      if (Math.random() < 0.5) B.add(fiberMat(0xFF4D5A, false, 1.2), sweep(seg, Math.max(0, s - 40), Math.min(seg.length, s + 40), 6, circleRing(0.7, 6), { ox: side * (Rw + rnd(3, 6)), oy: -2 + rnd(0, 4) }));   // capillary
    }
  }

  function laneStrips(W, B, seg, s0, s1, laneX) {
    laneX.forEach((lx, i) => {
      B.add(glow(LANE[i % 4], 0.5), sweep(seg, Math.max(0, s0), s1, 3, [[lx - 0.7, 0.03], [lx + 0.7, 0.03]]));
      for (let s = Math.max(0, s0) + 6; s < s1 - 4; s += 14) { const f = frameAt(seg, s, lx, 0.05); B.add(glow(LANE[i % 4], 0.85), G.box, mtx(f.p, f.q, new THREE.Vector3(1.6, 0.05, 0.5))); }
    });
    for (let i = 0; i < laneX.length - 1; i++) { const m = (laneX[i] + laneX[i + 1]) / 2; B.add(glow(0xffffff, 0.35), sweep(seg, Math.max(0, s0), s1, 3, [[m - 0.08, 0.04], [m + 0.08, 0.04]])); }
  }
  function archTube(seg, s, Rw, H, r) {
    const pts = archRing(Rw, H, 24).map(([x, y]) => M(seg.worldPos(s, x, y)));
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, r, 6, false);
  }
  function hologram(W, seg, s, x, y, tex, w, h) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    const f = frameAt(seg, s, x, y); m.position.copy(f.p); m.quaternion.copy(f.q); W.root.add(m); return m;
  }
  const LETTER = i => String.fromCharCode(65 + i), HEXS = c => "#" + c.toString(16).padStart(6, "0");

  // 3.0: corner warning chevrons on the outer wall of sharp curves (see the corner before it arrives)
  let _chev = null;
  function chevMat() {
    if (_chev) return _chev; const c = document.createElement("canvas"); c.width = 256; c.height = 128; const x = c.getContext("2d");
    x.fillStyle = "rgba(30,10,20,.75)"; x.fillRect(0, 0, 256, 128); x.strokeStyle = "#FFB627"; x.lineWidth = 18; x.lineJoin = "round";
    for (const ox of [40, 110, 180]) { x.beginPath(); x.moveTo(ox, 22); x.lineTo(ox + 40, 64); x.lineTo(ox, 106); x.stroke(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return (_chev = new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide }));
  }
  function buildChevrons(W, seg, Rw, H) {
    if (seg.zone === NR.ZONE.Synapse || isSoma(seg)) return;
    const spots = [];
    for (let s = 10; s < seg.length - 6; s += 16) { const k = seg.curvatureAt(s + 12); if (Math.abs(k) > 0.0095) spots.push([s, k]); }
    if (!spots.length) return;
    const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(2.6, 1.3), chevMat(), spots.length), m = new THREE.Matrix4();
    spots.forEach(([s, k], i) => { const side = k > 0 ? -1 : 1, f = frameAt(seg, s, side * (Rw - 0.9), Math.min(2.6, H * 0.4)); m.compose(f.p, f.q, new THREE.Vector3(k > 0 ? 1 : -1, 1, 1)); im.setMatrixAt(i, m); });
    W.root.add(im);
  }
  function buildForkPortals(W, B, seg, bank) {
    const q = bank.get(seg.fork.questionId), lx = seg.fork.laneX, signs = [];
    laneStrips(W, B, seg, seg.length - 150, seg.length, lx);
    lx.forEach((x, i) => {   // identical portal for every branch: no hint which one is the shortcut
      const sp = Math.abs(lx[1] - lx[0]) / 2 - 0.3, pts = []; for (let k = 0; k <= 16; k++) { const t = Math.PI * k / 16; pts.push(M(seg.worldPos(seg.length - 2, x + Math.cos(t) * sp, Math.sin(t) * 6.5))); }
      B.add(glow(LANE[i % 4], 0.95), new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.28, 6, false));
      signs.push(hologram(W, seg, seg.length - 3, x, 8.4, labelTex([LETTER(i), short(q.options[i])], { big: true, border: HEXS(LANE[i % 4]), bigColor: HEXS(LANE[i % 4]) }), Math.min(5.6, sp * 2), 2.8));
    });
    W.forks.set(seg.fork.questionId, { seg, signs });
  }

  function buildEvent(W, B, seg, e, bank) {
    const E = NR.EV, hw = seg.halfWidth, [Rw, H] = tubeRadius(hw);
    if (e.type === E.Gate) {   // voltage-gated channel ring with an answer hologram per lane
      const q = bank.get(e.questionId), boss = e.tag === "boss", gc = boss ? 0xFF4DA6 : e.tag === "glia" ? 0x5CFF9D : 0xB98CFF;
      W.root.add(new THREE.Mesh(archTube(seg, e.s, Rw - 0.4, H - 0.4, 0.45), glow(gc, 0.95)));
      const n = 26, sub = new THREE.InstancedMesh(G.cap, solid(gc, 0.6), n);
      for (let i = 0; i < n; i++) { const t = (-0.07 + 1.14 * i / (n - 1)) * Math.PI, f = frameAt(seg, e.s + 0.6, Math.cos(t) * (Rw - 0.4), Math.sin(t) * (H - 0.4)); sub.setMatrixAt(i, mtx(f.p, f.q, 0.5)); }
      W.root.add(sub); laneStrips(W, B, seg, e.s - 110, e.s, e.laneX);
      const w = Math.min(5.6, Math.abs(e.laneX[1] - e.laneX[0]) * 0.92);
      const signs = e.laneX.map((lx, i) => hologram(W, seg, e.s - 0.5, lx, 4.6, labelTex([LETTER(i), short(q ? q.options[i] : "")], { big: true, border: HEXS(LANE[i % 4]), bigColor: HEXS(LANE[i % 4]) }), w, w * 0.5));
      W.gates.push({ e, signs });
    } else if (e.type === E.Epsp || e.type === E.Ipsp) {
      const ex = e.type === E.Epsp, sp = new THREE.Sprite(pspMat(ex)); sp.scale.set(1.7, 1.7, 1); sp.position.copy(M(seg.worldPos(e.s, e.x, NR.Sim.HOVER + 0.3)));
      W.root.add(sp); W.psp.push({ e, sp, y: sp.position.y, ph: Math.random() * 6 });
    } else if (e.type === E.Trigger && /^integ:(excite|inhibit)$/.test(e.tag)) {
      const ex = e.tag === "integ:excite";
      hologram(W, seg, Math.min(seg.length - 1, e.s + 28), 0, H - 2.2, labelTex(ex ? ["EPSP 가중 구간", "초록 ＋ 를 연달아 → 역치 → 발화!"] : ["IPSP 억제 구간", "파랑 − 로 과흥분을 막아!"], { w: 768, h: 220, border: ex ? "#5CFF9D" : "#5C9CFF", bg: "rgba(10,20,40,.85)" }), 9, 2.6);
      W.root.add(new THREE.Mesh(archTube(seg, Math.min(seg.length - 1, e.s + 30), Rw - 0.5, H - 0.5, 0.35), glow(ex ? 0x5CFF9D : 0x5C9CFF)));
    } else if (e.type === E.NodeRing) {
      const m = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.17, 8, 32), glow(0x5CF6FF)); const f = frameAt(seg, e.s, e.x, NR.Sim.HOVER); m.position.copy(f.p); m.quaternion.copy(f.q); W.root.add(m); W.rings.push({ e, m, t: 0 });
    } else if (e.type === E.Obstacle) {
      const pulse = e.width >= hw, w = Math.min(e.width, hw * 2), grp = new THREE.Group(), f = frameAt(seg, e.s, e.x, 0); grp.position.copy(f.p); grp.quaternion.copy(f.q);
      if (pulse) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, e.height * 0.8, 0.5), glow(0xFF3355, 0.8)); m.position.y = e.height * 0.4; grp.add(m); const r = new THREE.Mesh(archTube(seg, e.s, Rw - 0.3, H - 0.3, 0.25), glow(0xFF3355, 0.6)); W.root.add(r); }
      else {
        const m = new THREE.Mesh(new THREE.BoxGeometry(e.width, e.height + 0.4, 1.6), new THREE.MeshLambertMaterial({ color: 0x14020a, emissive: 0x6a0020 })); m.position.y = (e.height + 0.4) / 2; grp.add(m);
        m.add(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color: 0xFF4D6D })));
        const tag = hologram(W, seg, e.s - 0.9, e.x, e.height + 1.6, labelTex(["NULL"], { w: 256, h: 96, border: "#FF4D6D", bg: "rgba(40,0,10,.85)" }), 2.4, 0.9); W.anim.push({ o: tag, flick: 1 });
      }
      W.root.add(grp); W.obstacles.push({ e, grp, pulse });
    } else if (e.type === E.Finish || e.type === E.Checkpoint) {
      const fin = e.type === E.Finish; W.root.add(new THREE.Mesh(archTube(seg, e.s, Rw - 0.5, H - 0.5, fin ? 0.7 : 0.35), glow(fin ? 0xFFD34D : 0xB98CFF)));
      if (fin) hologram(W, seg, e.s - 0.5, 0, H - 2.4, labelTex(["GOAL"], { w: 512, h: 160, border: "#FFD34D", bg: "rgba(40,20,70,.92)", bigColor: "#FFD34D" }), 7, 2.2);
    }
  }

  const pspCache = {};
  function pspMat(ex) {
    if (pspCache[ex]) return pspCache[ex];
    const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d"), col = ex ? "92,255,157" : "92,156,255";
    const g = x.createRadialGradient(64, 64, 8, 64, 64, 62); g.addColorStop(0, `rgba(${col},1)`); g.addColorStop(0.55, `rgba(${col},.55)`); g.addColorStop(1, `rgba(${col},0)`);
    x.fillStyle = g; x.fillRect(0, 0, 128, 128); x.fillStyle = "#0B1A2A"; x.font = "bold 86px sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(ex ? "+" : "−", 64, 60);
    x.font = "bold 20px sans-serif"; x.fillStyle = "#ffffff"; x.fillText(ex ? "EPSP" : "IPSP", 64, 104);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return (pspCache[ex] = new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
  }
  function buildOrbs(W) {
    const list = []; for (const seg of W.graph.segments) for (const e of seg.events) if (e.type === NR.EV.Orb || e.type === NR.EV.RepairOrb) list.push({ seg, e });
    const mk = (filter, geo, mat, sc) => {
      const items = list.filter(filter); if (!items.length) return;
      const im = new THREE.InstancedMesh(geo, mat, items.length); im.frustumCulled = false; W.root.add(im);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
      items.forEach((it, i) => { it.p = M(it.seg.worldPos(it.e.s, it.e.x, NR.Sim.HOVER + 0.2)); it.i = i; q.setFromEuler(new THREE.Euler(0.4, i * 0.7, 0.4)); im.setMatrixAt(i, m4.compose(it.p, q, new THREE.Vector3(1, 1, 1))); });
      W.orbs.push({ im, items, sc });
    };
    mk(it => it.e.type === NR.EV.Orb, new THREE.OctahedronGeometry(0.55), new THREE.MeshBasicMaterial({ color: 0xFFE27A }), 1);
    mk(it => it.e.type === NR.EV.RepairOrb, new THREE.IcosahedronGeometry(0.8, 1), new THREE.MeshBasicMaterial({ color: 0x7CFFB0 }), 1);
  }

  // distant connectome: neurons wired together with impulses running along the axons
  function buildBackdrop(W, B, stage) {
    const b = W.bounds, c = new THREE.Vector3(), size = new THREE.Vector3(); b.getCenter(c); b.getSize(size);
    const R = Math.max(size.x, size.z) * 0.5 + 260, n = W.low ? 14 : 34, somas = [], pal = [0x6FA8FF, 0xB98CFF, 0xFF7AD0, 0x5CE6FF];
    const tint = THEME[(W.graph.segments.find(s => s.theme) || {}).theme]; if (tint) pal[0] = tint;
    for (let i = 0; i < n; i++) {
      const a = rnd(0, Math.PI * 2), r = R * rnd(0.75, 1.15), p = new THREE.Vector3(c.x + Math.cos(a) * r, rnd(-80, 160), c.z + Math.sin(a) * r);
      const col = pal[i % pal.length]; neuron(B, p, rnd(5, 10), col, { dendrites: 7 }); somas.push({ p, col });
    }
    if (!W.low) for (let i = 0; i < somas.length; i++) {
      const a = somas[i], bb = somas[(i + 1 + ((Math.random() * 4) | 0)) % somas.length], mid = a.p.clone().lerp(bb.p, 0.5).add(new THREE.Vector3(rnd(-60, 60), rnd(-40, 80), rnd(-60, 60)));
      B.add(connMat(a.col), new THREE.TubeGeometry(new THREE.CatmullRomCurve3([a.p, mid, bb.p]), 40, 1.1, 5, false));
    }
    const m = W.low ? 600 : 1500, pos = new Float32Array(m * 3);
    for (let i = 0; i < m; i++) { const a = rnd(0, Math.PI * 2), r = R * rnd(0.3, 1.6); pos.set([c.x + Math.cos(a) * r, rnd(-150, 300), c.z + Math.sin(a) * r], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    W.root.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0x9C8CFF, size: 1.6, transparent: true, opacity: 0.6, fog: false, depthWrite: false, blending: THREE.AdditiveBlending })));
  }

  // chapter scenery outside the bundle
  function buildThemeDecor(W, B, stage) {
    const segs = W.graph.segments.filter(s => s.zone !== NR.ZONE.Review && s.zone !== NR.ZONE.Shortcut && s.length > 80);
    const each = (k, fn) => { for (let i = 0; i < k; i++) { const seg = segs[(Math.random() * segs.length) | 0]; const [Rw, H] = tubeRadius(seg.halfWidth); fn(seg, rnd(10, seg.length - 10), Math.random() < 0.5 ? -1 : 1, Rw, H); } };
    const k = W.low ? 0.4 : 1;
    if (stage.id === "ch5") each(26 * k, (seg, s, side, Rw, H) => {   // Purkinje cells: flat fan-shaped dendritic trees
      const base = frameAt(seg, s, side * (Rw + rnd(30, 60)), -10), plane = base.f.clone();
      B.add(solid(0xFF9AD8, 0.5), G.ico, mtx(base.p, null, 3));
      const grow = (p, d, L, r, dep) => { const e = p.clone().addScaledVector(d, L); limb(B, solid(0xFF9AD8, 0.25), p, e, r); if (dep > 0) for (const t of [-0.5, 0.5]) { const nd = d.clone().applyAxisAngle(plane, t + rnd(-0.2, 0.2)); grow(e, nd, L * 0.75, r * 0.7, dep - 1); } };
      grow(base.p, new THREE.Vector3(0, 1, 0), 10, 1, 4);
    });
    if (stage.id === "ch2" || stage.id === "ch4" || stage.id === "ch6") each(18 * k, (seg, s, side, Rw) => neuron(B, frameAt(seg, s, side * (Rw + rnd(25, 60)), rnd(-15, 25)).p, rnd(3, 5), THEME[seg.theme] || MEMBRANE, { dendrites: 8, axon: new THREE.Vector3(0, -1, 0) }));
    if (stage.id === "ch4" || stage.id === "ch6") each(10 * k, (seg, s, side, Rw) => { const p = frameAt(seg, s, side * (Rw + rnd(30, 70)), rnd(0, 30)).p; for (let i = 0; i < 9; i++) B.add(solid(THEME[seg.theme], 0.6), G.ico, mtx(p.clone().add(new THREE.Vector3().randomDirection().multiplyScalar(rnd(2, 9))), null, rnd(1.2, 2.5))); });
    if (stage.id === "ch7") each(40 * k, (seg, s, side, Rw) => {   // cortex: pyramidal neurons with apical dendrites
      const p = frameAt(seg, s, side * (Rw + rnd(20, 55)), rnd(-20, 10)).p; neuron(B, p, rnd(2.5, 4), THEME[seg.theme] || MEMBRANE, { dendrites: 4, apical: true, axon: new THREE.Vector3(0, -1, 0) });
    });
    if (stage.id === "ch8") each(14 * k, (seg, s, side, Rw, H) => {   // cranial nerve roots leaving the brainstem
      const a = frameAt(seg, s, side * (Rw + 8), rnd(0, H)).p, d = frameAt(seg, s, side * (Rw + 90), rnd(-30, 40)).p;
      B.add(fiberMat(0xFFD34D, true, 0.7), new THREE.TubeGeometry(new THREE.CatmullRomCurve3([a, a.clone().lerp(d, 0.5).add(new THREE.Vector3(0, rnd(-20, 20), 0)), d]), 30, rnd(1.2, 2.2), 6, false));
    });
  }

  function buildBoss(W) {
    const g = new THREE.Group(); g.position.set(0, 26, 0); W.root.add(g);
    const core = new THREE.Mesh(G.ico, new THREE.MeshBasicMaterial({ color: 0x12000a })); core.scale.setScalar(22); g.add(core);
    const wire = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(27, 1)), new THREE.LineBasicMaterial({ color: 0xFF2D55 })); g.add(wire);
    const rings = [0, 1, 2].map(i => { const r = new THREE.Mesh(new THREE.TorusGeometry(36 + i * 6, 0.6, 6, 80), glow(0xFF4DA6, 0.9)); r.rotation.set(rnd(0, 3), rnd(0, 3), 0); g.add(r); return r; });
    const shield = new THREE.Mesh(new THREE.SphereGeometry(48, 40, 24), new THREE.MeshBasicMaterial({ color: 0xFF4DA6, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); g.add(shield);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex(["NULL"], { w: 512, h: 160, border: "#FF2D55", bg: "rgba(30,0,10,.9)" }), depthWrite: false })); label.scale.set(30, 9.4, 1); label.position.y = 58; g.add(label);
    W.boss = { g, core, wire, rings, shield, flash: 0, atk: 0 };
  }

  let _dot = null;
  function dotTex() { if (_dot) return _dot; const c = document.createElement("canvas"); c.width = c.height = 32; const x = c.getContext("2d"), g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.5, "rgba(255,255,255,.5)"); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(0, 0, 32, 32); return (_dot = new THREE.CanvasTexture(c)); }
  function buildParticles(W) {   // Na+ (gold) and K+ (violet) ions drifting inside the axon around STAR-01
    const n = W.low ? 90 : 240, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), seeds = [];
    for (let i = 0; i < n; i++) { const k = i % 2 ? C(0xFFD34D) : C(0xB98CFF); col.set([k.r, k.g, k.b], i * 3); seeds.push({ seg: null, s: 0, x: 0, y: 0, ds: 0 }); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const p = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.16, map: dotTex(), alphaTest: 0.01, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); p.frustumCulled = false; W.root.add(p);
    W.particles = { g, seeds, n };
  }

  //================== RUNTIME ==================
  function api(W) {
    const tmp = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), zero = new THREE.Vector3();
    return {
      update(dt, t, sim) {
        // 3.0: orbs are static (matrices written once); only a collected orb is changed (see collect)
        for (const o of W.obstacles) { if (o.pulse) o.grp.children[0].material.opacity = 0.5 + 0.35 * Math.sin(t * 8); else o.grp.children[0].scale.x = 1 + (Math.random() < 0.05 ? rnd(-0.15, 0.15) : 0); }
        for (const a of W.anim) { if (a.spin) a.o.rotation.y += dt * a.spin; if (a.flick) a.o.visible = Math.random() > 0.04; }
        for (const p of W.psp) if (p.sp.visible) p.sp.position.y = p.y + Math.sin(t * 3 + p.ph) * 0.25;
        for (const f of W.flashes) { const k = 0.5 + 0.5 * Math.sin(t * 2.2 + f.ph); f.m.scale.setScalar(1.3 + k * 0.7); }
        for (const r of W.rings) { if (r.t > 0) { r.t -= dt; r.m.scale.setScalar(1 + (0.6 - r.t) * 2.5); if (r.t <= 0) r.m.visible = false; } else r.m.rotation.z += dt * 1.5; }
        for (const nd of W.nodes) if (nd.t > 0) { nd.t -= dt; nd.m.material.color.setHex(nd.t > 0 ? 0xFFFFFF : 0x2EE6D6); }
        if (W.nt) { const { seg, seeds, g, len } = W.nt, a = g.attributes.position.array; seeds.forEach((p, i) => { p.s += p.v * dt; if (p.s > len) p.s -= len; const v = M(seg.worldPos(p.s, p.x + Math.sin(t + i) * 0.5, p.y)); a[i * 3] = v.x; a[i * 3 + 1] = v.y; a[i * 3 + 2] = v.z; }); g.attributes.position.needsUpdate = true; }
        if (W.boss) { const b = W.boss; b.wire.rotation.y += dt * 0.4; b.wire.rotation.x += dt * 0.17; b.rings.forEach((r, i) => { r.rotation.x += dt * (0.3 + i * 0.2); r.rotation.y += dt * 0.2; }); if (b.flash > 0) { b.flash -= dt; b.core.material.color.setHex(b.flash > 0 ? 0xFFFFFF : 0x12000a); } if (b.atk > 0) { b.atk -= dt; b.shield.scale.setScalar(1 + (1 - b.atk) * 0.6); if (b.atk <= 0) b.shield.scale.setScalar(1); } }
        if (sim && W.particles) {
          const P = W.particles, a = P.g.attributes.position.array;
          // 3.0: world position computed only when an ion respawns (max 6 per frame); otherwise it just drifts
          const star = U.uStar.value; let spawns = 0;
          P.seeds.forEach((p, i) => {
            if ((!p.wp || p.wp.distanceToSquared(star) > 80 * 80) && spawns < 6) {
              spawns++; const hw = sim.seg.halfWidth, [Rw, H] = tubeRadius(hw), s = Math.min(sim.seg.length, sim.s + rnd(-4, 70));
              const v = M(sim.seg.worldPos(s, rnd(-Rw, Rw) * 0.85, rnd(0.3, H * 0.8))); if (!p.wp) { p.wp = new THREE.Vector3(); p.dv = new THREE.Vector3(); } p.wp.copy(v); p.dv.set(rnd(-0.6, 0.6), rnd(-0.4, 0.4), rnd(-0.6, 0.6));
            }
            if (p.wp) { p.wp.addScaledVector(p.dv, dt); a[i * 3] = p.wp.x; a[i * 3 + 1] = p.wp.y; a[i * 3 + 2] = p.wp.z; }
          });
          P.g.attributes.position.needsUpdate = true;
        }
      },
      pspCollect(e) { const p = W.psp.find(x => x.e === e); if (p) p.sp.visible = false; },
      collect(e) { for (const g of W.orbs) { const it = g.items.find(x => x.e === e); if (it) { it.gone = true; tmp.compose(it.p, q, zero); g.im.setMatrixAt(it.i, tmp); g.im.instanceMatrix.needsUpdate = true; return; } } },
      ringHit(e, hit) { const r = W.rings.find(x => x.e === e); if (!r) return; if (hit) { r.m.material = glow(0xFFFFFF); r.t = 0.6; for (const nd of W.nodes) if (Math.abs(nd.s - e.s) < 0.5) nd.t = 0.25; } else r.m.material = glow(0x553355, 0.5); },
      markSigns(signs, lane, correctLane) { signs.forEach((p, i) => { p.material.color.setHex(i === correctLane ? 0xB8FFD0 : i === lane ? 0xFF8A9A : 0x555577); }); },
      gateResult(e, lane) { const g = W.gates.find(x => x.e === e); if (g) this.markSigns(g.signs, lane, e.correctLane); },
      forkResult(qid, lane) { const f = W.forks.get(qid); if (f) this.markSigns(f.signs, lane, f.seg.fork.correctLane); },
      bossHit(hp, max) { if (!W.boss) return; W.boss.flash = 0.25; W.boss.shield.material.opacity = 0.04 + 0.12 * hp / Math.max(1, max); },
      bossAttack() { if (W.boss) W.boss.atk = 1; },
      dispose(scene) {
        scene.remove(W.root);
        W.root.traverse(o => { if (o.geometry && !Object.values(G).includes(o.geometry)) o.geometry.dispose(); if (o.material && o.material.map) o.material.map.dispose(); });
      },
    };
  }

  return { M, frameAt, labelTex, U, LANE, build, tubeRadius, HEXS };
})(); };
