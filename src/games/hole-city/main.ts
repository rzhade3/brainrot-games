import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import './style.css';
import { city, canEat, feed, move, radiusFor, type Hole, type Item } from './engine';
import { getBestScore, submitScore } from '../../core/scores';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `<header><a href="/">↖ <span>THE ARCADE</span></a><div class="brand">hole<span>city</span><i></i></div><button id="pause" aria-label="Pause game">II</button></header>
<main><canvas id="world" aria-label="Hole City 3D game. Move with arrow keys, WASD, or drag on the city."></canvas>
<div class="top"><div class="district"><span class="live"></span> DOWNTOWN <small>2 MINUTE FEAST · 6 HOLES</small></div><div class="clock"><small>TIME LEFT</small><b id="time">2:00</b></div></div>
<aside><h2>THE BIG EATERS <span>↗</span></h2><ol id="leaders"></ol><p>LOCAL MATCH · AI RIVALS</p></aside>
<div class="bottom"><div class="growth"><div><strong id="level">A small appetite</strong><span id="score">0 pts</span></div><div class="track"><i id="progress"></i></div><small id="target">NEXT ON THE MENU: TREES</small></div><div class="control-hint"><kbd>W A S D</kbd><span>or drag to move</span></div></div>
<div id="toast" role="status"></div><div id="joystick"><i></i></div>
<div class="veil" id="overlay"><section><span class="eyebrow">SMALL HOLE. BIG PLANS.</span><h1>The city is<br>on the menu<span>.</span></h1><p>Start with the little things. Grow big enough to swallow buildings — and your competition.</p><div class="instructions"><span>01 <b>Move</b> with WASD, arrows, or drag</span><span>02 <b>Eat</b> anything smaller than your hole</span><span>03 <b>Grow</b> to the top in two minutes</span></div><button class="primary" id="play">Let's eat <span>↗</span></button><small id="best">PERSONAL BEST · ${getBestScore('hole-city')} PTS</small></section></div>
</main><footer><span>A LITTLE CHAOS. A LOT OF APPETITE.</span><span>HOLE CITY <b> / </b> 01</span></footer>`;
const $ = (id:string) => document.getElementById(id)!;
const canvas = $('world') as HTMLCanvasElement;
let renderer: THREE.WebGLRenderer;
try { renderer = new THREE.WebGLRenderer({canvas, antialias:true}); }
catch { $('overlay').innerHTML = '<section><h1>Graphics unavailable</h1><p>Hole City needs WebGL. Try a browser with hardware acceleration enabled.</p><a href="/">Back to arcade</a></section>'; throw new Error('WebGL unavailable'); }
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0xcbd9cb); renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0xcbd9cb,100,210);
const camera = new THREE.PerspectiveCamera(40,1,.1,300);
scene.add(new THREE.HemisphereLight(0xffffff,0x7d9582,2.5));
const sun = new THREE.DirectionalLight(0xfff5df,3.1); sun.position.set(-35,65,20); sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048); Object.assign(sun.shadow.camera,{left:-85,right:85,top:85,bottom:-85,far:160}); sun.shadow.bias=-.001; scene.add(sun);
const mats = new Map<number,THREE.MeshStandardMaterial>();
function mat(color:number) { if(!mats.has(color)) mats.set(color,new THREE.MeshStandardMaterial({color,roughness:.85})); return mats.get(color)!; }
const boxGeo = new THREE.BoxGeometry(1,1,1);
function box(parent:THREE.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,color:number) {
 const mesh=new THREE.Mesh(boxGeo,mat(color)); mesh.position.set(x,y,z); mesh.scale.set(w,h,d); mesh.castShadow=true; mesh.receiveShadow=true; parent.add(mesh); return mesh;
}
box(scene,0,-.6,0,142,1,142,0xa8bc9a);
box(scene,0,-.09,0,124,.1,124,0x71817c);
for(let x=-48;x<=48;x+=24) for(let z=-48;z<=48;z+=24) {
 box(scene,x,.04,z,20.4,.24,20.4,0xd9d9c8);
 for(let t=-8;t<=8;t+=5) {box(scene,x+t,.02,z+12,2,.02,.16,0xe6ddac);box(scene,x+12,.02,z+t,.16,.02,2,0xe6ddac);}
 for(let t=-2;t<=2;t++) {box(scene,x+10.9,.03,z+12+t*.65,1.2,.02,.3,0xf1f0df);}
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
batch(scene);
const objects = new THREE.Group(); scene.add(objects);
let items:Item[]=[]; let meshes:THREE.Group[]=[];
const palettes=[0xd5a287,0xe5ca9f,0xa4bbc0,0xb3b6c9,0xc5ad94,0xe6d6b3];
function makeItem(item:Item,index:number) {
 const g=new THREE.Group(); g.position.set(item.x,.2,item.z);
 const color=palettes[index%palettes.length];
 if(item.kind==='house'||item.kind==='tower') {
  const tall=item.kind==='tower', w=tall?6:4.8, h=tall?12+index%8:4+index%3;
  box(g,0,h/2,0,w,h,w,color);box(g,0,h+.18,0,w+.3,.35,w+.3,0xf1ead9);
  box(g,.7,h+.6,.6,1.4,.8,1.5,0x8b9c9b);
  for(let y=1.8;y<h-.5;y+=2) for(const a of [-1.4,1.4]) {
   box(g,a,y,w/2+.01,.85,1,.03,0x617c83);box(g,w/2+.01,y,a,.03,1,.85,0x617c83);
  }
  box(g,0,.8,w/2+.03,.9,1.5,.06,0x475b60);
 } else if(item.kind==='tree') {
  box(g,0,1,0,.35,2,.35,0x8b7050);
  const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(1.55,0),mat(index%2?0x6c9568:0x87a96d));crown.position.y=2.7;crown.castShadow=true;g.add(crown);
 } else if(item.kind==='car') {
  box(g,0,.55,0,1.5,.75,3.2,[0xe7aa64,0xdf7968,0xe7e6d7,0x719baf][index%4]);box(g,0,1.1,-.1,1.25,.65,1.6,0xb7d5d7);
  for(const x of [-.8,.8]) for(const z of [-1,1]) box(g,x,.35,z,.2,.5,.6,0x344448);
 } else if(item.kind==='person') {
  box(g,0,.55,0,.45,.8,.4,[0xe7b95f,0xdd806e,0x647ba1][index%3]);box(g,0,1.15,0,.38,.38,.38,0xf2ceb0);
 } else {box(g,0,.45,0,.7,.9,.7,0x557d71);box(g,0,.95,0,.85,.12,.85,0x3a5c54);}
 batch(g);objects.add(g);return g;
}
const names=['You','Munch','Big Sip','Void','Crumb','The Sink'];
const colors=[0xf4b947,0xe68c8f,0x8e91cb,0x78bcca,0xd4d885,0xbb88b4];
let holes:Hole[]=[];let holeMeshes:THREE.Group[]=[];
const discGeo=new THREE.CircleGeometry(1,64), ringGeo=new THREE.RingGeometry(1,1.11,64);
function makeHole(hole:Hole) {
 const g=new THREE.Group();
 const disc=new THREE.Mesh(discGeo,new THREE.MeshBasicMaterial({color:0x17252a}));disc.rotation.x=-Math.PI/2;g.add(disc);
 const ring=new THREE.Mesh(ringGeo,new THREE.MeshBasicMaterial({color:hole.color,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.02;g.add(ring);scene.add(g);return g;
}
let state:'ready'|'playing'|'paused'|'over'='ready', remaining=120, eaten=0, toastTime=0, lastTier=0;
const sinking=new Map<number,number>();
function reset() {
 sinking.clear();
 for(const m of meshes) { objects.remove(m); m.traverse(child => { if(child instanceof THREE.Mesh) child.geometry.dispose(); }); } for(const m of holeMeshes) scene.remove(m);
 items=city();meshes=items.map(makeItem);
 holes=names.map((name,i)=>({name,color:colors[i],x:i===0?-10:Math.cos(i*1.3)*46,z:i===0?-7:Math.sin(i*1.3)*46,score:0,radius:radiusFor(0),respawn:0}));
 holeMeshes=holes.map(makeHole);remaining=120;eaten=0;lastTier=0;
}
reset();
const keys=new Set<string>(); let pointer:number|null=null, origin={x:0,y:0},stick={x:0,y:0};
function clearInput(){keys.clear();pointer=null;stick={x:0,y:0};$('joystick').style.display='none';}
window.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();if(e.key==='Escape'||e.key.toLowerCase()==='p'){togglePause();return;}if(state==='playing')keys.add(e.key.toLowerCase());});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
canvas.addEventListener('pointerdown',e=>{if(state!=='playing'||pointer!==null)return;pointer=e.pointerId;canvas.setPointerCapture(e.pointerId);origin={x:e.clientX,y:e.clientY};$('joystick').style.cssText=`display:block;left:${e.clientX}px;top:${e.clientY}px`;});
canvas.addEventListener('pointermove',e=>{if(pointer!==e.pointerId)return;stick={x:(e.clientX-origin.x)/45,y:(e.clientY-origin.y)/45};const l=Math.max(1,Math.hypot(stick.x,stick.y));$('joystick').firstElementChild!.setAttribute('style',`transform:translate(${stick.x/l*24}px,${stick.y/l*24}px)`);});
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,clearInput);
function start(){if(state==='ready'||state==='over')reset();state='playing';$('overlay').hidden=true;$('pause').textContent='II';clearInput();}
$('play').onclick=start;
function togglePause(){if(state==='ready'||state==='over')return;if(state==='paused'){start();return;}state='paused';clearInput();$('pause').textContent='▶';$('overlay').hidden=false;$('overlay').innerHTML=`<section><span class="eyebrow">TAKE A BREATHER</span><h1>Still hungry?</h1><p>Your city will be right here.</p><button class="primary" id="resume">Keep eating ↗</button><button class="secondary" id="restart">New match</button></section>`;$('resume').onclick=start;$('restart').onclick=()=>{state='over';start();};$('resume').focus();}
$('pause').onclick=togglePause;
window.addEventListener('blur',()=>{if(state==='playing')togglePause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='playing')togglePause();});
function finish(){state='over';clearInput();const best=submitScore('hole-city',holes[0].score),rank=ranking().indexOf(holes[0])+1;$('overlay').hidden=false;$('overlay').innerHTML=`<section><span class="eyebrow">THE CITY HAS BEEN SERVED</span><h1>${rank===1?'Biggest appetite.':'A delicious run.'}</h1><p>You finished #${rank} with <b>${holes[0].score} points</b> and swallowed ${eaten} objects.</p><div class="result">${holes[0].score}<small>POINTS · BEST ${best}</small></div><button class="primary" id="again">Another helping ↗</button><a class="exit" href="/">Back to the arcade</a></section>`;$('again').onclick=start;$('again').focus();}
function ranking(){return [...holes].sort((a,b)=>b.score-a.score);}
function toast(message:string){$('toast').textContent=message;toastTime=2.5;}
let hudElapsed=0;
function hud(){
 const p=holes[0];$('time').textContent=`${Math.floor(Math.ceil(remaining)/60)}:${String(Math.ceil(remaining)%60).padStart(2,'0')}`;
 $('leaders').innerHTML=ranking().map((h,i)=>`<li class="${h===p?'you':''}"><span>${String(i+1).padStart(2,'0')}</span><i style="background:#${h.color.toString(16)}"></i><b>${h.name}</b><strong>${h.score}</strong></li>`).join('');
 const tiers=[0,2.1,2.6,3.7,5.2,9], tier=tiers.filter(t=>p.radius>t).length-1;
 $('level').textContent=['A small appetite','Room for more','Street sweeper','Block party','City devourer','Bottomless'][tier];$('score').textContent=`${p.score} pts`;
 $('target').textContent=['NEXT ON THE MENU: TREES','NEXT ON THE MENU: CARS','NEXT ON THE MENU: HOUSES','NEXT ON THE MENU: TOWERS','EVERYTHING IS ON THE MENU','THE CITY IS YOURS'][tier];
 const lo=tiers[tier],hi=tiers[tier+1]||13;$('progress').style.width=`${Math.min(100,(p.radius-lo)/(hi-lo)*100)}%`;
 if(tier>lastTier){toast('SIZE UP! '+['','Trees unlocked','Cars unlocked','Houses unlocked','Towers unlocked','Bottomless!'][tier]);lastTier=tier;}
}
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
function update(dt:number){
 remaining=Math.max(0,remaining-dt);
 let x=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'))+stick.x;
 let z=Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup'))+stick.y;
 // Camera looks diagonally across the grid: align movement to the screen axes.
 move(holes[0],x*.8+z*.6,z*.8-x*.6,dt);
 holes.forEach((h,i)=>{
  if(h.respawn>0){h.respawn-=dt;return;}
  if(i>0){let target:Item|undefined, best=Infinity;for(const item of items){if(item.eaten||item.size>=h.radius)continue;const d=Math.hypot(item.x-h.x,item.z-h.z)/(1+item.points*.025);if(d<best){best=d;target=item;}}if(target)move(h,target.x-h.x,target.z-h.z,dt*.8);}
  items.forEach((item,j)=>{if(canEat(h,item)){item.eaten=true;feed(h,item.points);if(i===0)eaten++;sinking.set(j,0);}});
 });
 for(let i=0;i<holes.length;i++)for(let j=i+1;j<holes.length;j++){
  const a=holes[i],b=holes[j];if(a.respawn>0||b.respawn>0)continue;const big=a.radius>b.radius?a:b,small=big===a?b:a;
  if(big.radius>small.radius*1.3&&Math.hypot(big.x-small.x,big.z-small.z)<big.radius-small.radius*.4){feed(big,Math.max(15,Math.round(small.score*.25)));small.respawn=3;small.x=small.x>0?-57:57;small.z=small.z>0?-57:57;if(small===holes[0])toast('Swallowed! Back in 3 seconds — keep your size.');else if(big===holes[0])toast(`Swallowed ${small.name}!`);}
 }
 sinking.forEach((t,index)=>{t+=dt;const g=meshes[index];g.position.y-=dt*9;g.scale.setScalar(Math.max(0,1-t*1.7));if(!reduced)g.rotation.z=t*.7;if(t>.6){g.visible=false;sinking.delete(index);}else sinking.set(index,t);});
 hudElapsed+=dt;if(hudElapsed>.12){hud();hudElapsed=0;}if(remaining<=0)finish();
}
let w=0,h=0,previous=performance.now();const aim=new THREE.Vector3();
function frame(now:number){const dt=Math.min((now-previous)/1000,.05);previous=now;
 const rect=canvas.getBoundingClientRect();if(rect.width!==w||rect.height!==h){w=rect.width;h=rect.height;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
 if(state==='playing')update(dt);
 toastTime=Math.max(0,toastTime-dt);$('toast').style.opacity=toastTime>0?'1':'0';
 const p=holes[0],zoom=42+p.radius*2.4+(w<h?15:0);aim.set(p.x,0,p.z);
 camera.position.lerp(new THREE.Vector3(p.x+zoom*.6,zoom*.95,p.z+zoom*.8),1-Math.exp(-dt*5));camera.lookAt(aim);
 holes.forEach((hole,i)=>{const g=holeMeshes[i];g.position.set(hole.x,.22,hole.z);g.scale.setScalar(hole.radius);g.visible=hole.respawn<=0;});
 renderer.render(scene,camera);requestAnimationFrame(frame);
}
camera.position.set(28,60,42);hud();requestAnimationFrame(frame);
