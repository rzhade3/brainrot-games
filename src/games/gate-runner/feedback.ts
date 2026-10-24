import type { GameEvent, State, Upgrade } from './engine';

export interface VisualEvent extends GameEvent { born: number; duration: number }
const duration: Record<GameEvent['type'], number> = { shot: .08, hit: .18, kill: .6, damage: .8, gate: 1.15, upgrade: 1.4, clear: 1.2 };
/** Stable slots leave a visible gap after a casualty; only reinforcements fill it. */
export class Formation {
  members: { id: number; slot: number }[] = [];
  capacity = 0;
  private nextId = 0;
  sync(count: number): number[] {
    const target = Math.max(0, Math.min(180, Math.floor(count))), removed: number[] = [];
    while (this.members.length > target) removed.push(this.members.pop()!.slot);
    const occupied = new Set(this.members.map(member => member.slot));
    for (let slot = 0; this.members.length < target; slot++) {
      if (occupied.has(slot)) continue;
      this.members.push({ id: this.nextId++, slot }); this.capacity = Math.max(this.capacity, slot + 1);
    }
    return removed;
  }
}
export class Feedback {
  time = 0;
  formation = new Formation();
  fallen: { slot: number; born: number }[] = [];
  effects: VisualEvent[] = [];
  accept(events: GameEvent[]) {
    const killed = new Set(events.filter(e => e.type === 'kill').map(e => e.targetId));
    for (const event of events) {
      if (event.type === 'hit' && killed.has(event.targetId)) continue;
      this.effects.push({ ...event, born: this.time, duration: duration[event.type] });
    }
    this.effects = this.effects.slice(-80);
  }
  advance(dt: number) {
    if (!Number.isFinite(dt) || dt < 0) return;
    this.time += dt;
    this.effects = this.effects.filter(e => this.time - e.born < e.duration);
    this.fallen = this.fallen.filter(unit => this.time - unit.born < .3);
  }
  reset() { this.effects = []; this.time = 0; this.formation = new Formation(); this.fallen = []; }
}

export function upgradePreview(upgrade: Upgrade, s: State): string {
  switch (upgrade) {
    case 'reinforcements': return `${s.soldiers} → ${Math.min(180, s.soldiers + 18)} soldiers`;
    case 'damage': return `Damage ${s.damage.toFixed(1)} → ${(s.damage * 1.3).toFixed(1)}`;
    case 'rapid': return `${s.rate.toFixed(1)} → ${Math.min(14, s.rate * 1.25).toFixed(1)} shots / second`;
    case 'armor': return `${Math.round(s.armor * 100)}% → ${Math.round((1 - (1 - s.armor) * .8) * 100)}% damage blocked`;
    case 'pierce': return `Each shot hits up to ${s.pierce + 2} enemies`;
    case 'medic': return `Health ${Math.ceil(s.hp)} → ${Math.ceil(Math.min(100, s.hp + 35))} · +${Math.min(5, 180 - s.soldiers)} soldiers`;
  }
}

export function announce(events: GameEvent[]): string {
  const significant = events.filter(e => !['shot', 'hit', 'kill'].includes(e.type));
  return significant.slice(-3).map(e => e.type === 'damage' ? `${e.text}. Lost ${Math.ceil(-e.health)} health${e.squad ? ` and ${-e.squad} soldiers` : ''}.` : e.text).join(' ');
}

/** Sound is opt-in and synthesized locally; no network or audio assets. */
export class GameSound {
  enabled = false;
  private context?: AudioContext;
  private last = -1;
  async toggle(): Promise<boolean> {
    if (this.enabled) { this.enabled = false; return false; }
    try {
      this.context ??= new AudioContext();
      await this.context.resume(); this.enabled = true;
    } catch { this.enabled = false; }
    return this.enabled;
  }
  play(events: GameEvent[]) {
    if (!this.enabled || !this.context || this.context.state !== 'running') return;
    const event = [...events].reverse().find(e => ['damage', 'gate', 'kill', 'upgrade'].includes(e.type));
    const ctx = this.context;
    if (!event || ctx.currentTime - this.last < .06) return;
    this.last = ctx.currentTime;
    const oscillator = ctx.createOscillator(), gain = ctx.createGain();
    const reward = event.type === 'gate' || event.type === 'upgrade';
    oscillator.type = reward ? 'sine' : 'triangle';
    oscillator.frequency.setValueAtTime(reward ? 480 : event.type === 'damage' ? 110 : 240, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(reward ? 760 : 65, ctx.currentTime + .12);
    gain.gain.setValueAtTime(.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.045, ctx.currentTime + .008);
    gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + .15);
    oscillator.connect(gain); gain.connect(ctx.destination);
    oscillator.start(); oscillator.stop(ctx.currentTime + .16);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
}
