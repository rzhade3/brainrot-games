import { type Gate, type GateRunner } from './engine';

const units = new Image();
units.src = '/assets/gate-runner/units.webp';
const terrain = new Image();
terrain.src = '/assets/gate-runner/causeway.webp';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
// Normalized atlas rectangles isolate the artwork, rather than drawing empty cell margins.
const sprites = {
  squad: [.13, .02, .26, .44],
  grunt: [.60, .04, .29, .41],
  shield: [.02, .49, .47, .45],
  boss: [.50, .46, .48, .49],
} as const;
const accents = { grunt: '#ff786c', runner: '#ffb7a4', shield: '#ffb64e', sniper: '#d2a1ff', bomber: '#ff584b', spawner: '#c1e984', boss: '#e6a0ff' };
type Particle = { x: number; z: number; born: number; color: string; angle: number; speed: number };
type Effects = { stage: number; hp: Map<number, number>; particles: Particle[]; flash: Map<number, number>; soldiers: number; health: number; hurt: number };
const effects = new WeakMap<GateRunner, Effects>();
function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r = 6) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
}
function sprite(ctx: CanvasRenderingContext2D, kind: keyof typeof sprites, x: number, y: number, width: number, height: number) {
  if (!units.complete || !units.naturalWidth) {
    ctx.fillStyle = kind === 'squad' ? '#38bdf8' : '#fb7185';
    rounded(ctx, x - width / 2, y - height / 2, width, height); ctx.fill(); return;
  }
  const [sx, sy, sw, sh] = sprites[kind];
  ctx.drawImage(units, sx * units.naturalWidth, sy * units.naturalHeight, sw * units.naturalWidth, sh * units.naturalHeight, x - width / 2, y - height / 2, width, height);
}
function gateText(g: Gate) {
  if (g.kind === 'multiply') return { title: `×${g.value}`, sub: 'SQUAD' };
  if (g.kind === 'add') return { title: `+${g.value}`, sub: 'SQUAD' };
  if (g.kind === 'sacrifice') return { title: '+80%', sub: 'DAMAGE · −30% SQUAD' };
  return { title: `+${Math.round(g.value * 100)}%`, sub: g.kind === 'rapid' ? 'FIRE RATE' : g.kind.toUpperCase() };
}
export function draw(ctx: CanvasRenderingContext2D, w: number, h: number, game: GateRunner) {
  const s = game.state, scale = w / 11, base = h * .79;
  const screen = (x: number, z: number) => ({ x: w / 2 + x * scale, y: base - (z - s.z) * h / 42 });
  let fx = effects.get(game);
  if (!fx || fx.stage !== s.stage) {
    fx = { stage: s.stage, hp: new Map(), particles: [], flash: new Map(), soldiers: s.soldiers, health: s.hp, hurt: -10 };
    effects.set(game, fx);
  }
  for (const e of s.enemies) {
    const previous = fx.hp.get(e.id);
    if (previous !== undefined && previous > e.hp) {
      fx.flash.set(e.id, s.elapsed);
      if (!reducedMotion) for (let i = 0; i < (e.hp <= 0 ? 12 : 3); i++) fx.particles.push({ x: e.x, z: e.z, born: s.elapsed, color: e.hp <= 0 ? accents[e.kind] : '#fff1bf', angle: i * 2.399 + e.id, speed: 1.2 + i % 4 });
    }
    fx.hp.set(e.id, e.hp);
  }
  if (s.hp < fx.health) fx.hurt = s.elapsed;
  fx.health = s.hp; fx.soldiers = s.soldiers;
  fx.particles = fx.particles.filter(p => s.elapsed - p.born < .55).slice(-150);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#2c5262'; ctx.fillRect(0, 0, w, h);
  if (terrain.complete && terrain.naturalWidth) {
    // Scale the painted road to the same world-space width as the gameplay bounds.
    const tw = w * 1.36, th = tw * terrain.naturalHeight / terrain.naturalWidth;
    const scroll = (s.z * h / 42) % th;
    for (let y = scroll - th; y < h; y += th) ctx.drawImage(terrain, (w - tw) / 2, y, tw, th + 1);
  }
  const shade = ctx.createLinearGradient(0, 0, 0, h);
  shade.addColorStop(0, '#0c1c363d'); shade.addColorStop(.6, '#0c1c3600'); shade.addColorStop(1, '#0c1c3626');
  ctx.fillStyle = shade; ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  for (const g of s.gates) {
    const p = screen(g.x, g.z); if (g.used || p.y < -60 || p.y > h + 60) continue;
    const troop = ['add', 'multiply'].includes(g.kind), risk = g.kind === 'sacrifice';
    const color = troop ? '#49e7ff' : risk ? '#ff798c' : '#ffe180';
    const gw = scale * 3.75, gh = Math.min(67, Math.max(48, h * .085));
    ctx.fillStyle = '#10223655'; rounded(ctx, p.x - gw / 2 + 4, p.y - gh / 2 + 9, gw, gh, 8); ctx.fill();
    const glass = ctx.createLinearGradient(0, p.y - gh / 2, 0, p.y + gh / 2);
    glass.addColorStop(0, troop ? '#0e779bea' : risk ? '#97384bea' : '#966019ef');
    glass.addColorStop(1, troop ? '#064965eb' : risk ? '#612136ed' : '#60401bef');
    ctx.fillStyle = glass; rounded(ctx, p.x - gw / 2, p.y - gh / 2, gw, gh, 7); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#ffffff12'; rounded(ctx, p.x - gw / 2 + 4, p.y - gh / 2 + 4, gw - 8, gh * .38, 4); ctx.fill();
    for (const side of [-1, 1]) {
      const x = p.x + side * gw / 2;
      ctx.fillStyle = '#233648'; rounded(ctx, x - 5, p.y - gh / 2 - 5, 10, gh + 13, 3); ctx.fill();
      ctx.fillStyle = color; rounded(ctx, x - 2, p.y - gh / 2 + 1, 4, gh - 2, 2); ctx.fill();
      ctx.fillStyle = '#141f2e'; rounded(ctx, x - 8, p.y + gh / 2 + 4, 16, 6, 2); ctx.fill();
    }
    const text = gateText(g);
    ctx.fillStyle = '#fff'; ctx.font = `900 ${Math.min(29, w / 17)}px system-ui`;
    ctx.fillText(text.title, p.x, p.y + 3);
    ctx.fillStyle = color; ctx.font = `800 ${risk ? Math.max(8, w / 52) : Math.max(9, w / 43)}px system-ui`;
    ctx.fillText(text.sub, p.x, p.y + gh / 2 - 8);
  }
  for (const mine of s.hazards) {
    const p = screen(mine.x, mine.z); if (mine.used || p.y < -25 || p.y > h) continue;
    ctx.fillStyle = '#ff73382b'; ctx.beginPath(); ctx.ellipse(p.x, p.y, scale * .85, 20, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffb065'; ctx.setLineDash([5, 4]); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#1c2b39'; ctx.beginPath(); ctx.ellipse(p.x, p.y + 4, 14, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6c7881'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 13, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = Math.sin(s.elapsed * 9) > 0 ? '#fff0aa' : '#ff6948'; ctx.beginPath(); ctx.arc(p.x, p.y - 2, 4, 0, Math.PI * 2); ctx.fill();
  }
  for (const e of s.enemies) {
    if (e.hp <= 0) continue;
    const p = screen(e.x, e.z); if (p.y < -65 || p.y > h + 65) continue;
    if (e.warning > 0) {
      ctx.strokeStyle = '#ff655c'; ctx.lineWidth = 2; ctx.setLineDash([6, 7]);
      if (e.kind === 'boss' && e.spawned % 2 === 1) {
        for (let lane = 0; lane < 5; lane++) {
          const origin = screen(-3 + lane * 1.5, e.z), aim = screen(-3 + lane * 1.5, s.z);
          const safe = lane === e.spawned % 5;
          ctx.fillStyle = safe ? '#a4ee6626' : '#ff655c20';
          ctx.fillRect(aim.x - scale * .6, origin.y, scale * 1.2, aim.y - origin.y);
          ctx.strokeStyle = safe ? '#a4ee66' : '#ff655c';
          ctx.beginPath(); ctx.moveTo(origin.x, origin.y); ctx.lineTo(aim.x, aim.y); ctx.stroke();
          if (safe) { ctx.fillStyle = '#d4ffad'; ctx.font = '800 10px system-ui'; ctx.fillText('GAP', aim.x, aim.y - 25); }
        }
      } else {
        const aim = screen(e.aim, s.z);
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(aim.x, aim.y); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(aim.x, aim.y, 15, 8, 0, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    const big = e.kind === 'boss', heavy = e.kind === 'shield' || e.kind === 'spawner';
    const size = big ? scale * 2.25 : heavy ? scale * 1.12 : scale * .8;
    const bob = reducedMotion ? 0 : Math.sin(s.elapsed * (e.kind === 'runner' ? 18 : 9) + e.id) * 1.5;
    ctx.fillStyle = '#10233355'; ctx.beginPath(); ctx.ellipse(p.x + 3, p.y + size * .34, size * .42, size * .15, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    if (s.elapsed - (fx.flash.get(e.id) ?? -1) < .075) ctx.filter = 'brightness(1.8)';
    else if (e.kind === 'spawner') ctx.filter = 'hue-rotate(95deg)';
    else if (e.kind === 'sniper') ctx.filter = 'hue-rotate(285deg)';
    sprite(ctx, big || e.kind === 'spawner' ? 'boss' : heavy ? 'shield' : 'grunt', p.x, p.y + bob, size, size * (heavy || big ? 1 : 1.35));
    ctx.restore();
    if (e.kind === 'bomber' || e.kind === 'runner') {
      ctx.fillStyle = '#172538'; ctx.beginPath(); ctx.arc(p.x + size * .4, p.y + size * .2, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = accents[e.kind]; ctx.font = 'bold 12px system-ui'; ctx.fillText(e.kind === 'bomber' ? '!' : '»', p.x + size * .4, p.y + size * .2 + 4);
    }
    if (e.hp < e.maxHp && !big) {
      const bw = size * .8, by = p.y - size * .72 - 7;
      ctx.fillStyle = '#152437b3'; rounded(ctx, p.x - bw / 2, by, bw, 4, 2); ctx.fill();
      ctx.fillStyle = accents[e.kind]; rounded(ctx, p.x - bw / 2, by, bw * Math.max(0, e.hp / e.maxHp), 4, 2); ctx.fill();
    }
  }
  ctx.lineCap = 'round';
  for (const b of s.shots) {
    const p = screen(b.x, b.z), tail = screen(b.x - b.vx * .025, b.z - b.vz * .025);
    ctx.strokeStyle = '#fff0a94d'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(tail.x, tail.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    ctx.strokeStyle = '#fff7cb'; ctx.lineWidth = 2.5; ctx.stroke();
  }
  for (const b of s.dangers) {
    const p = screen(b.x, b.z);
    ctx.fillStyle = '#ff563b35'; ctx.beginPath(); ctx.arc(p.x, p.y, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff654d'; ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffe7b0'; ctx.beginPath(); ctx.arc(p.x - 1, p.y - 1, 2.5, 0, Math.PI * 2); ctx.fill();
  }
  // Draw a representative formation; the HUD remains the exact squad count.
  const n = Math.min(s.soldiers, 25), columns = Math.min(n, 5), size = Math.max(14, scale * .44);
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / columns), count = Math.min(columns, n - row * columns);
    const p = screen(s.x + (i % columns - (count - 1) / 2) * .38, s.z - row * .8);
    const bob = reducedMotion ? 0 : Math.sin(s.elapsed * 14 + i * 1.7) * 1.2;
    ctx.fillStyle = '#1223375c'; ctx.beginPath(); ctx.ellipse(p.x + 2, p.y + size * .65, size * .42, size * .18, 0, 0, Math.PI * 2); ctx.fill();
    sprite(ctx, 'squad', p.x, p.y + bob, size, size * 1.65);
  }
  for (const p of fx.particles) {
    const age = s.elapsed - p.born, position = screen(p.x + Math.cos(p.angle) * age * p.speed, p.z + Math.sin(p.angle) * age * p.speed);
    ctx.globalAlpha = Math.max(0, 1 - age / .55); ctx.fillStyle = p.color;
    ctx.fillRect(position.x, position.y, 3 + (1 - age / .55) * 3, 3); ctx.globalAlpha = 1;
  }
  if (s.elapsed - fx.hurt < .25 && !reducedMotion) {
    ctx.strokeStyle = `rgba(255,95,80,${(.25 - s.elapsed + fx.hurt) * 2})`; ctx.lineWidth = 9; ctx.strokeRect(0, 0, w, h);
  }
  const boss = s.enemies.find(e => e.kind === 'boss' && e.hp > 0 && e.z - s.z < 30);
  if (boss) {
    ctx.fillStyle = '#122037e8'; rounded(ctx, w * .15, 14, w * .7, 43, 9); ctx.fill();
    ctx.fillStyle = '#efd0ff'; ctx.font = '800 10px system-ui'; ctx.fillText('THE GATEKEEPER', w / 2, 30);
    ctx.fillStyle = '#3e3655'; rounded(ctx, w * .19, 39, w * .62, 5, 2); ctx.fill();
    ctx.fillStyle = '#d28af0'; rounded(ctx, w * .19, 39, w * .62 * Math.max(0, boss.hp / boss.maxHp), 5, 2); ctx.fill();
  }
}
