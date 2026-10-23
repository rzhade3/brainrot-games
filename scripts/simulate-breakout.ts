/** Deterministic, reaction-limited controllers. Diagnostics, not a claim of human playtesting. */
import { pathToFileURL } from 'node:url';
const enginePath = process.argv[2];
const { Breakout, W, H, R, PADDLE_Y } = await import(enginePath ? pathToFileURL(enginePath).href : '../src/games/breakout/engine.ts');
const seeds = Number(process.env.SIM_SEEDS ?? 12);
const duration = Number(process.env.SIM_SECONDS ?? 240);
const startWave = Number(process.env.SIM_WAVE ?? 1);
function random(seed: number) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
function reflect(x: number) { const span = W - 24 - R * 2; const n = ((x - 12 - R) % (span * 2) + span * 2) % (span * 2); return 12 + R + (n <= span ? n : span * 2 - n); }
for (const mode of ['idle', 'reactive', 'predictive'] as const) {
  const runs = [];
  for (let seed = 1; seed <= seeds; seed++) {
    const rng = random(seed), g = new Breakout(startWave);
    let target = W / 2 + (rng() - .5) * 160, nextReaction = 0, maxBalls = 0, lost = 0, clears = 0, lastWave = startWave, oldLives = g.lives;
    let firstClear: number | null = null, elapsed = 0;
    for (let tick = 0; tick < duration * 240; tick++) {
      elapsed = tick / 240;
      if (g.status === 'over') break;
      if (g.status === 'cleared') g.nextWave();
      if (g.status === 'ready') { g.move(W / 2 + (rng() - .5) * 300); g.launch((rng() - .5) * .9); }
      if (elapsed >= nextReaction && mode !== 'idle') {
        nextReaction = elapsed + (mode === 'predictive' ? .09 : .18);
        const incoming = g.balls.filter((b: { vy: number }) => b.vy > 0).sort((a: { y: number; vy: number }, b: { y: number; vy: number }) => (PADDLE_Y - a.y) / a.vy - (PADDLE_Y - b.y) / b.vy)[0];
        if (incoming) {
          const intercept = mode === 'predictive' ? reflect(incoming.x + incoming.vx * Math.max(0, PADDLE_Y - R - incoming.y) / incoming.vy) : incoming.x;
          target = intercept + (rng() - .5) * (mode === 'predictive' ? 40 : 90) + Math.sin(elapsed * 1.7 + seed) * 22;
        }
      }
      if (mode !== 'idle') g.move(g.paddle + Math.max(-850 / 240, Math.min(850 / 240, target - g.paddle)));
      g.step(1 / 240); g.hits = [];
      maxBalls = Math.max(maxBalls, g.balls.length);
      if (g.lives < oldLives) lost += oldLives - g.lives;
      oldLives = g.lives;
      if (g.wave > lastWave || g.status === 'cleared') {
        // Original engine increments immediately; redesigned engine waits at a clear screen.
        if (g.status !== 'cleared' || lastWave === g.wave) { clears++; firstClear ??= elapsed; }
        lastWave = g.wave + (g.status === 'cleared' ? 1 : 0);
      }
      if (g.balls.some((b: { x: number; y: number; vx: number; vy: number }) => ![b.x, b.y, b.vx, b.vy].every(Number.isFinite) || b.x < 0 || b.x > W || b.y < 0 || b.y > H + 30)) throw Error('Invalid ball');
    }
    runs.push({ seed, clears, firstClear: firstClear === null ? null : +firstClear.toFixed(1), maxBalls, lost, gameOver: g.status === 'over', seconds: +elapsed.toFixed(1), remaining: g.bricks.filter((b: { hp: number }) => b.hp > 0).length });
  }
  const mean = (key: 'clears' | 'maxBalls' | 'lost' | 'seconds') => +(runs.reduce((n, r) => n + r[key], 0) / runs.length).toFixed(2);
  console.log(JSON.stringify({ mode, startWave, seeds, duration, meanClears: mean('clears'), firstClearSeconds: runs.map(r => r.firstClear), meanPeakBalls: mean('maxBalls'), meanLivesLost: mean('lost'), gameOvers: runs.filter(r => r.gameOver).length, meanSeconds: mean('seconds'), runs }));
}
