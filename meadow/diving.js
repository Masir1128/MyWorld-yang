// Swimming within the meadow's lake, using the same player, camera and map.
import * as THREE from 'three';

export function createLakeDiving({ player, keys, lake, water, ground, params, frozen, canControl,
  position, look, updateCharacter, onStart, onNearby = () => {}, onExit = () => {}, splash, ripple, toast, T }) {
  const state = { active: false, rising: false, approach: null, previousCamera: null, returnPoint: null };
  const panel = document.getElementById('divePanel'), action = document.getElementById('diveAction');
  const title = document.getElementById('diveTitle'), hint = document.getElementById('diveHint');
  const depthEl = document.getElementById('diveDepth'), vertical = document.getElementById('diveVertical');
  panel.ariaLabel = T('湖底探索', 'Lake garden exploration');
  const distance = (x = player.x, z = player.z) => Math.hypot(x - lake.x, (z - lake.z) * 1.3);
  const nearby = () => distance() < lake.r + 35 && ground(player.x, player.z) < water + 14;
  let lastUI = -1, wasNearby = false, lastHint = -Infinity;

  function dryShore(p) {
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.z)) return false;
    const h = ground(p.x, p.z);
    return Number.isFinite(h) && h >= water + 0.4 && h < water + 18;
  }
  function findShore(origin) {
    if (dryShore(origin)) return { ...origin };
    let best = null, bestDistance = Infinity;
    // Entry is also allowed while already swimming. Find dry bank rather than
    // remembering an entry position in the middle of the water.
    for (let ring = 0.7; ring <= 1.42; ring += 0.06) for (let i = 0; i < 96; i++) {
      const angle = i / 96 * Math.PI * 2;
      const p = { x: lake.x + Math.cos(angle) * lake.r * ring, z: lake.z + Math.sin(angle) * lake.r * ring / 1.3 };
      const d = (p.x - origin.x) ** 2 + (p.z - origin.z) ** 2;
      if (d < bestDistance && dryShore(p)) {
        p.yaw = Math.atan2(lake.x - p.x, lake.z - p.z); p.pitch = -0.04;
        best = p; bestDistance = d;
      }
    }
    return best;
  }
  function clearDiving() {
    state.active = state.rising = false; state.approach = null;
    if (state.previousCamera !== null) params.camMode = state.previousCamera;
    state.previousCamera = null; state.returnPoint = null;
    player.wade = player.jump = player.vy = player.vx = player.vz = 0;
    keys.clear();
    document.body.classList.remove('diving');
    onExit();
  }
  function finish(onLand = false) {
    const from = { x: player.x, z: player.z };
    const target = (onLand ? findShore(player) : null) || state.returnPoint || findShore(player);
    // A verified dry return point is required before a dive starts.
    if (!target) return;
    player.x = target.x; player.z = target.z;
    player.y = ground(target.x, target.z) + 1.65;
    player.yaw = target.yaw; player.pitch = target.pitch;
    player.swim = false; player.surf = water;
    clearDiving();
    splash(0.45); ripple(from.x, from.z, water, 1.4);
    toast(T('已回到岸边，可以继续散步', 'Back on shore — keep exploring the meadow'));
  }
  function reset() {
    if (!state.active) return;
    // Map/quick-travel owns the next destination; do not override it with a
    // shore return or leave a delayed return that could fire after teleporting.
    player.y = Math.max(ground(player.x, player.z) + 1.65, water + 0.42);
    player.swim = ground(player.x, player.z) < water - 1.25;
    clearDiving();
  }
  function enter() {
    if (state.active || !canControl() || !nearby()) return false;
    if (frozen()) { toast(T('湖面结冰了，等春天再来下潜吧', 'The lake is frozen. Come back to dive in spring.')); return false; }
    const returnPoint = findShore({ x: player.x, z: player.z, yaw: player.yaw, pitch: player.pitch });
    if (!returnPoint) { toast(T('这里暂时没有安全的上岸点，请换一处湖岸下潜', 'No safe return point here. Try another part of the lakeshore.')); return false; }
    onStart(); state.previousCamera = params.camMode; params.camMode = '第一人称';
    state.active = true; state.rising = false; state.returnPoint = returnPoint;
    player.jump = player.vy = player.vx = player.vz = 0;
    const dx = player.x - lake.x, dz = (player.z - lake.z) * 1.3, d = Math.hypot(dx, dz) || 1;
    const radius = Math.min(d, lake.r * 0.54);
    const x = lake.x + dx / d * radius, z = lake.z + dz / d * radius / 1.3;
    state.approach = { t: 0, duration: player.swim ? 1.2 : 2.8,
      from: new THREE.Vector3(player.x, player.y, player.z), to: new THREE.Vector3(x, Math.max(ground(x, z) + 1.2, water - 5), z) };
    player.yaw = Math.atan2(lake.x - player.x, lake.z - player.z); player.pitch = -0.18;
    document.body.classList.add('diving'); splash(0.65);
    toast(T('潜入湖底花园 · 空格上浮 / C 下潜 · E 返回岸边', 'Lake garden · Space up / C down · E return to shore'));
    return true;
  }
  function surface() {
    if (!state.active) return;
    state.rising = true; state.approach = null;
    player.vx = player.vz = 0;
  }
  function toggle() { if (state.active) surface(); else enter(); }
  action.addEventListener('click', toggle);
  for (const [id, code] of [['diveUp', 'Space'], ['diveDown', 'KeyC']]) {
    const button = document.getElementById(id);
    button.addEventListener('pointerdown', e => { e.preventDefault(); keys.add(code); button.setPointerCapture(e.pointerId); });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(event, () => keys.delete(code));
  }

  function update(dt, time) {
    if (!state.active) return false;
    if (frozen()) surface();
    let speed = 0;
    if (!canControl()) { player.vx = player.vz = 0; }
    else if (state.approach) {
      const a = state.approach; a.t = Math.min(1, a.t + dt / a.duration);
      const k = a.t * a.t * (3 - 2 * a.t);
      player.x = THREE.MathUtils.lerp(a.from.x, a.to.x, k); player.z = THREE.MathUtils.lerp(a.from.z, a.to.z, k);
      player.y = Math.max(ground(player.x, player.z) + 0.8, THREE.MathUtils.lerp(a.from.y, a.to.y, k));
      if (a.t >= 1) state.approach = null;
    } else {
      const run = keys.has('ShiftLeft') || keys.has('ShiftRight'), pace = (run ? 7 : 3.5) * params.walkSpeed;
      const forward = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'));
      const side = Number(keys.has('KeyA') || keys.has('ArrowLeft')) - Number(keys.has('KeyD') || keys.has('ArrowRight'));
      const length = Math.max(1, Math.hypot(forward, side)), cp = Math.cos(player.pitch);
      const vx = (Math.sin(player.yaw) * cp * forward + Math.cos(player.yaw) * side) / length * pace;
      const vz = (Math.cos(player.yaw) * cp * forward - Math.sin(player.yaw) * side) / length * pace;
      player.vx += (vx - player.vx) * Math.min(1, dt * 4); player.vz += (vz - player.vz) * Math.min(1, dt * 4);
      const x = player.x + player.vx * dt, z = player.z + player.vz * dt;
      // Deep swimming follows the real lake floor, and rising shores lead back onto land.
      if (distance(x, z) < lake.r + 5) { player.x = x; player.z = z; }
      const up = Number(keys.has('Space')) - Number(keys.has('KeyC') || keys.has('KeyQ'));
      const vy = state.rising ? 6 : up * pace * 0.85 + Math.sin(player.pitch) * forward * pace / length;
      player.y = Math.max(ground(player.x, player.z) + 0.8, Math.min(water + 0.42, player.y + vy * dt));
      speed = Math.hypot(player.vx, player.vz, vy);
      if (ground(player.x, player.z) > water - 1.25) finish(true);
      else if (player.y >= water + 0.24) finish();
    }
    if (state.active) { player.swim = true; player.surf = water; player.wade = 0; }
    player.bob += speed * dt;
    const bob = state.approach || state.rising ? 0 : Math.sin(time * 1.1) * 0.025;
    position.set(player.x, player.y + bob, player.z);
    const cp = Math.cos(player.pitch);
    look.set(player.x + Math.sin(player.yaw) * cp, player.y + bob + Math.sin(player.pitch), player.z + Math.cos(player.yaw) * cp);
    updateCharacter(dt, speed);
    return true;
  }

  function updateUI(time, started, hidden) {
    if (time - lastUI < 0.12) return; lastUI = time;
    const visible = started && !hidden && canControl() && (state.active || nearby());
    panel.hidden = !visible;
    const atEntrance = visible && !state.active;
    if (atEntrance && !wasNearby && !frozen() && time - lastHint >= 45) {
      toast(T('发现水下花园 · 按 E 或点击屏幕下方按钮进入', 'Underwater garden nearby · Press E or use the button below'));
      onNearby(); lastHint = time;
    }
    wasNearby = atEntrance;
    if (!visible) return;
    const depth = Math.max(0, water - player.y);
    title.textContent = state.active ? T('湖底花园', 'Lake garden') : T('这里可以进入水下花园', 'Enter the underwater garden here');
    hint.textContent = state.active
      ? T('WASD 游动 · 空格 上浮 · C / Q 下潜', 'WASD swim · Space up · C / Q down')
      : frozen() ? T('湖面已结冰，春夏秋可以下潜', 'Dive here when the lake thaws') : T('按 E，或点击下方按钮，潜入海藻、珊瑚和沉船之间。', 'Press E or click below to dive among kelp, corals and a shipwreck.');
    depthEl.textContent = state.active ? T(`水深 ${depth.toFixed(1)} 米`, `${depth.toFixed(1)} m deep`) : T('湖底探索', 'UNDERWATER');
    action.textContent = state.active
      ? state.rising ? T('正在上浮并返回岸边…', 'Surfacing and returning to shore…') : T('返回岸边 · E', 'Return to shore · E')
      : T('潜入湖底花园 · E', 'Dive into the lake garden · E');
    action.disabled = state.rising || (!state.active && frozen());
    vertical.hidden = !state.active || !!state.approach || state.rising;
    document.getElementById('diveUp').textContent = T('↑ 上浮', '↑ Swim up');
    document.getElementById('diveDown').textContent = T('↓ 下潜', '↓ Dive down');
  }
  return { state, enter, surface, toggle, reset, update, updateUI, nearby };
}
