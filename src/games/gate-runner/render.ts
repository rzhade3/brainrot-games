import { gateLabel, type GateRunner } from './engine';
const colors = { grunt: '#fb7185', runner: '#fda4af', shield: '#fb923c', sniper: '#c084fc', bomber: '#f43f5e', spawner: '#a3e635', boss: '#e879f9' };
const symbols = { grunt: '', runner: '»', shield: '◆', sniper: '⌖', bomber: '!', spawner: '+', boss: 'BOSS' };
export function draw(ctx: CanvasRenderingContext2D, w: number, h: number, game: GateRunner) {
  const s = game.state, scale = w / 9, base = h * .82;
  const screen = (x: number, z: number) => ({ x: w / 2 + x * scale, y: base - (z - s.z) * h / 42 });
  ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#18263b'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#36475e'; ctx.lineWidth = 1;
  for (const x of [-4, 0, 4]) {
    ctx.setLineDash(x === 0 ? [8, 15] : []); ctx.lineDashOffset = -s.z * h / 42;
    ctx.beginPath(); ctx.moveTo(w / 2 + x * scale, 0); ctx.lineTo(w / 2 + x * scale, h); ctx.stroke();
  }
  ctx.setLineDash([]); ctx.textAlign = 'center';
  for (const g of s.gates) {
    const p = screen(g.x, g.z); if (g.used || p.y < -35 || p.y > h + 35) continue;
    ctx.fillStyle = ['add', 'multiply'].includes(g.kind) ? '#087e9c' : g.kind === 'sacrifice' ? '#9f3150' : '#936017';
    ctx.fillRect(p.x - scale * 1.8, p.y - 24, scale * 3.6, 48);
    ctx.strokeStyle = '#ffffff65'; ctx.strokeRect(p.x - scale * 1.8, p.y - 24, scale * 3.6, 48);
    ctx.fillStyle = '#fff'; ctx.font = `700 ${Math.max(11, Math.min(15, w / 27))}px system-ui`;
    ctx.fillText(gateLabel(g), p.x, p.y + (g.kind === 'sacrifice' ? -3 : 5));
    if (g.kind === 'sacrifice') { ctx.font = '11px system-ui'; ctx.fillText('+80% damage', p.x, p.y + 14); }
  }
  for (const mine of s.hazards) {
    const p = screen(mine.x, mine.z); if (mine.used || p.y < -20 || p.y > h) continue;
    ctx.fillStyle = '#f9731633'; ctx.beginPath(); ctx.ellipse(p.x, p.y, scale * .85, 15, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fb923c'; ctx.stroke(); ctx.fillStyle = '#fdba74'; ctx.font = 'bold 16px system-ui'; ctx.fillText('×', p.x, p.y + 5);
  }
  for (const e of s.enemies) {
    if (e.hp <= 0) continue;
    const p = screen(e.x, e.z); if (p.y < -30 || p.y > h + 30) continue;
    if (e.warning > 0) {
      const aim = screen(e.aim, s.z);
      ctx.strokeStyle = '#fca5a599'; ctx.setLineDash([5, 8]); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(aim.x, aim.y); ctx.stroke(); ctx.setLineDash([]);
    }
    const radius = e.kind === 'boss' ? 25 : e.kind === 'shield' ? 14 : 11;
    ctx.fillStyle = colors[e.kind]; ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#101827'; ctx.font = `bold ${e.kind === 'boss' ? 11 : 15}px system-ui`; ctx.fillText(symbols[e.kind], p.x, p.y + 5);
    ctx.fillStyle = '#070e1c'; ctx.fillRect(p.x - radius, p.y - radius - 8, radius * 2, 4);
    ctx.fillStyle = '#86efac'; ctx.fillRect(p.x - radius, p.y - radius - 8, radius * 2 * Math.max(0, e.hp / e.maxHp), 4);
  }
  for (const b of s.shots) { const p = screen(b.x, b.z); ctx.fillStyle = '#fde68a'; ctx.fillRect(p.x - 2, p.y - 6, 4, 11); }
  for (const b of s.dangers) { const p = screen(b.x, b.z); ctx.fillStyle = '#ff586f'; ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); ctx.fill(); }
  const n = Math.min(s.soldiers, 50), columns = Math.min(n, 7);
  for (let i = 0; i < n; i++) {
    const p = screen(s.x + (i % columns - (columns - 1) / 2) * .18, s.z - Math.floor(i / columns) * .26);
    ctx.fillStyle = '#38bdf8'; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(2, scale * .075), 0, Math.PI * 2); ctx.fill();
  }
  const player = screen(s.x, s.z);
  ctx.strokeStyle = '#e0f2fe'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(player.x, player.y, 6, Math.PI, 2 * Math.PI); ctx.stroke();
  if (s.z >= 149 && s.enemies.some(e => e.kind === 'boss' && e.hp > 0)) {
    ctx.fillStyle = '#f5d0fe'; ctx.font = '700 12px system-ui'; ctx.fillText('BOSS · DODGE THE RED SHOTS', w / 2, 24);
  }
}
