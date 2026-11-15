// NERVE RUNNER 3.0 - racing feedback effects. Everything is created once and reused (no per-frame
// allocations): blob shadow + landing ring, drift spark ribbon, spark particles, speed lines.
"use strict";
function createFX(scene, camera) {
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), LAY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  const radial = (stops) => { const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d"), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); stops.forEach(([o, col]) => g.addColorStop(o, col)); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); };

  // --- blob shadow (where STAR-01 will land) + shrinking landing ring while airborne
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.8), new THREE.MeshBasicMaterial({ map: radial([[0, "rgba(0,0,0,.75)"], [0.6, "rgba(0,0,0,.35)"], [1, "rgba(0,0,0,0)"]]), transparent: true, depthWrite: false }));
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.05, 40), new THREE.MeshBasicMaterial({ color: 0x5CF6FF, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  shadow.renderOrder = 2; ring.renderOrder = 3; scene.add(shadow, ring);

  // --- drift ribbon on the floor behind STAR-01, colour = mini-turbo tier
  // two thin skid streaks (4 vertices per sample: L-out, L-in, R-in, R-out)
  const N = 48, rib = new THREE.BufferGeometry(), rp = new Float32Array(N * 4 * 3), rc = new Float32Array(N * 4 * 3), idx = [];
  for (let i = 0; i < N - 1; i++) { const a = i * 4, b = a + 4; idx.push(a, a + 1, b, a + 1, b + 1, b, a + 2, a + 3, b + 2, a + 3, b + 3, b + 2); }
  rib.setAttribute("position", new THREE.BufferAttribute(rp, 3)); rib.setAttribute("color", new THREE.BufferAttribute(rc, 3)); rib.setIndex(idx);
  const ribbon = new THREE.Mesh(rib, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  ribbon.frustumCulled = false; scene.add(ribbon);
  const hist = []; for (let i = 0; i < N; i++) hist.push({ p: new THREE.Vector3(), side: new THREE.Vector3(), a: 0 });
  let head = 0, ribbonFade = 0; const tierCol = [new THREE.Color(0x9FB8FF), new THREE.Color(0x4D8DFF), new THREE.Color(0xFFB627), new THREE.Color(0xFF5CC8)];

  // --- spark particles (pool)
  const P = 140, sp = new THREE.BufferGeometry(), spp = new Float32Array(P * 3), spc = new Float32Array(P * 3), parts = [];
  for (let i = 0; i < P; i++) parts.push({ p: new THREE.Vector3(0, -999, 0), v: new THREE.Vector3(), life: 0, max: 1, col: new THREE.Color() });
  sp.setAttribute("position", new THREE.BufferAttribute(spp, 3)); sp.setAttribute("color", new THREE.BufferAttribute(spc, 3));
  const sparks = new THREE.Points(sp, new THREE.PointsMaterial({ size: 0.32, map: radial([[0, "rgba(255,255,255,1)"], [0.4, "rgba(255,255,255,.6)"], [1, "rgba(255,255,255,0)"]]), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  sparks.frustumCulled = false; scene.add(sparks); let pi = 0;
  function emit(pos, n, col, speed, up = 2) {
    for (let k = 0; k < n; k++) {
      const q = parts[pi]; pi = (pi + 1) % P; q.p.copy(pos);
      q.v.set((Math.random() - 0.5) * speed, Math.random() * up, (Math.random() - 0.5) * speed); q.life = q.max = 0.35 + Math.random() * 0.35; q.col.set(col);
    }
  }

  // --- speed lines (children of the camera)
  const L = 56, sl = new THREE.BufferGeometry(), slp = new Float32Array(L * 2 * 3), lines = [];
  for (let i = 0; i < L; i++) { const a = Math.random() * Math.PI * 2, r = 2.6 + Math.random() * 5; lines.push({ x: Math.cos(a) * r, y: Math.sin(a) * r * 0.7, z: -6 - Math.random() * 40 }); }
  sl.setAttribute("position", new THREE.BufferAttribute(slp, 3));
  const speedLines = new THREE.LineSegments(sl, new THREE.LineBasicMaterial({ color: 0xBFF6FF, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  speedLines.frustumCulled = false; camera.add(speedLines);

  return {
    emit,
    burst(pos, kind, tier = 1) {
      if (kind === "land") emit(pos, 14, 0x9FE8FF, 7, 1.2);
      else if (kind === "drift") emit(pos, 18 + tier * 8, tierCol[tier].getHex(), 10, 3);
      else if (kind === "hit") emit(pos, 22, 0xFF4D6D, 9, 3);
      else if (kind === "fire") emit(pos, 40, 0xFFE27A, 14, 5);
      else if (kind === "fail") emit(pos, 10, 0x8888AA, 5, 1);
      else if (kind === "correct") emit(pos, 24, 0x5CFF9D, 9, 5);
    },
    // ground: STAR-01 projected on the road (three space), fwd/right: three-space unit vectors
    update(dt, s) {
      // shadow + landing ring
      shadow.position.copy(s.ground); shadow.position.y += 0.05; shadow.quaternion.copy(s.groundQ).multiply(LAY);
      const h = Math.max(0, s.height), k = Math.max(0.35, 1 - h / 4);
      shadow.scale.setScalar(k); shadow.material.opacity = Math.max(0.15, 0.9 - h / 5); shadow.visible = s.visible;
      ring.visible = s.visible && h > 0.5; if (ring.visible) { ring.position.copy(shadow.position); ring.position.y += 0.02; ring.quaternion.copy(shadow.quaternion); const r = 0.7 + h * 0.6; ring.scale.setScalar(r); ring.material.opacity = Math.min(1, 1.6 - h * 0.35) * (s.falling ? 1 : 0.4); }
      // drift ribbon
      if (s.drifting) {
        ribbonFade = 1; head = (head + 1) % N; const e = hist[head];
        e.p.copy(s.ground); e.p.y += 0.06; e.side.crossVectors(UP, s.fwd).normalize(); e.a = 1;
        if (Math.random() < 0.35 + s.tier * 0.25) { tmpA.copy(s.ground).addScaledVector(e.side, (Math.random() < 0.5 ? -1 : 1) * 0.6); emit(tmpA, 1, tierCol[s.tier].getHex(), 4, 1.5); }
      } else ribbonFade = Math.max(0, ribbonFade - dt * 2.5);
      const c = tierCol[Math.min(3, s.tier)];
      const off = 0.6, hw = 0.1 + 0.05 * s.tier;
      for (let i = 0; i < N; i++) {
        const e = hist[(head - i + N) % N], f = (1 - i / N) * ribbonFade * e.a * 0.8, o = i * 12;
        [-off - hw, -off + hw, off - hw, off + hw].forEach((d, j) => { tmpA.copy(e.p).addScaledVector(e.side, d); const q = o + j * 3; rp[q] = tmpA.x; rp[q + 1] = tmpA.y; rp[q + 2] = tmpA.z; rc[q] = c.r * f; rc[q + 1] = c.g * f; rc[q + 2] = c.b * f; });
      }
      if (!s.drifting && ribbonFade <= 0) for (const e of hist) e.a = 0;
      rib.attributes.position.needsUpdate = true; rib.attributes.color.needsUpdate = true; ribbon.visible = ribbonFade > 0;
      // sparks
      for (let i = 0; i < P; i++) {
        const q = parts[i], o = i * 3;
        if (q.life > 0) { q.life -= dt; q.v.y -= 9 * dt; q.p.addScaledVector(q.v, dt); const f = Math.max(0, q.life / q.max); spp[o] = q.p.x; spp[o + 1] = q.p.y; spp[o + 2] = q.p.z; spc[o] = q.col.r * f; spc[o + 1] = q.col.g * f; spc[o + 2] = q.col.b * f; }
        else { spp[o + 1] = -9999; }
      }
      sp.attributes.position.needsUpdate = true; sp.attributes.color.needsUpdate = true;
      // speed lines
      const amt = Math.min(0.85, Math.max(0, (s.speed01 - 0.72) * 2.6) + (s.boost ? 0.45 : 0)); speedLines.material.opacity = amt; speedLines.visible = amt > 0.02;
      if (speedLines.visible) {
        const v = 30 + 80 * s.speed01, len = 1.5 + 5 * s.speed01;
        lines.forEach((l, i) => { l.z += v * dt; if (l.z > -3) l.z = -40 - Math.random() * 10; const o = i * 6; slp[o] = l.x; slp[o + 1] = l.y; slp[o + 2] = l.z; slp[o + 3] = l.x; slp[o + 4] = l.y; slp[o + 5] = l.z - len; });
        sl.attributes.position.needsUpdate = true;
      }
    },
    hide() { shadow.visible = ring.visible = ribbon.visible = speedLines.visible = false; ribbonFade = 0; for (const e of hist) e.a = 0; for (const q of parts) q.life = 0; },
  };
}
