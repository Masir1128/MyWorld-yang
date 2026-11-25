// Run with: node --experimental-default-type=module tools/test_underwater.mjs
// Checks swimming transitions and procedural mesh validity without a browser/GPU.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from '../shared/vendor/three/three.module.js';

const root = new URL('../', import.meta.url);
async function load(rel) {
  const path = new URL(rel, root);
  let source = await readFile(path, 'utf8');
  source = source.replace(/from 'three'/g, `from '${new URL('shared/vendor/three/three.module.js', root).href}'`);
  source = source.replace(/from '(\.\/abyssal\/[^']+)'/g, (_, rel) => `from '${new URL(rel, path).href}'`);
  return import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
}
const { createLakeDiving } = await load('meadow/diving.js');
const { createUnderwaterGarden } = await load('meadow/underwater.js');
const elements = new Map();
globalThis.document = {
  getElementById(id) {
    if (!elements.has(id)) elements.set(id, { hidden: true, textContent: '', disabled: false, addEventListener() {} });
    return elements.get(id);
  },
  body: { classList: { add() {}, remove() {} } },
};
const lake = { x: 45, z: 70, r: 80 };
const ground = (x, z) => {
  const d = Math.hypot(x - lake.x, (z - lake.z) * 1.3);
  const k = Math.max(0, Math.min(1, (80 - d) / 38));
  return 2 - 28 * k * k * (3 - 2 * k);
};
function fixture() {
  const player = { x: -40, z: 72, y: ground(-40, 72) + 1.65, yaw: 0, pitch: 0, swim: false, vx: 0, vz: 0, vy: 0, jump: 0, bob: 0 };
  const keys = new Set(), params = { camMode: '第三人称', walkSpeed: 1 }, position = new THREE.Vector3(), look = new THREE.Vector3();
  let ice = false, control = true, started = 0, notified = 0;
  const diving = createLakeDiving({ player, keys, lake, water: 0, ground, params,
    frozen: () => ice, canControl: () => control, position, look,
    updateCharacter() {}, onStart() { started++; }, onNearby() { notified++; }, splash() {}, ripple() {}, toast() {}, T: zh => zh });
  let time = 0;
  const advance = seconds => { for (let n = 0; n < Math.ceil(seconds * 60); n++) { time += 1 / 60; if (!diving.update(1 / 60, time)) break; assert.ok(player.y >= ground(player.x, player.z) + 0.79, 'camera must stay above the floor'); } };
  return { player, keys, params, diving, advance, position,
    setIce(v) { ice = v; }, setControl(v) { control = v; }, get started() { return started; }, get notified() { return notified; } };
}
{
  const f = fixture(); f.player.x = -60;
  f.diving.updateUI(1, true, false);
  assert.equal(elements.get('divePanel').hidden, false, 'the entrance appears before reaching the exact waterline');
  assert.equal(f.notified, 1, 'arriving at the shore produces one entry cue');
  f.diving.updateUI(2, true, false); f.diving.updateUI(3, true, false);
  assert.equal(f.notified, 1, 'the cue does not repeat on every frame');
  f.player.x = -200; f.diving.updateUI(4, true, false);
  assert.equal(elements.get('divePanel').hidden, true);
  f.player.x = -60; f.diving.updateUI(5, true, false);
  assert.equal(f.notified, 1, 'walking across the edge does not spam the cue');
  f.player.x = -200; f.diving.updateUI(50, true, false); f.player.x = -60; f.diving.updateUI(51, true, false);
  assert.equal(f.notified, 2, 'a later return can produce a fresh cue');
  console.log('通过：靠近湖岸即可发现入口，提示音只在到达时触发并限制重复。');
}
{
  const f = fixture(); f.player.x = -200;
  assert.equal(f.diving.enter(), false, 'entry is only available near this lake');
  f.player.x = -40; f.setIce(true);
  assert.equal(f.diving.enter(), false, 'a frozen lake cannot be entered');
  assert.equal(f.started, 0);
  f.setIce(false); const startX = f.player.x, startZ = f.player.z, startYaw = f.player.yaw, startPitch = f.player.pitch;
  assert.equal(f.diving.enter(), true);
  assert.equal(f.diving.enter(), false, 'repeated entry does not restart the approach');
  assert.equal(f.player.x, startX, 'entry starts a smooth movement, not an immediate jump');
  f.advance(3.1);
  assert.equal(f.diving.state.approach, null);
  assert.ok(f.player.y < -4.5);
  assert.equal(f.params.camMode, '第一人称');
  const before = f.player.x; f.keys.add('KeyW'); f.advance(2); f.keys.clear();
  assert.ok(f.player.x > before + 3, 'W swims forward in the camera direction');
  f.keys.add('KeyC'); f.advance(20); f.keys.clear();
  assert.ok(f.player.y < -15, 'the deep part of the garden is reachable');
  assert.ok(f.player.y >= ground(f.player.x, f.player.z) + 0.79);
  const paused = f.player.y; f.setControl(false); f.keys.add('Space'); f.advance(1);
  assert.equal(f.player.y, paused, 'map/free-camera input must not move the swimmer');
  f.setControl(true); f.keys.clear(); f.diving.surface(); f.advance(8);
  assert.equal(f.diving.state.active, false);
  assert.equal(f.params.camMode, '第三人称', 'surfacing restores the previous camera');
  assert.equal(f.player.x, startX, 'surfacing returns to the original bank instead of staying in the lake');
  assert.equal(f.player.z, startZ);
  assert.equal(f.player.yaw, startYaw); assert.equal(f.player.pitch, startPitch);
  assert.ok(ground(f.player.x, f.player.z) >= 0.4, 'return position is dry land');
  assert.equal(f.player.y, ground(f.player.x, f.player.z) + 1.65);
  assert.equal(f.player.swim, false); assert.equal(f.player.vx, 0); assert.equal(f.player.vz, 0); assert.equal(f.keys.size, 0);
  console.log('通过：岸边进入、下潜游动、湖底碰撞、控制暂停；上浮直接回原岸点，恢复朝向及相机并停止游泳。');
}
{
  const f = fixture(); const bank = { x: f.player.x, z: f.player.z };
  f.diving.enter(); f.advance(3.1); f.keys.add('Space'); f.advance(5);
  assert.equal(f.diving.state.active, false);
  assert.equal(f.player.x, bank.x); assert.equal(f.player.z, bank.z); assert.equal(f.player.swim, false);
  const g = fixture(); g.player.x = lake.x; g.player.z = lake.z; g.player.y = 0.42; g.player.swim = true;
  assert.equal(g.diving.enter(), true);
  const expected = { ...g.diving.state.returnPoint };
  assert.ok(ground(expected.x, expected.z) >= 0.4, 'starting in water selects a dry bank before entering');
  g.advance(3.1); g.diving.surface(); g.advance(8);
  assert.equal(g.player.x, expected.x); assert.equal(g.player.z, expected.z); assert.equal(g.player.swim, false);
  console.log('通过：按空格浮出也回到岸边；从湖中央开始下潜时，退出仍返回干燥岸边。');
}
{
  const f = fixture(); f.diving.enter(); f.advance(3.1);
  f.setIce(true); f.advance(5);
  assert.equal(f.diving.state.active, false, 'seasonal ice triggers a safe return to the surface');
  assert.ok(ground(f.player.x, f.player.z) >= 0.4); assert.equal(f.player.swim, false);
  const g = fixture(); g.diving.enter(); g.advance(3.1); g.diving.reset();
  assert.equal(g.diving.state.active, false); assert.equal(g.params.camMode, '第三人称');
  assert.equal(g.diving.state.returnPoint, null);
  g.player.x = -200; g.player.z = 200; g.advance(10);
  assert.equal(g.player.x, -200); assert.equal(g.player.z, 200, 'reset does not trigger a delayed shore return after teleport');
  const h = fixture(); h.diving.enter(); h.advance(3.1);
  h.player.x = -17; h.player.y = ground(h.player.x, h.player.z) + 0.9; h.player.yaw = -Math.PI / 2; h.player.pitch = 0;
  h.keys.add('KeyW'); h.keys.add('ShiftLeft'); h.advance(20);
  assert.equal(h.diving.state.active, false, 'swimming toward a bank leads onto land');
  assert.equal(h.player.swim, false, 'the land exit leaves swimming mode');
  assert.ok(ground(h.player.x, h.player.z) >= 0.4);
  console.log('通过：结冰时回干燥岸边、传送目的地不被覆盖、游向岸边也能退出。');
}
{
  const scene = new THREE.Scene();
  const uniforms = { uTime: { value: 0 }, uNight: { value: 0 }, uSunDir: { value: new THREE.Vector3(-0.3, 0.8, 0.4) } };
  const begin = performance.now();
  const garden = createUnderwaterGarden({ scene, lake, level: 0, ground, uniforms, quality: '高' });
  assert.ok(garden.stats.leaves > 5000); assert.ok(garden.stats.kelp > 30); assert.ok(garden.stats.coral > 100);
  assert.ok(garden.stats.fish > 100); assert.ok(garden.stats.mantas >= 2);
  assert.ok(scene.getObjectByName('Abyssal Garden · 石鲸尾'));
  assert.ok(scene.getObjectByName('Abyssal Garden · 沉船'));
  let meshes = 0;
  garden.root.traverse(o => {
    if (!o.geometry) return;
    meshes++;
    for (const [name, attribute] of Object.entries(o.geometry.attributes)) {
      const data = attribute.isInterleavedBufferAttribute ? attribute.data.array : attribute.array;
      for (let i = 0; i < data.length; i++) assert.ok(Number.isFinite(data[i]), `${o.name} ${name} contains invalid vertices`);
    }
    if (o.geometry.index) {
      const count = o.geometry.attributes.position.count;
      for (const i of o.geometry.index.array) assert.ok(i < count, 'triangle indices stay in range');
    }
  });
  const camera = new THREE.PerspectiveCamera(); camera.position.set(10, -12, 70);
  for (const time of [0, 1, 60, 600]) { uniforms.uTime.value = time; garden.update({ time, camera, night: 0, height: 720 }); }
  garden.root.traverse(o => { if (o.instanceMatrix) for (const v of o.instanceMatrix.array) assert.ok(Number.isFinite(v)); });
  camera.position.set(400, 30, 900); garden.update({ time: 601, camera, night: 0, height: 720 }); assert.equal(garden.root.visible, false);
  console.log(`通过：${meshes} 个几何对象、原版鲸尾/沉船、实例数据、动画更新及远处停绘；构建与检查 ${Math.round(performance.now() - begin)} ms。`);
}
