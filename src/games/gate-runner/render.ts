import { type Gate, type GateRunner } from './engine';
import type { Feedback } from './feedback';

const units = new Image();
units.src = '/assets/gate-runner/units.webp';
const terrain = new Image();
terrain.src = '/assets/gate-runner/causeway.webp';
const motion = matchMedia('(prefers-reduced-motion: reduce)');
// Normalized atlas rectangles isolate the artwork, rather than drawing empty cell margins.
const sprites = {
  squad: [.13, .02, .26, .44],
  grunt: [.60, .04, .29, .41],
  shield: [.02, .49, .47, .45],
  boss: [.50, .46, .48, .49],
} as const;
const accents = { grunt: '#ff786c', runner: '#ffb7a4', shield: '#ffb64e', sniper: '#d2a1ff', bomber: '#ff584b', spawner: '#c1e984', boss: '#e6a0ff' };
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
export function draw(ctx: CanvasRenderingContext2D, w: number, h: number, game: GateRunner, feedback: Feedback) {
  const reducedMotion = motion.matches;
  const s = game.state, scale = w / 11, base = h * .79;
  const screen = (x: number, z: number) => ({ x: w / 2 + x * scale, y: base - (z - s.z) * h / 42 });
  const recentHit = new Map(feedback.effects.filter(e => e.type === 'hit').map(e => [e.targetId, feedback.time - e.born]));
  const damage = [...feedback.effects].reverse().find(e => e.type === 'damage');
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
    if ((recentHit.get(e.id) ?? 1) < .075) ctx.filter = 'brightness(1.5)';
    else if (e.kind === 'spawner') ctx.filter = 'hue-rotate(95deg)';
    else if (e.kind === 'sniper') ctx.filter = 'hue-rotate(285deg)';
    sprite(ctx, big || e.kind === 'spawner' ? 'boss' : heavy ? 'shield' : 'grunt', p.x, p.y + bob - (reducedMotion ? 0 : Math.max(0, .18 - (recentHit.get(e.id) ?? 1)) * 22), size, size * (heavy || big ? 1 : 1.35));
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
  const target = s.enemies.filter(e => e.hp > 0 && e.z > s.z && e.z < s.z + 21 && Math.abs(e.x - s.x) < 2.1)
    .sort((a, b) => a.z + Math.abs(a.x - s.x) * 2 - b.z - Math.abs(b.x - s.x) * 2)[0];
  if (target && s.status === 'playing') {
    const p = screen(target.x, target.z), r = target.kind === 'boss' ? 52 : 25;
    ctx.strokeStyle = '#c7fff0'; ctx.lineWidth = 2;
    for (const direction of [-1, 1]) { ctx.beginPath(); ctx.moveTo(p.x + direction * (r - 6), p.y - r); ctx.lineTo(p.x + direction * r, p.y - r); ctx.lineTo(p.x + direction * r, p.y - r + 8); ctx.stroke(); }
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
    ctx.fillStyle = '#ff654d'; ctx.beginPath(); ctx.arc(p.x, p.y, b.damage > 2 ? 9 : 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffe7b0'; ctx.beginPath(); ctx.arc(p.x - 1, p.y - 1, 2.5, 0, Math.PI * 2); ctx.fill();
  }
  const removed = feedback.formation.sync(s.soldiers);
  feedback.fallen.push(...removed.map(slot => ({ slot, born: feedback.time })));
  const capacity = Math.max(1, feedback.formation.capacity);
  const columns = Math.max(1, Math.ceil(Math.sqrt(capacity * 1.5))), rows = Math.ceil(capacity / columns);
  const spacing = Math.min(scale * .38, scale * 1.9 / columns);
  const rowSpacing = Math.min(h / 42 * .8, h * .15 / Math.max(1, rows));
  const size = Math.max(3, Math.min(scale * .44, spacing * 1.03, rowSpacing / 1.5));
  const position = (slot: number) => ({ x: w / 2 + s.x * scale + (slot % columns - (columns - 1) / 2) * spacing, y: base + Math.floor(slot / columns) * rowSpacing });
  for (const member of feedback.formation.members) {
    const p = position(member.slot), bob = reducedMotion ? 0 : Math.sin(s.elapsed * 14 + member.id * 1.7) * Math.min(1.2, size / 12);
    ctx.fillStyle = '#1223375c'; ctx.beginPath(); ctx.ellipse(p.x + 1, p.y + size * .65, size * .42, size * .18, 0, 0, Math.PI * 2); ctx.fill();
    sprite(ctx, 'squad', p.x, p.y + bob, size, size * 1.65);
  }
  for (const unit of feedback.fallen) {
    const p = position(unit.slot), fade = (feedback.time - unit.born) / .3;
    // The soldier is already gone. Only a short red impact mark remains.
    ctx.globalAlpha = 1 - fade; ctx.strokeStyle = '#ffc1b5'; ctx.lineWidth = 2;
    const radius = reducedMotion ? size * .5 : size * (.4 + fade);
    ctx.beginPath(); ctx.moveTo(p.x - radius, p.y - radius); ctx.lineTo(p.x + radius, p.y + radius);
    ctx.moveTo(p.x + radius, p.y - radius); ctx.lineTo(p.x - radius, p.y + radius); ctx.stroke(); ctx.globalAlpha = 1;
  }
  for (const event of feedback.effects) {
    const age = feedback.time - event.born, progress = age / event.duration;
    const p = screen(event.x, event.z);
    const color = event.type === 'damage' ? '#ffb0a0' : event.type === 'gate' ? '#baf5e2' : '#fff1bf';
    ctx.save(); ctx.globalAlpha = Math.min(1, (1 - progress) * 3);
    if (event.type === 'shot') {
      ctx.fillStyle = '#fff5be'; ctx.beginPath();
      ctx.ellipse(p.x, p.y - 20, reducedMotion ? 3 : 3 + (1 - progress) * 5, 5, 0, 0, Math.PI * 2); ctx.fill();
    }
    if (event.type === 'hit' || event.type === 'kill' || event.type === 'damage') {
      const radius = event.type === 'kill' ? 12 + progress * 28 : 7 + progress * 18;
      ctx.strokeStyle = color; ctx.lineWidth = event.type === 'hit' ? 2 : 3;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, reducedMotion ? 15 : radius, reducedMotion ? 10 : radius * .7, 0, 0, Math.PI * 2); ctx.stroke();
      if (!reducedMotion) {
        for (let i = 0; i < (event.type === 'kill' ? 9 : 4); i++) {
          const angle = i * 2.399 + (event.targetId ?? 0), travel = progress * (event.type === 'kill' ? 45 : 24);
          ctx.fillStyle = i % 2 ? color : '#e7eef5';
          ctx.fillRect(p.x + Math.cos(angle) * travel, p.y + Math.sin(angle) * travel * .7, 4 * (1 - progress) + 1, 3);
        }
      }
    }
    if (event.type === 'gate' && age < .35) {
      ctx.strokeStyle = color; ctx.lineWidth = 3;
      const spread = reducedMotion ? 0 : age * 35;
      rounded(ctx, p.x - scale * 1.85 - spread, p.y - 30 - spread / 2, scale * 3.7 + spread * 2, 60 + spread, 5); ctx.stroke();
    }
    if (['gate', 'kill', 'damage'].includes(event.type)) {
      const label = event.type === 'damage' ? `−${-event.squad} ${event.squad === -1 ? 'soldier' : 'soldiers'}` : event.text;
      ctx.font = `600 ${event.type === 'kill' ? 12 : 14}px system-ui`;
      const tw = Math.min(w - 24, ctx.measureText(label).width + 20);
      const x = Math.max(tw / 2 + 8, Math.min(w - tw / 2 - 8, p.x));
      const y = Math.max(42, Math.min(h - 28, p.y - 46 - (reducedMotion ? 0 : progress * 18)));
      ctx.fillStyle = '#142536ed'; rounded(ctx, x - tw / 2, y - 16, tw, 27, 5); ctx.fill();
      ctx.fillStyle = color; ctx.fillText(label, x, y + 3, tw - 16);
    }
    ctx.restore();
  }
  if (damage && feedback.time - damage.born < .18) {
    ctx.strokeStyle = '#ffb0a0'; ctx.globalAlpha = reducedMotion ? .35 : .6 * (1 - (feedback.time - damage.born) / .18);
    ctx.lineWidth = 4; ctx.strokeRect(2, 2, w - 4, h - 4); ctx.globalAlpha = 1;
  }
  const boss = s.enemies.find(e => e.kind === 'boss' && e.hp > 0 && e.z - s.z < 30);
  if (boss) {
    ctx.fillStyle = '#122037e8'; rounded(ctx, w * .15, 14, w * .7, 43, 9); ctx.fill();
    ctx.fillStyle = '#efd0ff'; ctx.font = '800 10px system-ui'; ctx.fillText('Gatekeeper', w / 2, 30);
    ctx.fillStyle = '#3e3655'; rounded(ctx, w * .19, 39, w * .62, 5, 2); ctx.fill();
    ctx.fillStyle = '#d28af0'; rounded(ctx, w * .19, 39, w * .62 * Math.max(0, boss.hp / boss.maxHp), 5, 2); ctx.fill();
  }
}
