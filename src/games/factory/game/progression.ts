import type { Scenario, Tile } from './domain';
import { inventory, Inventory, Item, RATE_WINDOW_TICKS, STEP_MS } from './domain';

export const ORDERS = [
  { title: 'Copper commissioning', item: 'copper-plate', quantity: 16, reward: 'Unlock the assembler' },
  { title: 'Factory preparation', item: 'defense-supply', quantity: 12, reward: 'Complete factory preparation' },
] as const;

export const PROJECTS = [
  { id: 'extraction', title: 'Extraction commission', item: 'defense-supply', quantity: 8,
    reward: 'Optional extractor upgrade: 1 ore every 0.8s',
    guide: 'Feed parallel iron smelters and a copper smelter into an assembler. Deliver supplies here; the upgrade helps an extractor feed two smelters.' },
  { id: 'buffering', title: 'Buffering commission', item: 'iron-plate', quantity: 16,
    reward: 'Optional depot output: 1 item every 0.8s',
    guide: 'Route iron plates here instead of into storage. Unlock reusable buffers: stored ore, plates and recovered stock can feed production again.' },
] as const;
export type ProjectId = typeof PROJECTS[number]['id'];
export interface ProjectState {
  active: ProjectId | null;
  accepted: Record<ProjectId, number>;
}
export interface ProjectSummary extends ProjectState {
  available: boolean;
  receiver: Tile | null;
}
export interface ObjectiveSummary {
  stage: number;
  title: string;
  item: Item;
  quantity: number;
  accepted: number;
  reward: string;
  complete: boolean;
  assemblerUnlocked: boolean;
  rate: number;
  windowSeconds: number;
}

export class LegacyProgression {
  delivered: Inventory = inventory();
  stage = 0;
  orderStarted = 0;
  orderCompleted: number | null = null;
  deliveryTicks: number[] = [];
  projects: ProjectState = { active: null, accepted: { extraction: 0, buffering: 0 } };

  assemblerUnlocked(scenario: Scenario): boolean {
    return scenario !== 'guided' || this.stage >= 1;
  }

  available(scenario: Scenario): boolean {
    return scenario === 'free-play' || this.stage === ORDERS.length;
  }

  projectComplete(id: ProjectId): boolean {
    return this.projects.accepted[id] === PROJECTS.find(project => project.id === id)!.quantity;
  }

  projectConsumed(item: Item): number {
    return PROJECTS.reduce((sum, project) => sum + (project.item === item ? this.projects.accepted[project.id] : 0), 0);
  }

  activeDelivery(scenario: Scenario): { item: Item; quantity: number; accepted: number } | null {
    if (scenario === 'guided' && this.stage < ORDERS.length) {
      const order = ORDERS[this.stage];
      return { ...order, accepted: this.delivered[order.item] };
    }
    const project = PROJECTS.find(project => project.id === this.projects.active);
    return project ? { ...project, accepted: this.projects.accepted[project.id] } : null;
  }

  accept(scenario: Scenario, item: Item, tick: number): void {
    if (scenario === 'guided' && this.stage < ORDERS.length) {
      this.delivered[item]++;
      this.deliveryTicks.push(tick);
    } else if (this.projects.active) this.projects.accepted[this.projects.active]++;
    if (this.projects.active && this.projectComplete(this.projects.active)) this.projects.active = null;
  }

  update(scenario: Scenario, tick: number): void {
    if (this.orderCompleted === null) this.deliveryTicks = this.deliveryTicks.filter(delivery => delivery > tick - RATE_WINDOW_TICKS);
    if (scenario === 'guided' && this.stage < ORDERS.length) {
      const order = ORDERS[this.stage];
      if (this.delivered[order.item] === order.quantity) {
        this.stage++;
        if (this.stage === ORDERS.length) this.orderCompleted = tick;
        else { this.orderStarted = tick; this.deliveryTicks = []; }
      }
    }
  }

  objective(scenario: Scenario, tick: number): ObjectiveSummary | null {
    if (scenario !== 'guided') return null;
    const complete = this.stage === ORDERS.length;
    const order = ORDERS[complete ? ORDERS.length - 1 : this.stage];
    const end = this.orderCompleted ?? tick;
    const window = Math.min(RATE_WINDOW_TICKS, end - this.orderStarted);
    const count = this.deliveryTicks.filter(delivery => delivery > end - window).length;
    return {
      stage: this.stage, ...order, accepted: this.delivered[order.item], complete,
      assemblerUnlocked: this.assemblerUnlocked(scenario),
      rate: window ? count * 600 / window : 0, windowSeconds: window * STEP_MS / 1000,
    };
  }
}
