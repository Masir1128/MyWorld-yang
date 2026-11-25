// Abyssal Garden adapted into the meadow's existing Three.js scene.
// Original procedural meshes: Maksymilian Dendura (MIT), see ./abyssal/LICENSE.
import * as THREE from 'three';
import { rnd, rr, rseed, clamp, qRand } from './abyssal/math.js';
import { meshChunk, meshLathe, meshCoral, meshTubes, meshFluke, meshShip, meshManta, meshFish } from './abyssal/meshes.js';

function geometryFromMesh(source) {
  const mesh = source.vb ? source : source.build();
  const f = new Float32Array(mesh.vb), n = new Int8Array(mesh.vb);
  const pos = new Float32Array(mesh.nv * 3), norm = new Float32Array(mesh.nv * 3), aux = new Float32Array(mesh.nv);
  for (let i = 0; i < mesh.nv; i++) {
    for (let k = 0; k < 3; k++) { pos[i * 3 + k] = f[i * 4 + k]; norm[i * 3 + k] = n[i * 16 + 12 + k] / 127; }
    aux[i] = n[i * 16 + 15] / 127;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
  geo.setAttribute('aAux', new THREE.BufferAttribute(aux, 1));
  geo.setIndex(new THREE.BufferAttribute(mesh.ib, 1));
  geo.computeBoundingSphere();
  return geo;
}

const WATER_LIGHT = /* glsl */`
uniform float uTime, uNight, uLevel;
uniform vec3 uSunDir, uColor;
varying vec3 vWorld, vN, vTint;
varying float vAux;
float caus(vec2 q){
  q += vec2(uTime * 0.16, -uTime * 0.11);
  float a = sin(q.x * 1.7 + sin(q.y * 2.1)) + sin(q.y * 1.4 - cos(q.x * 1.8));
  float b = sin(q.x * 2.3 - uTime * 0.19) + cos(q.y * 2.6 + q.x * 0.7);
  return pow(max(0.0, 1.0 - abs(a + b * 0.5) * 0.75), 9.0);
}
vec3 waterLight(vec3 base, vec3 N, float glow){
  float depth = max(uLevel - vWorld.y, 0.0);
  float day = mix(1.0, 0.27, uNight);
  vec3 sun = normalize(mix(vec3(-0.3, 0.85, 0.4), uSunDir, 0.45));
  float wrap = max(0.0, dot(N, sun) * 0.65 + 0.35);
  float back = pow(max(0.0, dot(-N, sun)), 2.0);
  vec3 attenuation = exp(-depth * vec3(0.050, 0.023, 0.015));
  vec3 col = base * (vec3(0.30, 0.58, 0.64) + vec3(1.7, 1.6, 1.45) * (wrap + back * 0.5)) * attenuation * day;
  col *= 0.60 + 0.40 * clamp(vAux, 0.0, 1.0);
  col += base * caus(vWorld.xz + vWorld.y * 0.22) * 1.8 * max(N.y * 0.65 + 0.35, 0.0) * attenuation * day;
  col += base * glow * (0.25 + 0.8 * uNight);
  vec3 delta = vWorld - cameraPosition;
  float dist = length(delta);
  // Above water, only the submerged part of the viewing ray absorbs light.
  float path = dist * clamp((uLevel - vWorld.y) / max(cameraPosition.y - vWorld.y, 0.001), 0.0, 1.0);
  if(cameraPosition.y < uLevel) path = dist;
  vec3 trans = exp(-path * vec3(0.058, 0.0235, 0.0195));
  vec3 fog = vec3(0.10, 0.43, 0.56) * mix(1.0, 0.23, uNight);
  return col * trans + fog * (1.0 - trans);
}
`;

export function createUnderwaterGarden({ scene, lake, level, ground, uniforms, quality }) {
  const root = new THREE.Group(); root.name = 'Abyssal Garden · 湖底花园';
  const low = quality === '低', countScale = low ? 0.4 : quality === '中' ? 0.65 : 1;
  const u = { uTime: uniforms.uTime, uNight: uniforms.uNight, uSunDir: uniforms.uSunDir, uLevel: { value: level } };
  const materials = [], stats = { kelp: 0, leaves: 0, coral: 0, fish: 0, mantas: 0, drawGroups: 0 };
  const point = (dx, dz) => ({ x: lake.x + dx, z: lake.z + dz / 1.3 });
  const radius = (x, z) => Math.hypot(x - lake.x, (z - lake.z) * 1.3);
  const valid = (x, z, depth = 4) => radius(x, z) < lake.r - 9 && ground(x, z) < level - depth;
  const randomSpot = (depth = 5) => {
    for (let n = 0; n < 80; n++) {
      const a = rr(0, Math.PI * 2), r = Math.sqrt(rnd()) * (lake.r - 13), p = point(Math.cos(a) * r, Math.sin(a) * r);
      if (valid(p.x, p.z, depth)) return p;
    }
    return point(0, 0);
  };
  function material(color, { glow = 0, manta = false, fish = false } = {}) {
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...u, uColor: { value: new THREE.Color(color) }, uGlow: { value: glow } }, side: THREE.DoubleSide,
      vertexShader: /* glsl */`
        uniform float uTime;
        attribute float aAux;
        varying vec3 vWorld, vN, vTint;
        varying float vAux;
        void main(){
          vec3 p = position, nn = normal;
          ${manta ? `float flap = sin(uTime * 1.35 + 0.3) * pow(abs(aAux), 1.55); p.y += flap * 0.27; nn.x -= flap * sign(aAux) * 0.65;` : ''}
          ${fish ? `p.z += sin(uTime * 6.0 + p.x * 7.5) * max(0.0, -p.x + 0.15) * 0.09;` : ''}
          mat4 m = modelMatrix;
          #ifdef USE_INSTANCING
            m = modelMatrix * instanceMatrix;
          #endif
          vTint = vec3(1.0);
          #ifdef USE_INSTANCING_COLOR
            vTint = instanceColor;
          #endif
          vec4 wp = m * vec4(p, 1.0);
          vWorld = wp.xyz; vN = normalize(mat3(m) * nn); vAux = aAux;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: WATER_LIGHT + /* glsl */`
        uniform float uGlow;
        void main(){
          vec3 N = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0);
          vec3 base = uColor * vTint;
          float grain = sin(vWorld.x * 18.0 + sin(vWorld.z * 12.0) * 2.0) * sin(vWorld.y * 24.0) * 0.04;
          base *= 1.0 + grain;
          gl_FragColor = vec4(waterLight(base, N, uGlow), 1.0);
        }`,
    });
    materials.push(mat); return mat;
  }
  const dummy = new THREE.Object3D();
  function instances(geo, mat, list, name) {
    const mesh = new THREE.InstancedMesh(geo, mat, list.length); mesh.name = name;
    list.forEach((p, i) => {
      dummy.position.set(p.x, p.y, p.z);
      if (p.q) dummy.quaternion.fromArray(p.q); else dummy.rotation.set(p.rx || 0, p.yaw || 0, p.rz || 0);
      dummy.scale.set(p.sx || p.s || 1, p.sy || p.s || 1, p.sz || p.s || 1);
      dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
      if (p.color) mesh.setColorAt(i, new THREE.Color(p.color));
    });
    mesh.computeBoundingSphere(); root.add(mesh); stats.drawGroups++;
    return mesh;
  }

  // Preserve the original shell profiles, branched corals and carved ship/whale geometry.
  const spongeProfiles = [
    [[0, 0, 0.5], [0.34, 0, 0.6], [0.5, 0.2, 0.85], [0.6, 0.6, 1], [0.55, 0.95, 1], [0.47, 1.08, 1], [0.38, 1.1, 0.9], [0.3, 1.0, 0.45], [0.26, 0.6, 0.15], [0, 0.35, 0.05]],
    [[0, 0, 0.5], [0.2, 0, 0.6], [0.26, 0.5, 0.85], [0.4, 1.25, 1], [0.4, 1.42, 1], [0.33, 1.48, 0.9], [0.26, 1.38, 0.4], [0.18, 0.8, 0.12], [0, 0.5, 0.05]],
    [[0, 0, 0.5], [0.5, 0, 0.7], [0.72, 0.18, 1], [0.74, 0.38, 1], [0.62, 0.5, 0.9], [0.48, 0.42, 0.45], [0.4, 0.2, 0.15], [0, 0.14, 0.06]],
  ];
  const propGeo = spongeProfiles.map(p => geometryFromMesh(meshLathe(p, 18, 0.3, 9)));
  propGeo.push(geometryFromMesh(meshCoral(0, low)), geometryFromMesh(meshCoral(1, low)), geometryFromMesh(meshTubes()));
  const colors = ['#d8a476', '#bd90b5', '#afbb98', '#d985ab', '#b3a0ea', '#55bcad'];
  const gardens = [point(-5, 7), point(25, 18), point(-25, -24), point(8, -29)];
  for (let type = 0; type < propGeo.length; type++) {
    rseed(30 + type); const list = [];
    for (let i = 0; i < 115 * countScale; i++) {
      let p;
      if (i < 65 * countScale) {
        const c = gardens[i % gardens.length], a = rr(0, 6.283), r = rr(1, 11);
        p = { x: c.x + Math.cos(a) * r, z: c.z + Math.sin(a) * r / 1.3 };
      } else p = randomSpot(6);
      if (!valid(p.x, p.z, 5)) continue;
      list.push({ ...p, y: ground(p.x, p.z) + 0.05, s: rr(0.55, type < 3 ? 1.8 : 2.5), yaw: rr(0, 6.283), rx: rr(-0.16, 0.16), color: colors[(type + i % 2) % colors.length] });
    }
    stats.coral += list.length;
    instances(propGeo[type], material('#ffffff', { glow: type > 2 ? 0.16 : 0.03 }), list, '珊瑚与桶状海绵 ' + type);
  }
  for (let type = 0; type < 3; type++) {
    const geo = geometryFromMesh(meshChunk(1 + type * 9, 2)), list = []; rseed(45 + type);
    for (let i = 0; i < 220 * countScale; i++) {
      const p = randomSpot(4), s = i < 25 ? rr(1.0, 3.2) : rr(0.12, 0.9);
      list.push({ ...p, y: ground(p.x, p.z) + s * 0.2, s, q: qRand() });
    }
    instances(geo, material('#a6b3a7'), list, '湖底岩石 ' + type);
  }
  // Rock arches frame the same lake basin, with traversable openings.
  const archGeo = new THREE.TorusGeometry(4.5, 0.95, 9, 36);
  const arch = point(18, -13);
  const archMesh = new THREE.Mesh(archGeo, material('#8dada4'));
  archMesh.position.set(arch.x, ground(arch.x, arch.z) + 2.1, arch.z);
  archMesh.rotation.y = 0.9; root.add(archMesh);
  const whale = point(-4, 5), fluke = new THREE.Mesh(geometryFromMesh(meshFluke()), material('#a4b8aa'));
  fluke.name = 'Abyssal Garden · 石鲸尾';
  fluke.position.set(whale.x, ground(whale.x, whale.z) + 0.7, whale.z);
  fluke.rotation.set(-0.16, 1.2, 0.1); fluke.scale.setScalar(0.78); root.add(fluke);
  const wreck = point(28, 13), ship = new THREE.Mesh(geometryFromMesh(meshShip()), material('#826746'));
  ship.name = 'Abyssal Garden · 沉船'; ship.scale.setScalar(0.57);
  ship.position.set(wreck.x, ground(wreck.x, wreck.z) + 4.1, wreck.z); ship.rotation.set(0.16, -0.7, -0.12); root.add(ship);

  // Kelp columns use the original multi-strand helix and ribbon-leaf distribution.
  // Packed into two instanced draws rather than thousands of individual objects.
  const leaves = [], glints = [];
  function leaf(x, y, z, len, yaw, tilt, width, anchorHeight, type, s1, s2, bend) {
    leaves.push(x, y, z, len, yaw, tilt, width, anchorHeight, type, s1, s2, bend);
  }
  function column(x, y, z, H, kind) {
    const strands = 2 + (rnd() < 0.6) + (rnd() < 0.3), ph = rr(0, 6.283), tw = rr(0.1, 0.28), sr = rr(0.2, 0.55), sc = rr(0.75, 1.25);
    const la = rr(0, 6.283), lm = rr(0, 0.11);
    const stem = (s, h) => { const a = ph + s * 6.283 / strands + h * tw, r = sr * (1 - 0.6 * h / H), ln = lm * h * h / H; return [x + Math.cos(a) * r + Math.cos(la) * ln, z + Math.sin(a) * r + Math.sin(la) * ln, a]; };
    for (let s = 0; s < strands; s++) for (let h = 0; h < H - 1; h += 1.7) { const p = stem(s, h); leaf(p[0], y + h, p[1], 2.1, p[2] + Math.PI / 2, 0.1, 0.11, h, 1, rnd(), rnd(), 0.3); }
    for (let i = 0, n = Math.floor(H * 13 * rr(0.7, 1.2)); i < n; i++) {
      const t = rnd() ** 0.9, h = t * H, p = stem(Math.floor(rnd() * strands), h);
      const L = ((0.55 + 0.75 * rnd() ** 2) * (1 - 0.5 * t * t) * sc + 0.25) * 1.15;
      leaf(p[0], y + h, p[1], L, rr(0, 6.283), (1 - t) * rr(0.4, 1) + t * rr(0.15, 0.45), L * rr(0.14, 0.23), h, kind, rnd(), rnd(), rr(0.38, 0.95));
    }
    for (let i = 0; i < H * 1.6; i++) { const h = rnd() * H, p = stem(i % strands, h); glints.push(p[0], y + h, p[1], rnd()); }
  }
  rseed(2);
  for (let i = 0; i < 200 * countScale; i++) {
    const p = randomSpot(6), dx = p.x - whale.x, dz = p.z - whale.z;
    // Keep a quiet clearing in front of the whale and beside the wreck.
    if (Math.hypot(dx, dz) < 7 || (dx < 0 && dx > -26 && Math.abs(dz) < 4) || Math.hypot(p.x - wreck.x, p.z - wreck.z) < 10) continue;
    const y = ground(p.x, p.z), H = Math.min(level - y - rr(1.2, 3), rr(8, 22));
    if (H < 4) continue;
    column(p.x, y, p.z, H, p.z < lake.z - 15 ? (rnd() < 0.5 ? 3 : 4) : 0);
    stats.kelp++;
  }
  // Teal and magenta ground cover in the purple garden.
  for (let i = 0; i < 650 * countScale; i++) {
    const p = randomSpot(5), y = ground(p.x, p.z);
    for (let k = 0; k < 7; k++) leaf(p.x + rr(-0.45, 0.45), y, p.z + rr(-0.45, 0.45), rr(0.6, 2.4), rr(0, 6.283), rr(0.05, 0.6), rr(0.12, 0.24), 1.5, p.z < lake.z - 10 ? 5 : 2, rnd(), rnd(), rr(0.3, 0.8));
  }
  stats.leaves = leaves.length / 12;
  const ribbon = new THREE.PlaneGeometry(2, 1, 1, 6); ribbon.translate(0, 0.5, 0);
  const leafGeo = new THREE.InstancedBufferGeometry(); leafGeo.index = ribbon.index;
  leafGeo.attributes.position = ribbon.attributes.position; leafGeo.attributes.uv = ribbon.attributes.uv;
  const leafData = new Float32Array(leaves), leafBuffer = new THREE.InstancedInterleavedBuffer(leafData, 12);
  leafGeo.setAttribute('aOrigin', new THREE.InterleavedBufferAttribute(leafBuffer, 4, 0));
  leafGeo.setAttribute('aShape', new THREE.InterleavedBufferAttribute(leafBuffer, 4, 4));
  leafGeo.setAttribute('aStyle', new THREE.InterleavedBufferAttribute(leafBuffer, 4, 8));
  leafGeo.instanceCount = stats.leaves;
  const leafMat = new THREE.ShaderMaterial({
    uniforms: { ...u, uColor: { value: new THREE.Color('#ffffff') } }, side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      uniform float uTime;
      attribute vec4 aOrigin, aShape, aStyle;
      varying vec3 vWorld, vN, vTint;
      varying float vAux, vType;
      void main(){
        float v = uv.y, side = position.x, ty = aStyle.x, s1 = aStyle.y, s2 = aStyle.z;
        float yaw = aShape.x, tilt = aShape.y, h = aShape.w;
        vec3 dir = vec3(sin(tilt) * cos(yaw), cos(tilt), sin(tilt) * sin(yaw));
        vec3 pe = vec3(cos(tilt) * cos(yaw), -sin(tilt), cos(tilt) * sin(yaw));
        vec3 sd = vec3(-sin(yaw), 0.0, cos(yaw));
        float bend = (aStyle.w - 0.3) * 2.0 + sin(uTime * (0.8 + s1) + s2 * 40.0 + h * 0.25) * 0.10;
        float ka = max(0.06, bend * 1.7), sk = sin(ka * v), ck = cos(ka * v);
        float wv = sin(v * (3.0 + 5.0 * s2) + s1 * 30.0 + uTime * 1.1) * 0.17;
        vec3 p = aOrigin.xyz + aOrigin.w * (dir * sk / ka + pe * ((1.0 - ck) / ka + wv * v));
        float shape = pow(max(0.0, sin(3.14159 * pow(v, 0.6))), 0.55);
        if(ty > 0.5 && ty < 1.5) shape = 1.0;
        float tw = (s1 - 0.5) * 2.4 * v + sin(uTime * 0.9 + s2 * 20.0) * 0.25 * v;
        vec3 lateral = sd * cos(tw) + pe * sin(tw);
        p += lateral * side * aShape.z * shape * 0.65;
        float H = h + p.y - aOrigin.y;
        p.x += sin(uTime * 0.48 + aOrigin.z * 0.06 + H * 0.13) * H * 0.025;
        p.z += cos(uTime * 0.38 + aOrigin.x * 0.05 + H * 0.10) * H * 0.02;
        vWorld = p; vN = normalize(pe * cos(tw) - sd * sin(tw) - dir * wv);
        vTint = mix(vec3(0.075, 0.14, 0.032), vec3(0.27, 0.21, 0.035), step(0.72, s2));
        if(ty > 1.5) vTint = vec3(0.06, 0.28, 0.22);
        if(ty > 2.5) vTint = mix(vec3(0.035, 0.10, 0.12), vec3(0.25, 0.17, 0.025), step(3.5, ty));
        if(ty > 4.5) vTint = mix(vec3(0.65, 0.06, 0.36), vec3(0.35, 0.08, 0.75), step(0.7, s1));
        vAux = 0.85 + 0.15 * v; vType = ty;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: WATER_LIGHT + /* glsl */`
      varying float vType;
      void main(){
        vec3 N = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0);
        gl_FragColor = vec4(waterLight(vTint, N, vType > 4.5 ? 0.55 : 0.035), 1.0);
      }`,
  });
  const forest = new THREE.Mesh(leafGeo, leafMat); forest.frustumCulled = false; forest.name = 'Abyssal Garden · 海藻森林'; root.add(forest);

  const fishGeo = geometryFromMesh(meshFish()), fishCount = Math.floor(700 * countScale), fishData = [];
  const schools = [point(-14, 7), point(16, -10), point(26, 25), point(-21, -27)];
  rseed(14);
  for (let i = 0; i < fishCount; i++) fishData.push({ c: schools[i % schools.length], phase: rr(0, 6.283), r: rr(3.5, 9), h: rr(3, 11), s: rr(0.25, 0.60), turn: i % 2 ? 1 : -1 });
  const fishMesh = instances(fishGeo, material('#bad6ce', { fish: true }), fishData.map(f => ({ x: f.c.x, y: -8, z: f.c.z, s: f.s })), 'Abyssal Garden · 鱼群');
  fishMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); fishMesh.frustumCulled = false; stats.fish = fishCount;
  const mantaGeo = geometryFromMesh(meshManta()), mantas = [];
  for (let i = 0; i < (low ? 2 : 4); i++) {
    const m = new THREE.Mesh(mantaGeo, material(i % 2 ? '#53838b' : '#6ca5ad', { manta: true }));
    m.name = 'Abyssal Garden · 蝠鲼 ' + (i + 1); m.scale.setScalar(1.8 + i * 0.35); root.add(m); mantas.push(m);
  }
  stats.mantas = mantas.length;

  // Shared GPU particle draw: bubbles, drifting marine snow and kelp glints.
  const particles = [], styles = [], particleCount = low ? 1100 : 2400;
  rseed(16);
  for (let i = 0; i < particleCount; i++) {
    const p = randomSpot(5), y = ground(p.x, p.z), bubble = i % 4 === 0;
    particles.push(p.x, y, p.z, Math.max(1, level - y - 0.5)); styles.push(rnd(), bubble ? rr(0.06, 0.17) : rr(0.025, 0.055), bubble ? 1 : 0, rr(0.2, 0.9));
  }
  for (let i = 0; i < glints.length; i += 4) { particles.push(glints[i], glints[i + 1], glints[i + 2], 0); styles.push(glints[i + 3], rr(0.02, 0.045), 2, 0); }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(particles.length / 4 * 3), 3));
  pg.setAttribute('aOrigin', new THREE.Float32BufferAttribute(particles, 4)); pg.setAttribute('aStyle', new THREE.Float32BufferAttribute(styles, 4));
  const particleMat = new THREE.ShaderMaterial({
    uniforms: { ...u, uPixelRatio: { value: 600 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      uniform float uTime, uPixelRatio;
      attribute vec4 aOrigin, aStyle;
      varying float vKind, vAlpha;
      void main(){
        vec3 p = aOrigin.xyz;
        if(aStyle.z < 1.5) p.y += mod(aStyle.x * aOrigin.w + uTime * aStyle.w, aOrigin.w);
        p.x += sin(uTime * 0.4 + aStyle.x * 20.0) * 0.22;
        p.z += cos(uTime * 0.35 + aStyle.x * 24.0) * 0.18;
        vec4 mv = viewMatrix * vec4(p, 1.0); float d = length(mv.xyz);
        gl_Position = projectionMatrix * mv; gl_PointSize = clamp(aStyle.y * uPixelRatio / max(1.0, -mv.z), 1.0, 28.0);
        vKind = aStyle.z; vAlpha = exp(-d * 0.04) * (0.4 + 0.3 * sin(uTime + aStyle.x * 30.0));
      }`,
    fragmentShader: `varying float vKind, vAlpha;
      void main(){
        float r = length(gl_PointCoord - 0.5) * 2.0; if(r > 1.0) discard;
        float a = vKind > 0.5 && vKind < 1.5 ? pow(r, 3.0) * (1.0 - smoothstep(0.8, 1.0, r)) : pow(1.0 - r, 2.0);
        vec3 col = vKind > 1.5 ? vec3(0.65, 0.9, 0.28) : vec3(0.3, 0.7, 0.8);
        gl_FragColor = vec4(col * a * vAlpha, a * vAlpha);
      }`,
  });
  const points = new THREE.Points(pg, particleMat); points.frustumCulled = false; root.add(points);
  // A water-coloured background and soft shafts are only visible below the surface.
  const underwaterOnly = new THREE.Group(); underwaterOnly.visible = false; root.add(underwaterOnly);
  const domeMat = new THREE.ShaderMaterial({
    uniforms: u, side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uNight, uTime; varying vec3 vDir; void main(){ vec3 d = normalize(vDir); vec3 col = mix(vec3(0.025, 0.12, 0.20), vec3(0.12, 0.48, 0.62), smoothstep(-0.6, 0.8, d.y)); col += vec3(0.06, 0.12, 0.13) * pow(max(0.0, dot(d, normalize(vec3(-0.3, 0.8, 0.4)))), 12.0); gl_FragColor = vec4(col * mix(1.0, 0.22, uNight), 1.0); }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(240, 24, 16), domeMat); dome.renderOrder = -5; dome.frustumCulled = false; underwaterOnly.add(dome);
  const rayGeo = new THREE.PlaneGeometry(1, 1); rayGeo.translate(0, 0.5, 0);
  const rayMat = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vUv; void main(){vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);}',
    fragmentShader: `uniform float uTime, uNight; varying vec2 vUv; void main(){ float a = pow(max(0.0, sin(vUv.x * 3.14159)), 3.0) * sin(vUv.y * 3.14159) * (0.8 + 0.2 * sin(uTime * 0.4 + vUv.y * 10.0)); gl_FragColor = vec4(vec3(0.1, 0.28, 0.25) * a, a * 0.08 * mix(1.0, 0.18, uNight)); }`,
  });
  const rays = [];
  for (let i = 0; i < (low ? 7 : 14); i++) {
    const p = randomSpot(10), mesh = new THREE.Mesh(rayGeo, rayMat), depth = level - ground(p.x, p.z);
    mesh.position.set(p.x, level - depth, p.z); mesh.scale.set(rr(1.1, 3.2), depth - 0.2, 1); mesh.rotation.z = -0.18; underwaterOnly.add(mesh); rays.push(mesh);
  }
  scene.add(root);

  let lastFish = -1;
  return {
    root, stats, whale, wreck, materials,
    update({ time, camera, height }) {
      const dist = Math.hypot(camera.position.x - lake.x, camera.position.z - lake.z);
      root.visible = dist < 220;
      if (!root.visible) return;
      const under = radius(camera.position.x, camera.position.z) < lake.r + 8 && camera.position.y < level - 0.08;
      underwaterOnly.visible = under;
      if (under) { dome.position.copy(camera.position); rays.forEach(m => { m.rotation.y = Math.atan2(camera.position.x - m.position.x, camera.position.z - m.position.z); }); }
      // Particles near the surface are hidden from land, preserving the quiet meadow.
      points.visible = under || camera.position.y < level + 5;
      particleMat.uniforms.uPixelRatio.value = height;
      mantas.forEach((m, i) => {
        const a = time * (i % 2 ? -0.09 : 0.065) + i * 1.7, r = 12 + i * 5;
        const x = lake.x + Math.sin(a) * r, z = lake.z + Math.cos(a) * r / 1.3;
        m.position.set(x, Math.max(ground(x, z) + 4, level - 7 - i * 1.6), z);
        m.rotation.set(Math.sin(a * 1.7) * 0.04, a + Math.PI / 2, Math.sin(time * 0.6 + i) * 0.07);
      });
      // 20 Hz is enough for the distant schools; foreground foliage animates on the GPU.
      if (time - lastFish > 0.05) {
        lastFish = time;
        fishData.forEach((f, i) => {
          const a = f.phase + time * 0.10 * f.turn, x = f.c.x + Math.cos(a) * f.r, z = f.c.z + Math.sin(a) * f.r / 1.3;
          dummy.position.set(x, clamp(ground(x, z) + f.h + Math.sin(time * 0.6 + f.phase) * 0.3, level - 21, level - 2), z);
          dummy.rotation.set(0, -a - (f.turn < 0 ? Math.PI / 2 : -Math.PI / 2), Math.sin(a * 2.1) * 0.04); dummy.scale.setScalar(f.s); dummy.updateMatrix(); fishMesh.setMatrixAt(i, dummy.matrix);
        });
        fishMesh.instanceMatrix.needsUpdate = true;
      }
    },
  };
}
