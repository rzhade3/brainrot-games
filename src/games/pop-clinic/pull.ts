import type { Point, Step } from './cases';

export type PullPath = Pick<Extract<Step, { action: 'pull' }>, 'at' | 'to'>;
export const releaseAt = .92;

export function resolvePull(path: PullPath, origin: Point, pointer: Point, feel: 'free' | 'embedded' | 'palm') {
  const dx = path.to[0] - path.at[0];
  const dy = path.to[1] - path.at[1];
  const length = Math.hypot(dx, dy);
  const ux = dx / length;
  const uy = dy / length;
  const mx = pointer[0] - origin[0];
  const my = pointer[1] - origin[1];
  const distance = Math.hypot(mx, my);
  const outward = mx * ux + my * uy;
  if (outward <= 0) return { fraction: 0, offset: [0, 0] as Point, direction: [ux, uy] as Point };

  const grabAhead = (origin[0] - path.at[0]) * ux + (origin[1] - path.at[1]) * uy;
  const reach = Math.max(length * .5, length - Math.max(0, grabAhead));
  // Most outward angles get full credit. Almost sideways pulls need more travel.
  const fraction = Math.min(1, Math.min(distance, outward / .22) / reach);
  const direction: Point = [mx / distance, my / distance];
  if (feel === 'palm') {
    // The piece gives slowly under tension. The exit animation supplies the sudden release.
    const travel = 21 * Math.pow(Math.min(1, fraction / releaseAt), 1.65);
    return { fraction, offset: [ux * travel, uy * travel] as Point, direction };
  }
  const travel = length * fraction * (feel === 'embedded' ? .58 + .42 * fraction : 1);

  // Clear the pocket along its authored axis before steering toward the drag.
  const free = Math.max(0, travel - (feel === 'embedded' ? 32 : 20));
  const steer = free * Math.min(1, free / 35);
  const offset: Point = [
    ux * (travel - steer) + direction[0] * steer,
    uy * (travel - steer) + direction[1] * steer,
  ];
  return { fraction, offset, direction };
}
