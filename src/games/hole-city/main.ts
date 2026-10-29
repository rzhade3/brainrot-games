import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import './style.css';
import { beginFall, advanceFall, type Falling, city, MILESTONES, growthStage, spawnPoints, swallow, canSwallow, matchResult, rivalDirection, move, radiusFor, type FinishReason, type Hole, type Item } from './engine';
import { getBestScore, submitScore } from '../../core/scores';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `<header><a href="/">↖ <span>THE ARCADE</span></a><div class="brand">hole<span>city</span><i></i></div><button id="pause" aria-label="Pause game">II</button></header>
<main><canvas id="world" aria-label="Hole City 3D game. Move with arrow keys, WASD, or drag on the city."></canvas>
<div class="top"><div class="district"><span class="live"></span> DOWNTOWN <small>2 MINUTE FEAST · 6 HOLES</small></div><div class="clock"><small>TIME LEFT</small><b id="time">2:00</b></div></div>
<aside><h2>THE BIG EATERS <span>↗</span></h2><ol id="leaders"></ol><p>LOCAL MATCH · AI RIVALS</p></aside>
<div class="bottom"><div class="growth"><div><strong id="level">A small appetite</strong><span id="score">0 pts</span></div><div class="track"><i id="progress"></i></div><small id="target">NEXT ON THE MENU: TREES</small></div><div class="control-hint"><kbd>W A S D</kbd><span>or drag to move</span><span>Gold props: edible · Mint ring: prey · Red ring: danger</span></div></div>
<div id="toast" role="status"></div><div id="bites" aria-live="off"></div><div id="rival-hint"></div><div id="joystick"><i></i></div>
<div class="veil" id="overlay"><section><span class="eyebrow">SMALL HOLE. BIG PLANS.</span><h1>The city is<br>on the menu<span>.</span></h1><p>Follow the sidewalk snacks into parks and traffic. Grow from street snacks to whole skyscrapers. Biggest score in two minutes wins.</p><div class="instructions"><span>01 <b>Move</b> with WASD, arrows, or drag</span><span>02 <b>Eat</b> hold underneath until it drops</span><span>03 <b>Grow</b> to the top in two minutes</span></div><button class="primary" id="play">Let's eat <span>↗</span></button><small id="best">PERSONAL BEST · ${getBestScore('hole-city-classic-v2')} PTS</small></section></div>
</main><footer><span>A LITTLE CHAOS. A LOT OF APPETITE.</span><span>HOLE CITY <b> / </b> 01</span></footer>`;
const $ = (id: string) => document.getElementById(id)!;
const canvas = $('world') as HTMLCanvasElement;
let renderer: THREE.WebGLRenderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); }
catch { $('overlay').innerHTML = '<section><h1>Graphics unavailable</h1><p>Hole City needs WebGL. Try a browser with hardware acceleration enabled.</p><a href="/">Back to arcade</a></section>'; throw new Error('WebGL unavailable'); }
renderer.localClippingEnabled = true;
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0xcbd9cb); renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0xcbd9cb, 100, 210);
const camera = new THREE.PerspectiveCamera(40, 1, .1, 300);
scene.add(new THREE.HemisphereLight(0xffffff, 0x7d9582, 2.5));
const sun = new THREE.DirectionalLight(0xfff5df, 3.1); sun.position.set(-35, 65, 20); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -85, right: 85, top: 85, bottom: -85, far: 160 }); sun.shadow.bias = -.001; scene.add(sun);
const mats = new Map<number, THREE.MeshStandardMaterial>();
function mat(color: number, clipped = true) {
  const key = color + (clipped ? 0x1000000 : 0);
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({
    color, roughness: .85,
    clippingPlanes: clipped ? [new THREE.Plane(new THREE.Vector3(0, 1, 0), -.18)] : []
  }));
  return mats.get(key)!;
}
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
function box(parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, color: number) {
  const mesh = new THREE.Mesh(boxGeo, mat(color, parent !== scene)); mesh.position.set(x, y, z); mesh.scale.set(w, h, d); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
box(scene, 0, -.6, 0, 212, 1, 212, 0xa8bc9a);
box(scene, 0, -.09, 0, 158, .1, 158, 0x71817c);
for (let x = -60;x <= 60;x += 30) for (let z = -60;z <= 60;z += 30) {
  box(scene, x, .04, z, 26.4, .24, 26.4, 0xd9d9c8);
  for (let t = -8;t <= 8;t += 5) { box(scene, x + t, .02, z + 15, 2, .02, .16, 0xe6ddac); box(scene, x + 15, .02, z + t, .16, .02, 2, 0xe6ddac); }
  for (let t = -2;t <= 2;t++) { box(scene, x + 13.9, .03, z + 15 + t * .65, 1.2, .02, .3, 0xf1f0df); }
}
// Batch repeated pieces by material to keep city draw calls manageable on phones.
function batch(parent: THREE.Object3D) {
  const groups = new Map<THREE.Material, { meshes: THREE.Mesh[]; geometries: THREE.BufferGeometry[] }>();
  for (const child of [...parent.children]) {
    if (!(child instanceof THREE.Mesh) || Array.isArray(child.material)) continue;
    child.updateMatrix();
    const group = groups.get(child.material) ?? { meshes: [], geometries: [] };
    group.meshes.push(child); group.geometries.push(child.geometry.clone().applyMatrix4(child.matrix));
    groups.set(child.material, group);
  }
  for (const [material, group] of groups) {
    const geometry = mergeGeometries(group.geometries);
    if (geometry) {
      group.meshes.forEach(mesh => parent.remove(mesh));
      const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = parent !== scene; mesh.receiveShadow = true; parent.add(mesh);
    }
    group.geometries.forEach(geometry => geometry.dispose());
  }
}
for (const side of [-1, 1]) for (const z of [-60, -20, 20, 60])
  box(scene, side * 84, .04, z, 16, .24, 19, 0xd9d9c8);
batch(scene);
const objects = new THREE.Group(); scene.add(objects);
let items: Item[] = []; let meshes: THREE.Group[] = [];
const propTemplates = new Map<string, THREE.Group>();
const palettes = [0xd5a287, 0xe5ca9f, 0xa4bbc0, 0xb3b6c9, 0xc5ad94, 0xe6d6b3];
function makeItem(item: Item, index: number) {
  const prop = !['house', 'tower', 'landmark'].includes(item.kind), key = `${item.kind}:${index % 12}`;
  const template = propTemplates.get(key);
  if (prop && template) { const clone = template.clone(); clone.position.set(item.x, .2, item.z); return clone; }
  const g = new THREE.Group(); g.position.set(item.x, .2, item.z);
  const color = palettes[index % palettes.length];
  if (item.kind === 'house' || item.kind === 'tower' || item.kind === 'landmark') {
    const tall = item.kind !== 'house', w = item.size * 1.25, h = item.kind === 'landmark' ? 25 + index % 6 : tall ? 13 + index % 6 : 5 + index % 3;
    box(g, 0, h / 2, 0, w, h, w, color); box(g, 0, h + .18, 0, w + .3, .35, w + .3, 0xf1ead9);
    box(g, .7, h + .6, .6, 1.4, .8, 1.5, 0x8b9c9b);
    if (item.kind === 'landmark') { box(g, 0, h + 2.5, 0, w * .6, 4, w * .6, 0xe4bd6d); box(g, 0, h + 5, 0, .25, 3, .25, 0x617c83); }
    for (let y = 1.8;y < h - .5;y += 2) for (const a of [-1.4, 1.4]) {
      box(g, a, y, w / 2 + .01, .85, 1, .03, 0x617c83); box(g, w / 2 + .01, y, a, .03, 1, .85, 0x617c83);
    }
    box(g, 0, .8, w / 2 + .03, .9, 1.5, .06, 0x475b60);
  } else if (item.kind === 'tree') {
    box(g, 0, 1, 0, .35, 2, .35, 0x8b7050);
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.55, 0), mat(index % 2 ? 0x6c9568 : 0x87a96d)); crown.position.y = 2.7; crown.castShadow = true; g.add(crown);
  } else if (item.kind === 'car') {
    box(g, 0, .55, 0, 1.5, .75, 3.2, [0xe7aa64, 0xdf7968, 0xe7e6d7, 0x719baf][index % 4]); box(g, 0, 1.1, -.1, 1.25, .65, 1.6, 0xb7d5d7);
    for (const x of [-.8, .8]) for (const z of [-1, 1]) box(g, x, .35, z, .2, .5, .6, 0x344448);
  } else if (item.kind === 'person') {
    box(g, 0, .55, 0, .45, .8, .4, [0xe7b95f, 0xdd806e, 0x647ba1][index % 3]); box(g, 0, 1.15, 0, .38, .38, .38, 0xf2ceb0);
  } else { box(g, 0, .45, 0, .7, .9, .7, 0x557d71); box(g, 0, .95, 0, .85, .12, .85, 0x3a5c54); }
  batch(g); if (prop) propTemplates.set(key, g.clone()); else objects.add(g); return g;
}
// Shared prop geometry is drawn in batches; only consumed instances need matrix updates.
interface PropInstance { mesh: THREE.InstancedMesh; index: number; local: THREE.Matrix4 }
let propInstances: PropInstance[][] = [];
let propBatches: THREE.InstancedMesh[] = [];
const instanceMatrix = new THREE.Matrix4();
function buildPropInstances() {
  const groups = new Map<THREE.BufferGeometry, { material: THREE.Material; entries: { item: number; local: THREE.Matrix4 }[] }>();
  propInstances = items.map(() => []);
  meshes.forEach((model, item) => {
    if (['house', 'tower', 'landmark'].includes(items[item].kind)) return;
    for (const child of model.children) {
      if (!(child instanceof THREE.Mesh) || Array.isArray(child.material)) continue;
      child.updateMatrix(); const group = groups.get(child.geometry) ?? { material: child.material, entries: [] as { item: number; local: THREE.Matrix4 }[] };
      group.entries.push({ item, local: child.matrix.clone() }); groups.set(child.geometry, group);
    }
  });
  for (const [geometry, group] of groups) {
    const mesh = new THREE.InstancedMesh(geometry, group.material, group.entries.length);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
    group.entries.forEach((entry, index) => propInstances[entry.item].push({ mesh, index, local: entry.local }));
    objects.add(mesh); propBatches.push(mesh);
  }
  meshes.forEach((_, index) => syncProp(index));
}
function syncProp(index: number) {
  const model = meshes[index]; model.updateMatrix();
  for (const instance of propInstances[index] ?? []) {
    instanceMatrix.multiplyMatrices(model.matrix, instance.local);
    instance.mesh.setMatrixAt(instance.index, instanceMatrix); instance.mesh.instanceMatrix.needsUpdate = true;
  }
}
const names = ['You', 'Munch', 'Big Sip', 'Void', 'Crumb', 'The Sink'];
const colors = [0xf4b947, 0xe68c8f, 0x8e91cb, 0x78bcca, 0xd4d885, 0xbb88b4];
let holes: Hole[] = []; let holeMeshes: THREE.Group[] = [];
const discGeo = new THREE.CircleGeometry(1, 64), ringGeo = new THREE.RingGeometry(1, 1.11, 64);
function makeHole(hole: Hole) {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ color: 0x17252a })); disc.rotation.x = -Math.PI / 2; g.add(disc);
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: hole.color, side: THREE.DoubleSide, depthTest: false })); ring.renderOrder = 3; ring.rotation.x = -Math.PI / 2; ring.position.y = .02; g.add(ring); scene.add(g); return g;
}
let state: 'ready' | 'playing' | 'paused' | 'over' = 'ready', remaining = 120, eaten = 0, toastTime = 0, lastTier = 0;

const sinking = new Map<number, Falling>();
let biteCount = 0, bitePoints = 0, biteTime = 0, cuesElapsed = 0;
const cueGeometry = new THREE.RingGeometry(.85, 1, 24);
const cueMaterial = new THREE.MeshBasicMaterial({ color: 0xf1c260, side: THREE.DoubleSide, transparent: true, opacity: .65, depthWrite: false });
const cues = new THREE.InstancedMesh(cueGeometry, cueMaterial, 32); cues.count = 0; cues.frustumCulled = false; scene.add(cues);
const cueTransform = new THREE.Object3D();
function updateCues() {
  const player = holes[0]; let count = 0;
  const nearby = items.filter(item => !item.eaten && !item.falling && item.size < player.radius && Math.hypot(item.x - player.x, item.z - player.z) < player.radius + 18)
    .sort((a, b) => Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z));
  for (const item of nearby.slice(0, 32)) {
    cueTransform.position.set(item.x, .205, item.z); cueTransform.rotation.set(-Math.PI / 2, 0, 0); cueTransform.scale.setScalar(Math.max(.65, item.size * .8)); cueTransform.updateMatrix(); cues.setMatrixAt(count++, cueTransform.matrix);
  }
  cues.count = player.respawn > 0 ? 0 : count; cues.instanceMatrix.needsUpdate = true;
}
function registerBite(points: number) {
  if (biteTime <= 0) { biteCount = 0; bitePoints = 0; }
  biteCount++; bitePoints += points; biteTime = 1.7;
  $('bites').textContent = `+${bitePoints}  ·  ${biteCount} ${biteCount === 1 ? 'BITE' : 'BITES'}`;
}
function reset() {
  for (const mesh of propBatches) { objects.remove(mesh); mesh.dispose(); } propBatches = []; propTemplates.clear();
  sinking.clear(); biteCount = 0; bitePoints = 0; biteTime = 0; cues.count = 0;
  for (const m of meshes) { objects.remove(m); m.traverse(child => { if (child instanceof THREE.Mesh) child.geometry.dispose(); }); } for (const m of holeMeshes) scene.remove(m);
  items = city(crypto.getRandomValues(new Uint32Array(1))[0]); meshes = items.map(makeItem); buildPropInstances();
  holes = names.map((name, i) => ({ name, color: colors[i], x: spawnPoints[i].x, z: spawnPoints[i].z, score: 0, radius: radiusFor(0), respawn: 0 }));
  holeMeshes = holes.map(makeHole); remaining = 120; eaten = 0; lastTier = 0;
}
reset();
const keys = new Set<string>(); let pointer: number | null = null, origin = { x: 0, y: 0 }, stick = { x: 0, y: 0 };
function clearInput() { keys.clear(); pointer = null; stick = { x: 0, y: 0 }; $('joystick').style.display = 'none'; }
window.addEventListener('keydown', e => { if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault(); if (e.key === 'Escape' || e.key.toLowerCase() === 'p') { togglePause(); return; } if (state === 'playing') keys.add(e.key.toLowerCase()); });
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
canvas.addEventListener('pointerdown', e => { if (state !== 'playing' || pointer !== null) return; pointer = e.pointerId; canvas.setPointerCapture(e.pointerId); origin = { x: e.clientX, y: e.clientY }; $('joystick').style.cssText = `display:block;left:${e.clientX}px;top:${e.clientY}px`; });
canvas.addEventListener('pointermove', e => { if (pointer !== e.pointerId) return; stick = { x: (e.clientX - origin.x) / 45, y: (e.clientY - origin.y) / 45 }; const l = Math.max(1, Math.hypot(stick.x, stick.y)); $('joystick').firstElementChild!.setAttribute('style', `transform:translate(${stick.x / l * 24}px,${stick.y / l * 24}px)`); });
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(event, clearInput);
function start() { if (state === 'ready' || state === 'over') reset(); state = 'playing'; $('overlay').hidden = true; $('pause').textContent = 'II'; clearInput(); }
$('play').onclick = start;
function togglePause() { if (state === 'ready' || state === 'over') return; if (state === 'paused') { start(); return; } state = 'paused'; clearInput(); $('pause').textContent = '▶'; $('overlay').hidden = false; $('overlay').innerHTML = `<section><span class="eyebrow">TAKE A BREATHER</span><h1>Still hungry?</h1><p>Your city will be right here.</p><button class="primary" id="resume">Keep eating ↗</button><button class="secondary" id="restart">New match</button></section>`; $('resume').onclick = start; $('restart').onclick = () => { state = 'over'; start(); }; $('resume').focus(); }
$('pause').onclick = togglePause;
window.addEventListener('blur', () => { if (state === 'playing') togglePause(); }); document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'playing') togglePause(); });
function finish(reason: FinishReason) { state = 'over'; clearInput(); const best = submitScore('hole-city-classic-v2', holes[0].score), rank = ranking().indexOf(holes[0]) + 1; $('overlay').hidden = false; $('overlay').innerHTML = `<section><span class="eyebrow">${reason === 'cleared' ? 'CITY CLEARED · EVERY LAST BITE' : reason === 'stalled' ? 'THE FEAST IS FINISHED' : 'TIME’S UP · THE CITY HAS BEEN SERVED'}</span><h1>${rank === 1 ? 'Biggest appetite.' : 'A delicious run.'}</h1><p>You finished #${rank} with <b>${holes[0].score} points</b> and swallowed ${eaten} objects.${reason === 'cleared' ? ` The city was cleared with ${Math.ceil(remaining)} seconds to spare!` : reason === 'stalled' ? ' Nothing left that anyone can eat — time to serve a fresh city.' : ''}</p><div class="result">${holes[0].score}<small>POINTS · BEST ${best}</small></div><button class="primary" id="again">Another helping ↗</button><a class="exit" href="/">Back to the arcade</a></section>`; $('again').onclick = start; $('again').focus(); }
function ranking() { return [...holes].sort((a, b) => b.score - a.score); }
function toast(message: string) { $('toast').textContent = message; toastTime = 2.5; }
let hudElapsed = 0;
function hud() {
  const p = holes[0]; document.querySelector('.district small')!.textContent = `${items.filter(item => !item.eaten).length} OBJECTS LEFT · 6 HOLES`; $('time').textContent = `${Math.floor(Math.ceil(remaining) / 60)}:${String(Math.ceil(remaining) % 60).padStart(2, '0')}`;
  $('leaders').innerHTML = ranking().map((h, i) => `<li class="${h === p ? 'you' : ''}"><span>${String(i + 1).padStart(2, '0')}</span><i style="background:#${h.color.toString(16)}"></i><b>${h.name}</b><strong>${h.score}</strong></li>`).join('');
  const tier = growthStage(p.score), stage = MILESTONES[tier], next = MILESTONES[tier + 1];
  $('level').textContent = stage.name; $('score').textContent = `${p.score} pts`;
  $('target').textContent = next ? `${Math.max(0, next.score - p.score)} PTS TO ${stage.menu}` : 'EVERYTHING IS ON THE MENU';
  $('progress').style.width = `${next ? Math.min(100, (p.score - stage.score) / (next.score - stage.score) * 100) : 100}%`;
  const closest = holes.slice(1).filter(h => h.respawn <= 0).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
  $('rival-hint').textContent = p.respawn > 0 ? `BACK IN ${Math.ceil(p.respawn)}s` : closest && Math.hypot(closest.x - p.x, closest.z - p.z) < p.radius + closest.radius + 10 ?
    canSwallow(p, closest) ? `${closest.name} · SWALLOWABLE` : canSwallow(closest, p) ? `${closest.name} · DANGER` : `${closest.name} · NEED 30% SIZE ADVANTAGE` : '';
  if (tier > lastTier) { toast(`SIZE UP! ${MILESTONES[tier - 1].menu} UNLOCKED`); lastTier = tier; }
  if (tier < lastTier) lastTier = tier;
}
function update(dt: number, elapsed: number) {

  let x = Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft')) + stick.x;
  let z = Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup')) + stick.y;
  // Camera looks diagonally across the grid: align movement to the screen axes.
  if (holes[0].respawn <= 0) move(holes[0], x * .8 + z * .6, z * .8 - x * .6, dt);
  holes.forEach((h, i) => {
    if (h.respawn > 0) { h.respawn -= elapsed; return; }
    if (i > 0) {
      const danger = holes.some(other => canSwallow(other,h) && Math.hypot(other.x-h.x,other.z-h.z)<other.radius+9);
      const holding = [...sinking.values()].some(fall=>fall.hole===h && fall.phase==='falling');
      if (!holding || danger) { const direction=rivalDirection(h,holes,items);move(h,direction.x,direction.z,dt*.8); }
    }
    items.forEach((item,j)=>{
      if (sinking.has(j)) return;
      const fall=beginFall(item,h);
      if (fall) sinking.set(j,fall);
    });
  });
  for (let i = 0;i < holes.length;i++)for (let j = i + 1;j < holes.length;j++) {
    const a = holes[i], b = holes[j]; if (a.respawn > 0 || b.respawn > 0) continue; const big = a.radius > b.radius ? a : b, small = big === a ? b : a;
    if (canSwallow(big, small) && Math.hypot(big.x - small.x, big.z - small.z) < big.radius - small.radius * .4) {
      const stolen = swallow(big, small);
      if (small === holes[0]) { biteTime = 0; toast('Swallowed! Lost 20% score. Back in 5 seconds.'); }
      else if (big === holes[0]) { registerBite(stolen); toast(`Swallowed ${small.name}! +${stolen} pts`); }
    }
  }
  sinking.forEach((fall,index)=>{
    const result=advanceFall(fall,dt),g=meshes[index];
    // The object stays in world space; it never follows a hole that has moved away.
    g.position.set(fall.item.x,.2-fall.drop,fall.item.z);
    if(result==='eaten') {
      g.visible=false;g.scale.setScalar(0);sinking.delete(index);
      if(fall.hole===holes[0]){eaten++;registerBite(fall.item.points);}
    } else if(result==='caught') {
      g.position.y=.2;g.rotation.set(0,0,0);sinking.delete(index);
      if(fall.hole===holes[0] && fall.item.kind!=='person' && fall.item.kind!=='bin')toast('Caught the rim — hold underneath until it drops.');
    }
    syncProp(index);
  });
  biteTime = Math.max(0, biteTime - dt); $('bites').style.opacity = biteTime > 0 ? '1' : '0';
  cuesElapsed += dt; if (cuesElapsed > .15) { updateCues(); cuesElapsed = 0; }
  hudElapsed += dt; if (hudElapsed > .12) { hud(); hudElapsed = 0; } const result = matchResult(items, holes, remaining); if (result) { hud(); finish(result); }
}
let w = 0, h = 0, previous = performance.now(); const aim = new THREE.Vector3();
function frame(now: number) {
  const elapsed = Math.max(0, (now - previous) / 1000), dt = Math.min(elapsed, .05); previous = now;
  const rect = canvas.getBoundingClientRect(); if (rect.width !== w || rect.height !== h) { w = rect.width; h = rect.height; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  if (state === 'playing') { remaining = Math.max(0, remaining - elapsed); update(dt, elapsed); }
  toastTime = Math.max(0, toastTime - dt); $('toast').style.opacity = toastTime > 0 ? '1' : '0';
  const p = holes[0], zoom = 48 + p.radius * 2 + (w < h ? 15 : 0); aim.set(p.x, 0, p.z);
  camera.position.lerp(new THREE.Vector3(p.x + zoom * .6, zoom * .95, p.z + zoom * .8), 1 - Math.exp(-dt * 5)); camera.lookAt(aim);
  holes.forEach((hole, i) => {
    const g = holeMeshes[i]; g.position.set(hole.x, .22, hole.z); g.scale.setScalar(hole.radius); g.visible = hole.respawn <= 0;
    const ring = g.children[1] as THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
    ring.material.color.setHex(i === 0 ? colors[0] : canSwallow(holes[0], hole) ? 0x80e6b2 : canSwallow(hole, holes[0]) ? 0xef8074 : hole.color);
  });
  renderer.render(scene, camera); requestAnimationFrame(frame);
}
camera.position.set(28, 60, 42); hud(); requestAnimationFrame(frame);
