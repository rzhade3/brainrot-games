import { GateRunner, offers, rng, type Upgrade } from '../src/games/gate-runner/engine';
import { writeFileSync } from 'node:fs';
export type Policy = 'idle' | 'random' | 'squad' | 'damage' | 'balanced' | 'reactive';
export function simulate(seed: number, policy: Policy) {
  const game = new GateRunner(seed), random = rng(seed + 13);
  let ticks = 0, target = 0, choices = 0;
  while (!['over', 'cleared'].includes(game.state.status) && ticks < 60 * 360) {
    const s = game.state;
    if (s.status === 'ready') game.start();
    if (s.status === 'choice') {
      const priority: Upgrade[] = policy === 'squad' ? ['rapid', 'pierce', 'damage', 'reinforcements', 'armor', 'medic'] : ['damage', 'rapid', 'pierce', 'reinforcements', 'armor', 'medic'];
      if (s.hp < 55) priority.unshift('medic');
      game.choose(offers(seed, s.stage).sort((a, b) => priority.indexOf(a) - priority.indexOf(b))[0]); choices++;
    }
    if (ticks % (policy === 'reactive' ? 24 : 12) === 0) {
      if (policy === 'random') target = (random() - .5) * 6.4;
      else if (policy !== 'idle') {
        const gates = s.gates.filter(g => !g.used && g.z - s.z < 13);
        if (gates.length) {
          const gate = gates.find(g => policy === 'squad' || (['balanced', 'reactive'].includes(policy) && s.soldiers < 24) ? ['add', 'multiply'].includes(g.kind) : !['add', 'multiply', 'sacrifice'].includes(g.kind)) ?? gates[0];
          target = gate.x;
        } else {
          const threats = s.dangers.filter(b => b.z > s.z && b.z - s.z < 22).map(b => {
            const t = (b.z - s.z) / (-b.vz + (s.z < 150 ? 7 : 0));
            return { x: b.x + b.vx * t, t };
          });
          const mine = s.hazards.find(h => !h.used && h.z - s.z < 8);
          const close = s.enemies.filter(e => e.hp > 0 && e.z - s.z < 7 && e.z > s.z);
          const enemy = s.enemies.find(e => e.hp > 0 && e.z > s.z + 7 && e.z - s.z < 26);
          const candidates = [-3, -2, -1, 0, 1, 2, 3];
          const cost = (x: number) => {
            let cost = Math.abs(x - s.x) * .3 + (enemy ? Math.abs(x - enemy.x) * .08 : 0);
            for (const b of threats) {
              const reachable = s.x + Math.max(-8 * b.t, Math.min(8 * b.t, x - s.x));
              cost += Math.max(0, 1.1 - Math.abs(reachable - b.x)) * 30;
            }
            if (mine) cost += Math.max(0, 1.3 - Math.abs(x - mine.x)) * 25;
            for (const e of close) cost += Math.max(0, 1.6 - Math.abs(x - e.x)) * 15;
            return cost;
          };
          target = candidates.sort((a, b) => cost(a) - cost(b))[0];
        }
      }
      if (policy !== 'reactive' || random() > .15) game.steer(target + (policy === 'reactive' ? (random() - .5) * .7 : 0));
    }
    game.step(1 / 60); ticks++;
    if (![s.hp, s.soldiers, s.score, s.x, s.z].every(Number.isFinite) || s.hp < 0 || s.soldiers < 0 || s.soldiers > 180) throw new Error(`Invalid state ${seed}/${policy}`);
  }
  if (ticks >= 60 * 360) throw new Error(`Stalled ${seed}/${policy}`);
  return { seed, policy, cleared: game.state.status === 'cleared', stage: game.state.stage, hp: Math.round(game.state.hp), score: game.state.score, seconds: Math.round(ticks / 60), choices };
}
const count = Number(process.env.SEEDS || 100);
const policies: Policy[] = ['idle', 'random', 'squad', 'damage', 'balanced', 'reactive'];
const results = policies.map(policy => {
  const runs = Array.from({ length: count }, (_, i) => simulate(i + 1, policy));
  const avg = (key: 'stage' | 'score' | 'seconds') => +(runs.reduce((n, r) => n + r[key], 0) / count).toFixed(1);
  return { policy, runs: count, wins: runs.filter(r => r.cleared).length, meanStage: avg('stage'), meanScore: avg('score'), meanSeconds: avg('seconds') };
});
const report = { seeds: `1–${count}`, timestep: '1/60 s; decisions every 200 ms (reactive: 400 ms, 15% missed inputs, ±0.35 steering error)', results };
console.log(JSON.stringify(report, null, 2));
if (process.argv.includes('--write')) writeFileSync('docs/gate-runner-simulations.json', JSON.stringify(report, null, 2) + '\n');

if (process.argv.includes('--check')) {
  const wins = (policy: Policy) => results.find(r => r.policy === policy)!.wins / count;
  if (count < 100 || wins('idle') > .2 || wins('balanced') < .85 || wins('squad') < .85 || wins('damage') < .85) throw new Error('Balance regression: use >=100 seeds; idle <=20%, active >=85%');
}
