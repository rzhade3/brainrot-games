import { bound } from './coverage';

const duration = 1500;
export const drainReach = 45;

export interface DrainClock {
  progress: number;
  leadIn: number;
  contactAt: number | null;
}

export function startDrain(progress: number, now: number): DrainClock {
  return { progress, leadIn: progress > 0 ? 0 : 180, contactAt: now };
}

export function setDrainContact(clock: DrainClock, touching: boolean, now: number): void {
  if (!touching) clock.contactAt = null;
  else clock.contactAt ??= now;
}

export function advanceDrain(clock: DrainClock, now: number): number {
  if (clock.contactAt === null) return clock.progress;
  const elapsed = Math.max(0, now - clock.contactAt);
  clock.contactAt = now;
  const opening = Math.min(clock.leadIn, elapsed);
  clock.leadIn -= opening;
  clock.progress = bound(clock.progress + (elapsed - opening) / duration);
  return clock.progress;
}
