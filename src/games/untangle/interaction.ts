import type { Point } from './geometry';

export type Interaction =
  | { kind: 'idle'; hovered: number }
  | { kind: 'drag'; node: number; pointer: number; offset: Point }
  | { kind: 'keyboard'; node: number };

export const idle = (): Interaction => ({ kind: 'idle', hovered: -1 });
export function activeNode(input: Interaction): number {
  return input.kind === 'idle' ? input.hovered : input.node;
}

export interface Board { width: number; height: number; padding: number }
export function project(point: Point, board: Board, appearance = 1): Point {
  return {
    x: board.padding + (.5 + (point.x - .5) * appearance) * Math.max(1, board.width - board.padding * 2),
    y: board.padding + (.5 + (point.y - .5) * appearance) * Math.max(1, board.height - board.padding * 2),
  };
}
export function unproject(point: Point, board: Board): Point {
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  return {
    x: clamp((point.x - board.padding) / Math.max(1, board.width - board.padding * 2)),
    y: clamp((point.y - board.padding) / Math.max(1, board.height - board.padding * 2)),
  };
}
