import { makeChambers, CHAMBER_NAMES, type Chamber } from './chambers';
export type Power = 'triple' | 'add' | 'wide' | 'fire' | 'bomb' | 'shield' | 'slow';
export interface Brick { x: number; y: number; w: number; h: number; hp: number; maxHp: number; power?: Power; chamber?: number; gate?: boolean; color?: string }
export type Obstacle = { kind: 'steel'; vent?: number; x: number; y: number; w: number; h: number } | { kind: 'bumper'; x: number; y: number; radius: number };
export interface Level { name: string; hint: string; bricks: Brick[]; obstacles: Obstacle[]; chambers?: Chamber[] }
const powers: Power[] = ['add', 'wide', 'triple', 'fire', 'bomb', 'shield', 'slow', 'add'];
const steel = (x: number, y: number, w: number, h = 18): Obstacle => ({ kind: 'steel', x, y, w, h });
const bumper = (x: number, y: number, radius = 24): Obstacle => ({ kind: 'bumper', x, y, radius });
const designs = [
  { name: 'Split decision', hint: 'Shoot the gap. Work around the steel shelves.',
    mask: (r: number, c: number) => r < 10 && ((c >= 1 && c <= 5) || (c >= 8 && c <= 12)) && (r > 3 || c % 7 > 1) || r === 15 && c >= 5 && c <= 8,
    obstacles: [steel(132, 474, 145), steel(443, 474, 145)] },
  { name: 'Diamond circuit', hint: 'Bank shots around the center bumper.',
    mask: (r: number, c: number) => { const d = Math.abs(c - 6.5) + Math.abs(r - 8) * .7; return d >= 4.2 && d <= 7.5; },
    obstacles: [bumper(360, 326, 36), bumper(98, 646), bumper(622, 646)] },
  { name: 'Slalom', hint: 'Alternating shelves redirect each return.',
    mask: (r: number, c: number) => r < 3 && c < 12 || r >= 7 && r <= 9 && c >= 3 || r >= 14 && r <= 16 && c < 10,
    obstacles: [steel(60, 242, 390), steel(270, 438, 390)] },
  { name: 'The vault', hint: 'Enter through the open roof or floor of the vault.',
    mask: (r: number, c: number) => r < 6 && c >= 2 && c <= 11 || r >= 8 && r <= 16 && (c < 4 || c > 9) || r >= 9 && r <= 13 && c >= 5 && c <= 8,
    obstacles: [steel(242, 310, 18, 225), steel(460, 310, 18, 225), bumper(360, 590, 28)] },
  { name: 'Constellation', hint: 'Small islands. Big rebounds. Pick your angle.',
    mask: (r: number, c: number) => r % 6 < 3 && c % 5 < 3 && c < 13,
    obstacles: [bumper(230, 238, 22), bumper(456, 406, 22), bumper(230, 574, 22)] },
  { name: 'Hourglass', hint: 'Low bricks shorten the return. Stay ready.',
    mask: (r: number, c: number) => Math.abs(c - 6.5) <= Math.abs(r - 9.5) * .56 + 1,
    obstacles: [bumper(92, 354, 30), bumper(628, 354, 30)] },
  { name: 'Switchback', hint: 'Steel breaks the lanes; bumpers change the angle.',
    mask: (r: number, c: number) => r < 18 && r % 4 < 2 && (Math.floor(r / 4) % 2 === 0 ? c < 10 : c >= 4),
    obstacles: [steel(300, 166, 120), bumper(150, 284, 20), steel(300, 390, 120), bumper(570, 508, 20)] },
  { name: 'Orbit', hint: 'Find the ring’s openings. Steel never counts toward a clear.',
    mask: (r: number, c: number) => { const d = Math.hypot((c - 6.5) / 7, (r - 9.5) / 10); return d < 1 && d > .46; },
    obstacles: [bumper(360, 370, 42), steel(112, 660, 96), steel(512, 660, 96)] },
];
export const LEVEL_NAMES = [...CHAMBER_NAMES, ...designs.map(d => d.name)];
export function makeLevel(wave: number): Level {
  const stage = (Math.max(1, Math.floor(wave)) - 1) % LEVEL_NAMES.length;
  if (stage < 3) return makeChambers(stage, Math.floor((wave - 1) / LEVEL_NAMES.length));
  const index = stage - 3;
  const design = designs[index];
  const bricks: Brick[] = [];
  for (let row = 0; row < 20; row++) for (let col = 0; col < 14; col++) {
    if (!design.mask(row, col)) continue;
    const hp = 1 + Math.min(5, Math.floor((wave - 1) / LEVEL_NAMES.length) + ((row * 7 + col * 3 + index) % 5 === 0 ? 2 : (row + col) % 3 === 0 ? 1 : 0));
    bricks.push({ x: 31 + col * 47, y: 90 + row * 28, w: 42, h: 23, hp, maxHp: hp });
  }
  // Eight spaced rewards, not a dense carpet that can auto-trigger itself.
  const candidates = [...bricks].sort((a, b) => hash(a.x, a.y, wave) - hash(b.x, b.y, wave));
  const chosen: Brick[] = [];
  for (const b of candidates) {
    if (chosen.length === powers.length) break;
    if (chosen.some(p => Math.hypot(b.x - p.x, b.y - p.y) < 116)) continue;
    b.power = powers[chosen.length]; b.hp = b.maxHp = 1; chosen.push(b);
  }
  return { name: design.name, hint: design.hint, bricks, obstacles: design.obstacles.map(o => ({ ...o })) };
}
function hash(x: number, y: number, seed: number) { let n = Math.imul(x + seed * 71, 374761393) ^ Math.imul(y, 668265263); n = Math.imul(n ^ (n >>> 13), 1274126177); return (n ^ (n >>> 16)) >>> 0; }
