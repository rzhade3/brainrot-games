export type Kind = 'bin' | 'person' | 'tree' | 'car' | 'house' | 'tower';
export interface Item { x: number; z: number; size: number; points: number; kind: Kind; eaten: boolean }
export interface Hole { x: number; z: number; score: number; radius: number; name: string; color: number; respawn: number }
export const LIMIT = 62;
export const radiusFor = (score: number) => Math.min(13, 1.65 + Math.sqrt(score) * .36);
export function canEat(hole: Hole, item: Item) { return !item.eaten && item.size < hole.radius && Math.hypot(hole.x-item.x, hole.z-item.z) < hole.radius - item.size * .35; }
export function feed(hole: Hole, points: number) { hole.score += points; hole.radius = radiusFor(hole.score); }
export function move(hole: Hole, x: number, z: number, dt: number) {
  const length = Math.hypot(x,z); if (!length) return;
  const speed = (10.5 - hole.radius * .22) * Math.min(length, 1) * dt;
  hole.x = Math.max(-LIMIT, Math.min(LIMIT, hole.x+x/length*speed));
  hole.z = Math.max(-LIMIT, Math.min(LIMIT, hole.z+z/length*speed));
}
export function city(seed = 718): Item[] {
  const items: Item[] = [];
  const random = () => { seed = (Math.imul(seed,1664525)+1013904223) >>> 0; return seed/4294967296; };
  const add = (x:number,z:number,kind:Kind,size:number,points:number) => items.push({x,z,kind,size,points,eaten:false});
  for(let x=-48;x<=48;x+=24) for(let z=-48;z<=48;z+=24) {
    const park = random()<.22 || (x===0 && z===0);
    if(!park) for(const dx of [-5,5]) for(const dz of [-5,5]) {
      const tall = random()>.65; add(x+dx,z+dz,tall?'tower':'house',tall?5.2:3.7,tall?90:40);
    }
    else for(let n=0;n<7;n++) add(x+(random()-.5)*16,z+(random()-.5)*16,'tree',2.1,10);
    for(let n=0;n<9;n++) {
      const side = n%2 ? -10 : 10;
      add(x+side,z-9+n*2.3,n%3===0?'bin':'person',n%3===0?.65:.45,n%3===0?3:2);
    }
    for(const offset of [-7,3]) add(x+offset,z+12,'car',2.6,15);
    add(x-9,z+8,'tree',2.1,10);
  }
  return items;
}
