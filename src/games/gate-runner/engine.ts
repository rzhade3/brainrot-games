export type GateKind = 'add'|'multiply'|'damage'|'rapid'|'armor'|'sacrifice';
export type EnemyKind = 'grunt'|'runner'|'shield'|'sniper'|'bomber'|'spawner';
export type Upgrade = 'reinforcements'|'damage'|'rapid'|'armor'|'pierce'|'lastStand'|'interest';
export interface Gate { x:number; z:number; kind:GateKind; value:number; used:boolean }
export interface Enemy { id:number; x:number; z:number; hp:number; maxHp:number; kind:EnemyKind; cooldown:number }
export interface Shot { x:number; z:number; damage:number; pierce:number }
export interface Segment { kind:'gates'|'wave'|'hazard'|'elite'; z:number; gates?:Gate[]; enemies?:Enemy[]; hazardX?:number }
export interface Level { seed:number; stage:number; segments:Segment[]; length:number }
export interface State { x:number; z:number; soldiers:number; hp:number; damage:number; rate:number; armor:number; pierce:number; currency:number; score:number; stage:number; status:'ready'|'playing'|'choice'|'cleared'|'over'; upgrades:Upgrade[]; enemies:Enemy[]; gates:Gate[]; shots:Shot[]; kills:number; elapsed:number; nextShot:number; spawnTimer:number; seed:number }
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
export function rng(seed:number){let s=seed>>>0;return ()=>{s=(s+0x6D2B79F5)|0;let t=Math.imul(s^(s>>>15),1|s);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296}}
export const WIDTH=8, SPEED=7, MAX_SOLDIERS=180;
export function generate(seed:number,stage:number):Level {
 const r=rng((seed^Math.imul(stage,0x9e3779b9))>>>0),segments:Segment[]=[];
 const kinds:EnemyKind[]=['grunt','runner','shield','sniper','bomber','spawner'];
 let id=0;
 for(let i=0;i<6;i++){
  const z=15+i*24;
  if(i===0||i===2||i===4){
   const gateA:Gate={x:-2.1,z,kind:i===0?'multiply':i===2?'add':'damage',value:i===0?2: i===2?8+stage*2:0.35,used:false};
   const gateB:Gate={x:2.1,z,kind:i===0?'damage':i===2?'rapid':'armor',value:i===0?0.6:i===2?0.35:0.3,used:false};
   segments.push({kind:'gates',z,gates:[gateA,gateB]});
  }else{
   const elite=i===5, count=elite?2+Math.floor(stage/3):3+Math.floor(stage*0.8)+Math.floor(r()*3);
   const enemies:Enemy[]=Array.from({length:count},(_,j)=>{const kind=elite?'shield':kinds[Math.floor(r()*Math.min(kinds.length,2+stage))];const hp=(kind==='shield'?10:kind==='runner'?3:6)*(1+stage*.22)*(elite?3:1);return {id:id++,x:-3+r()*6,z:z+j*1.7,hp,maxHp:hp,kind,cooldown:0}});
   segments.push({kind:elite?'elite':'wave',z,enemies});
  }
 }
 return {seed,stage,segments,length:164};
}
export class GateRunner {
 state:State; level:Level; private accumulator=0; private nextId=10000;
 constructor(seed=12345){this.level=generate(seed,1);this.state={x:0,z:0,soldiers:12,hp:100,damage:2,rate:3,armor:0,pierce:0,currency:0,score:0,stage:1,status:'ready',upgrades:[],enemies:[],gates:[],shots:[],kills:0,elapsed:0,nextShot:0,spawnTimer:0,seed};this.load();}
 private load(){this.level=generate(this.state.seed,this.state.stage);this.state.z=0;this.state.x=0;this.state.enemies=this.level.segments.flatMap(s=>s.enemies?.map(e=>({...e}))??[]);this.state.gates=this.level.segments.flatMap(s=>s.gates?.map(g=>({...g}))??[]);this.state.shots=[];this.state.nextShot=0;this.state.elapsed=0;this.accumulator=0}
 start(){if(this.state.status==='ready')this.state.status='playing'}
 steer(x:number){this.state.x=clamp(x,-3.35,3.35)}
 choose(upgrade:Upgrade){if(this.state.status!=='choice')return;this.state.upgrades.push(upgrade);const s=this.state;if(upgrade==='reinforcements')s.soldiers=Math.min(MAX_SOLDIERS,s.soldiers+12);if(upgrade==='damage')s.damage*=1.35;if(upgrade==='rapid')s.rate*=1.25;if(upgrade==='armor')s.armor=1-(1-s.armor)*.8;if(upgrade==='pierce')s.pierce++;if(upgrade==='interest')s.currency+=Math.round(s.currency*.3);s.stage++;this.load();s.status='ready'}
 step(dt:number){if(this.state.status!=='playing')return;this.accumulator+=Math.min(dt,.1);while(this.accumulator>=1/60){this.tick(1/60);this.accumulator-=1/60}}
 private tick(dt:number){
  const s=this.state;s.elapsed+=dt;s.z+=SPEED*dt;
  for(const g of s.gates){if(!g.used&&s.z>=g.z){g.used=true;if(Math.abs(s.x-g.x)<1.5)this.applyGate(g)}}
  if(s.nextShot<=s.elapsed){const target=s.enemies.filter(e=>e.hp>0&&e.z>=s.z-1&&e.z<s.z+21&&Math.abs(e.x-s.x)<3.6).sort((a,b)=>a.z-b.z)[0];if(target){const strength=Math.max(1,Math.sqrt(s.soldiers));s.shots.push({x:s.x,z:s.z+1,damage:s.damage*strength*.48,pierce:s.pierce});s.nextShot=s.elapsed+1/s.rate}}
  for(const shot of s.shots){shot.z+=38*dt;const hit=s.enemies.find(e=>e.hp>0&&Math.abs(e.z-shot.z)<.9&&Math.abs(e.x-shot.x)<1.35);if(hit){hit.hp-=shot.damage;shot.pierce--;if(shot.pierce<0)shot.z=Infinity;if(hit.hp<=0){s.kills++;s.score+=100;s.currency+=2}}}
  s.shots=s.shots.filter(b=>b.z<s.z+24);
  for(const e of s.enemies){if(e.hp<=0)continue;if(e.z<s.z+1.2&&e.z>s.z-2.2){if(Math.abs(e.x-s.x)<1.4){const damage=e.kind==='bomber'?13:e.kind==='shield'?6:4;s.hp-=damage*(1-s.armor);s.soldiers=Math.max(0,s.soldiers-(e.kind==='bomber'?5:1));e.hp=0}else if(e.z<s.z-1.6)e.hp=0}}
  if(s.hp<=0||s.soldiers<=0){s.status='over';return}
  if(s.z>=this.level.length){s.score+=Math.floor(s.hp)*10+s.soldiers*15;s.status=s.stage>=5?'cleared':'choice'}
 }
 private applyGate(g:Gate){const s=this.state;switch(g.kind){case 'add':s.soldiers=Math.min(MAX_SOLDIERS,s.soldiers+g.value);break;case 'multiply':s.soldiers=Math.min(MAX_SOLDIERS,Math.floor(s.soldiers*g.value));break;case 'damage':s.damage*=1+g.value;break;case 'rapid':s.rate*=1+g.value;break;case 'armor':s.armor=1-(1-s.armor)*(1-g.value);break;case 'sacrifice':s.soldiers=Math.max(1,Math.floor(s.soldiers*.7));s.damage*=2;break}}
 snapshot(){return JSON.parse(JSON.stringify(this.state)) as State}
}
export const UPGRADES:Upgrade[]=['reinforcements','damage','rapid','armor','pierce','lastStand','interest'];
export function offers(seed:number,stage:number):Upgrade[]{const r=rng(seed+stage*971);return [...UPGRADES].sort(()=>r()-.5).slice(0,3)}
