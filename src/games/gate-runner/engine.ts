export type GateKind = 'add' | 'multiply' | 'damage' | 'rapid' | 'sacrifice';
export type EnemyKind = 'grunt' | 'runner' | 'shield' | 'sniper' | 'bomber' | 'spawner' | 'boss';
export type Upgrade = 'reinforcements' | 'damage' | 'rapid' | 'pierce';
export interface Gate { x: number; z: number; kind: GateKind; value: number; used: boolean }
export interface Enemy {
  id: number; x: number; z: number; hp: number; maxHp: number; kind: EnemyKind;
  cooldown: number; warning: number; aim: number; spawned: number;
}
export interface Shot { x: number; z: number; vx: number; vz: number; damage: number; pierce: number; hits: number[] }
export interface Danger { x: number; z: number; vx: number; vz: number; damage: number }
export interface Hazard { x: number; z: number; used: boolean }
export interface Segment { kind: 'gates' | 'wave' | 'hazard' | 'elite'; z: number; gates?: Gate[]; enemies?: Enemy[]; hazards?: Hazard[] }
export interface Level { seed: number; stage: number; segments: Segment[]; length: number }
export type DamageCause = 'mine' | 'collision' | 'projectile';
export interface GameEvent {
  type: 'shot' | 'hit' | 'kill' | 'damage' | 'breach' | 'gate' | 'upgrade' | 'clear';
  x: number; z: number; text: string; squad: number; score: number;
  targetId?: number; gateKind?: GateKind; enemyKind?: EnemyKind;
}
export interface State {
  x: number; targetX: number; z: number; soldiers: number; damage: number;
  rate: number; pierce: number; score: number; stage: number;
  status: 'ready' | 'playing' | 'choice' | 'cleared' | 'over'; upgrades: Upgrade[];
  enemies: Enemy[]; gates: Gate[]; shots: Shot[]; dangers: Danger[]; hazards: Hazard[];
  kills: number; breaches: number; elapsed: number; nextShot: number; seed: number;
  lastDamage: DamageCause | null;
}
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
export const WIDTH = 8, SPEED = 7, MAX_SOLDIERS = 180, STEP = 1 / 60;
/** Survivors retain useful firepower; extra soldiers have diminishing returns. */
export function squadPower(soldiers: number) {
  return soldiers <= 0 ? 0 : .8 + Math.sqrt(soldiers) * .3;
}
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const UPGRADE_INFO: Record<Upgrade, { name: string; detail: string }> = {
  reinforcements: { name: 'Reinforce', detail: '+18 soldiers' },
  damage: { name: 'Heavy rounds', detail: '+30% damage' },
  rapid: { name: 'Rapid fire', detail: '+25% fire rate' },
  pierce: { name: 'Piercing rounds', detail: 'Hit one extra enemy per shot' },
};
export const UPGRADES = Object.keys(UPGRADE_INFO) as Upgrade[];
export function offers(seed: number, stage: number): Upgrade[] {
  const r = rng(seed ^ Math.imul(stage, 971)), pool = [...UPGRADES];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3);
}
export function gateLabel(g: Gate): string {
  if (g.kind === 'add') return `+${g.value} squad`;
  if (g.kind === 'multiply') return `×${g.value} squad`;
  if (g.kind === 'sacrifice') return '−30% squad';
  return `+${Math.round(g.value * 100)}% ${g.kind === 'rapid' ? 'fire rate' : g.kind}`;
}
export function generate(seed: number, stage: number): Level {
  const r = rng(seed ^ Math.imul(stage, 0x9e3779b9)), segments: Segment[] = [];
  let id = 0;
  const enemy = (kind: EnemyKind, x: number, z: number): Enemy => {
    const base = { grunt: 11, runner: 8, shield: 28, sniper: 12, bomber: 14, spawner: 24, boss: 260 }[kind];
    const hp = base * (1 + (stage - 1) * .65) * (kind === 'boss' ? 1 + (stage - 1) * .7 : 1);
    return { id: id++, x, z, kind, hp, maxHp: hp, cooldown: 1.2 + r(), warning: 0, aim: 0, spawned: 0 };
  };
  for (let i = 0; i < 3; i++) {
    const z = 16 + i * 48;
    const troop: Gate = { x: -2, z, kind: i === 0 ? 'multiply' : 'add', value: i === 0 ? 1.7 : 12 + stage * 2, used: false };
    const kinds: GateKind[] = stage === 1 ? ['damage', 'rapid'] : ['damage', 'rapid', 'sacrifice'];
    const kind = kinds[Math.floor(r() * kinds.length)];
    const build: Gate = { x: 2, z, kind, value: .35, used: false };
    if (r() < .5) [troop.x, build.x] = [build.x, troop.x];
    segments.push({ kind: 'gates', z, gates: [troop, build] });
    const roster: EnemyKind[] = ['grunt', 'runner', 'shield', 'sniper', 'bomber', 'spawner'].slice(0, Math.min(6, stage + 3)) as EnemyKind[];
    const count = 5 + stage;
    const enemies = Array.from({ length: count }, (_, j) => enemy(j === 0 ? 'sniper' : roster[Math.floor(r() * roster.length)], (j % 3 - 1) * 2.3 + (r() - .5) * .5, z + 20 + Math.floor(j / 3) * 4));
    segments.push({ kind: 'wave', z: z + 20, enemies });
    // Mines follow combat, leaving two full lanes free and >2 seconds after each gate.
    segments.push({ kind: 'hazard', z: z + 34, hazards: [{ x: (Math.floor(r() * 3) - 1) * 2.3, z: z + 34, used: false }] });
  }
  segments.push({ kind: 'elite', z: 166, enemies: [enemy('boss', 0, 166)] });
  return { seed, stage, segments, length: 174 };
}
export class GateRunner {
  state: State;
  level: Level;
  private accumulator = 0;
  private nextId = 1000;
  private events: GameEvent[] = [];
  drainEvents(): GameEvent[] { return this.events.splice(0); }
  private emit(type: GameEvent['type'], x: number, z: number, text = '', details: Partial<GameEvent> = {}) {
    // Presentation is observational; simulations need not consume this bounded queue.
    if (this.events.length >= 256) this.events.shift();
    this.events.push({ type, x, z, text, squad: 0, score: 0, ...details });
  }
  constructor(seed = Math.floor(Math.random() * 4294967296)) {
    seed >>>= 0;
    this.level = generate(seed, 1);
    this.state = {
      x: 0, targetX: 0, z: 0, soldiers: 12, damage: 2.7, rate: 3.5,
      pierce: 0, score: 0, stage: 1, status: 'ready', upgrades: [],
      enemies: [], gates: [], shots: [], dangers: [], hazards: [], kills: 0,
      breaches: 0, elapsed: 0, nextShot: 0, seed, lastDamage: null,
    };
    this.load();
  }
  private load() {
    const s = this.state;
    this.level = generate(s.seed, s.stage);
    s.z = s.x = s.targetX = s.elapsed = s.nextShot = 0;
    s.enemies = this.level.segments.flatMap(seg => seg.enemies?.map(e => ({ ...e })) ?? []);
    s.gates = this.level.segments.flatMap(seg => seg.gates?.map(g => ({ ...g })) ?? []);
    s.hazards = this.level.segments.flatMap(seg => seg.hazards?.map(h => ({ ...h })) ?? []);
    s.shots = []; s.dangers = []; s.lastDamage = null; this.events = [];
    this.accumulator = 0;
  }
  start() { if (this.state.status === 'ready') this.state.status = 'playing'; }
  steer(x: number) { if (Number.isFinite(x) && this.state.status === 'playing') this.state.targetX = clamp(x, -3.2, 3.2); }
  choose(upgrade: Upgrade) {
    const s = this.state;
    if (s.status !== 'choice' || !offers(s.seed, s.stage).includes(upgrade)) return;
    const beforeSquad = s.soldiers;
    s.upgrades.push(upgrade);
    switch (upgrade) {
      case 'reinforcements': s.soldiers = Math.min(MAX_SOLDIERS, s.soldiers + 18); break;
      case 'damage': s.damage *= 1.3; break;
      case 'rapid': s.rate = Math.min(14, s.rate * 1.25); break;
      case 'pierce': s.pierce++; break;
    }
    s.stage++; this.load(); s.status = 'ready';
    this.emit('upgrade', s.x, s.z, UPGRADE_INFO[upgrade].name, { squad: s.soldiers - beforeSquad });
  }
  step(dt: number) {
    if (this.state.status !== 'playing' || !Number.isFinite(dt) || dt <= 0) return;
    this.accumulator += Math.min(dt, .1);
    while (this.accumulator + 1e-10 >= STEP && this.state.status === 'playing') {
      this.accumulator -= STEP;
      this.tick(STEP);
    }
    if (this.state.status !== 'playing') this.accumulator = 0;
  }
  private hurt(loss: number, cause: DamageCause, x = this.state.x, z = this.state.z) {
    const s = this.state, squad = s.soldiers;
    if (squad === 0) return;
    s.soldiers = Math.max(0, squad - loss);
    s.lastDamage = cause;
    const label = { mine: 'Mine', collision: 'Collision', projectile: 'Incoming fire' }[cause];
    this.emit('damage', x, z, label, { squad: s.soldiers - squad });
  }
  private tick(dt: number) {
    const s = this.state;
    s.elapsed += dt;
    s.x += clamp(s.targetX - s.x, -8 * dt, 8 * dt);
    const boss = s.enemies.find(e => e.kind === 'boss' && e.hp > 0);
    s.z = Math.min(s.z + SPEED * dt, boss ? 150 : this.level.length);
    for (const g of s.gates) {
      if (!g.used && s.z >= g.z) {
        g.used = true;
        // Entire road belongs to one of the pair: the old center gap silently missed both.
        if ((s.x < 0) === (g.x < 0)) this.applyGate(g);
      }
    }
    for (const h of s.hazards) {
      if (!h.used && s.z >= h.z) {
        h.used = true;
        if (Math.abs(s.x - h.x) < .85) this.hurt(6, 'mine', h.x, h.z);
      }
    }
    for (const e of [...s.enemies]) {
      if (e.hp <= 0 || e.z - s.z > 29) continue;
      if (e.kind === 'runner') e.z -= 2.2 * dt;
      if (e.kind === 'bomber' && e.z - s.z < 12) e.x += clamp(s.x - e.x, -dt * 1.25, dt * 1.25);
      if (e.kind === 'boss') e.x = Math.sin(s.elapsed * .65) * 2.2;
      if (e.kind === 'spawner' && e.spawned < 2 && e.z - s.z < 23) {
        e.cooldown -= dt;
        if (e.cooldown <= 0) {
          s.enemies.push({ ...e, id: this.nextId++, kind: 'runner', x: clamp(e.x + (e.spawned ? .7 : -.7), -3, 3), z: e.z - 1, hp: 6 + s.stage * 2, maxHp: 6 + s.stage * 2, warning: 0 });
          e.spawned++; e.cooldown = 1.6;
        }
      }
      if ((e.kind === 'sniper' || e.kind === 'boss' || (e.kind === 'grunt' && s.stage >= 2)) && e.z > s.z + 3) {
        e.cooldown -= dt;
        if (e.warning > 0) {
          e.warning -= dt;
          if (e.warning <= 0) {
            const dz = s.z - e.z, dx = e.aim - e.x, distance = Math.hypot(dx, dz);
            const speed = 23 + s.stage * 1.5;
            if (e.kind === 'boss' && e.spawned % 2 === 1) {
              // A lane barrage leaves one readable corridor; aimed fans prevent camping there.
              for (let lane = 0; lane < 5; lane++) {
                if (lane === e.spawned % 5) continue;
                s.dangers.push({ x: -3 + lane * 1.5, z: e.z, vx: 0, vz: -speed, damage: 3 + s.stage * 2 });
              }
            } else {
              for (const offset of e.kind === 'boss' ? [-.24, -.12, 0, .12, .24] : [0]) {
                s.dangers.push({ x: e.x, z: e.z, vx: dx / distance * speed + offset * speed, vz: dz / distance * speed, damage: e.kind === 'boss' ? 3 + s.stage * 2 : 2 });
              }
            }
            e.spawned++;
            e.cooldown = e.kind === 'boss' ? Math.max(.45, .95 - s.stage * .1) : 1.9;

          }
        } else if (e.cooldown <= 0) { e.warning = e.kind === 'boss' ? .75 : .65; e.aim = s.x; }
      }
      if (e.z < s.z + 1) {
        if (Math.abs(e.x - s.x) < 1.05) {
          this.hurt(e.kind === 'bomber' ? 8 : 4, 'collision', e.x, e.z); e.hp = 0;
        } else if (e.z < s.z - 1.5) {
          const penalty = Math.min(s.score, 50); s.score -= penalty;
          this.emit('breach', e.x, e.z, penalty ? `Escaped · −${penalty} score` : 'Enemy escaped', { score: -penalty });
          s.breaches++; e.hp = 0;
        }
      }
    }
    if (s.nextShot <= s.elapsed) {
      const target = s.enemies.filter(e => e.hp > 0 && e.z > s.z && e.z < s.z + 21 && Math.abs(e.x - s.x) < 2.1)
        .sort((a, b) => (a.z - s.z + Math.abs(a.x - s.x) * 2) - (b.z - s.z + Math.abs(b.x - s.x) * 2))[0];
      if (target) {
        const dx = target.x - s.x, dz = target.z - s.z, distance = Math.hypot(dx, dz);
        s.shots.push({ x: s.x, z: s.z + .6, vx: dx / distance * 43, vz: dz / distance * 43, damage: s.damage * squadPower(s.soldiers), pierce: s.pierce, hits: [] });
        this.emit('shot', s.x, s.z);
        s.nextShot = s.elapsed + 1 / s.rate;
      }
    }
    for (const b of s.shots) {
      const ox = b.x, oz = b.z;
      b.x += b.vx * dt; b.z += b.vz * dt;
      for (const e of s.enemies) {
        if (e.hp <= 0 || b.hits.includes(e.id)) continue;
        const t = clamp(((e.x - ox) * (b.x - ox) + (e.z - oz) * (b.z - oz)) / ((b.x - ox) ** 2 + (b.z - oz) ** 2), 0, 1);
        if (Math.hypot(e.x - ox - t * (b.x - ox), e.z - oz - t * (b.z - oz)) > (e.kind === 'boss' ? 1.15 : .65)) continue;
        e.hp -= b.damage * (e.kind === 'shield' && s.pierce === 0 ? .65 : 1);
        this.emit('hit', e.x, e.z, '', { targetId: e.id, enemyKind: e.kind });
        b.hits.push(e.id);
        if (e.hp <= 0) {
          const reward = e.kind === 'boss' ? 600 : 100;
          s.kills++; s.score += reward;
          this.emit('kill', e.x, e.z, `+${reward}`, { score: reward, targetId: e.id, enemyKind: e.kind });
        }
        if (b.hits.length > b.pierce) break;
      }
    }
    s.shots = s.shots.filter(b => b.hits.length <= b.pierce && b.z < s.z + 32);
    s.dangers = s.dangers.filter(b => {
      b.x += b.vx * dt; b.z += b.vz * dt;
      if (Math.abs(b.z - s.z) < .65 && Math.abs(b.x - s.x) < .72) { this.hurt(b.damage, 'projectile'); return false; }
      return b.z > s.z - 2 && Math.abs(b.x) < 5;
    });
    if (s.soldiers <= 0) { s.status = 'over'; return; }
    if (s.z >= this.level.length) {
      const reward = 250 + s.soldiers * 8;
      s.score += reward;
      this.emit('clear', s.x, s.z, `Stage ${s.stage} cleared`, { score: reward });
      s.status = s.stage === 5 ? 'cleared' : 'choice';
    }
  }
  private applyGate(g: Gate) {
    const s = this.state, squad = s.soldiers, rate = s.rate;
    switch (g.kind) {
      case 'add': s.soldiers = Math.min(MAX_SOLDIERS, s.soldiers + g.value); break;
      case 'multiply': s.soldiers = Math.min(MAX_SOLDIERS, Math.floor(s.soldiers * g.value)); break;
      case 'damage': s.damage *= 1 + g.value; break;
      case 'rapid': s.rate = Math.min(14, s.rate * (1 + g.value)); break;
      case 'sacrifice': s.soldiers = Math.max(1, Math.floor(s.soldiers * .7)); s.damage *= 1.8; break;
    }
    const delta = s.soldiers - squad;
    let text = gateLabel(g);
    if (g.kind === 'add' || g.kind === 'multiply') text = delta ? `+${delta} soldiers` : 'Squad full';
    if (g.kind === 'rapid' && s.rate === rate) text = 'Fire rate maxed';
    if (g.kind === 'sacrifice') text = `+80% damage · ${delta} soldiers`;
    this.emit('gate', g.x, g.z, text, { squad: delta, gateKind: g.kind });
  }
  snapshot(): State { return JSON.parse(JSON.stringify(this.state)) as State; }
}
