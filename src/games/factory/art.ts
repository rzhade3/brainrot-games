import Phaser from 'phaser';
import {
  Building, Direction, DIRECTIONS, HALF_HEIGHT, HALF_WIDTH, Point, project, variation,
} from './model';
import { Item } from './simulation';

type Graphics = Phaser.GameObjects.Graphics;

export const PALETTE = {
  ink: 0x344b48, teal: 0x3f7774, amber: 0xd8a653,
  roof: 0xebe7d9, steel: 0x8da4a0, dark: 0x536968,
};

export function polygon(g: Graphics, points: Point[], color: number, alpha = 1): void {
  g.fillStyle(color, alpha);
  g.fillPoints(points, true);
}

export function diamond(g: Graphics, x: number, y: number, w: number, h: number, color: number, alpha = 1): void {
  polygon(g, [{ x, y: y - h }, { x: x + w, y }, { x, y: y + h }, { x: x - w, y }], color, alpha);
}

function prism(
  g: Graphics, x: number, y: number, w: number, h: number, height: number,
  top: number, left: number, right: number,
): void {
  polygon(g, [
    { x: x - w, y }, { x, y: y + h }, { x, y: y + h - height }, { x: x - w, y: y - height },
  ], left);
  polygon(g, [
    { x, y: y + h }, { x: x + w, y }, { x: x + w, y: y - height }, { x, y: y + h - height },
  ], right);
  diamond(g, x, y - height, w, h, top);
}

function line(g: Graphics, a: Point, b: Point, color: number, width = 1, alpha = 1): void {
  g.lineStyle(width, color, alpha);
  g.lineBetween(a.x, a.y, b.x, b.y);
}

export function drawTree(g: Graphics, x: number, y: number, c: number, r: number): void {
  g.fillStyle(0x314f40, 0.14).fillEllipse(x + 9, y + 4, 44, 15);
  prism(g, x, y, 3, 1.5, 22, 0xa18f6b, 0x776d55, 0x615e4b);
  const h = 27 + variation(c, r) * 13;
  for (let tier = 0; tier < 3; tier++) {
    const baseY = y - 12 - tier * 11;
    const w = 22 - tier * 4;
    polygon(g, [{ x: x - w, y: baseY }, { x, y: baseY - h }, { x: x + w, y: baseY }], 0x54765c);
    polygon(g, [{ x, y: baseY - h }, { x: x + w, y: baseY }, { x, y: baseY + 6 }], 0x3f624f);
    polygon(g, [{ x: x - w, y: baseY }, { x, y: baseY - h }, { x, y: baseY + 6 }], 0x70906b);
  }
}

export function drawOre(g: Graphics, x: number, y: number, copper: boolean, c: number, r: number): void {
  const colors = copper ? [0xc69a72, 0x936e55, 0xdfba8d] : [0x91a5a4, 0x647c80, 0xb7c6c2];
  for (let i = 0; i < 5; i++) {
    const dx = (variation(c + i * 3, r) - 0.5) * 44;
    const dy = (variation(c, r + i * 7) - 0.5) * 15;
    prism(g, x + dx, y + dy, 5 + i % 3, 3, 4 + i % 3, colors[0], colors[1], colors[2]);
  }
}

export function drawBuilding(g: Graphics, b: Building): void {
  const { x, y } = project(b.c, b.r);
  if (b.kind === 'belt') {
    drawBelt(g, x, y, b.direction);
    return;
  }
  g.fillStyle(0x243c36, 0.18).fillEllipse(x + 10, y + 10, 68, 23);
  prism(g, x, y, 32, 16, 5, 0xc5c9b9, 0x929f93, 0x7c9087);
  if (b.kind === 'miner') {
    prism(g, x, y - 3, 26, 13, 18, 0xa9bab1, 0x718a80, 0x526e66);
    prism(g, x - 5, y - 8, 19, 9, 20, 0xd8b66f, 0x9b8050, 0x806941);
    prism(g, x + 10, y - 6, 9, 4, 33, 0xe0dfd1, 0x9cab9f, 0x71897f);
    g.fillStyle(0x344b48).fillEllipse(x - 5, y - 45, 20, 10);
    g.fillStyle(0x8fa5a0).fillEllipse(x - 5, y - 46, 13, 6);
    line(g, { x: x - 24, y: y - 15 }, { x: x - 5, y: y - 6 }, 0xd9c58e, 3);
    g.fillStyle(0xe8ce8b).fillCircle(x + 15, y - 25, 2);
  } else if (b.kind === 'furnace') {
    prism(g, x, y - 3, 27, 13.5, 31, 0xdce0d5, 0x8b9c94, 0x667f78);
    prism(g, x, y - 35, 22, 11, 5, 0xebe7d9, 0xa9b3a7, 0x8a9d91);
    prism(g, x + 5, y - 37, 7, 3.5, 25, 0x687d76, 0x445d58, 0x344c47);
    diamond(g, x + 5, y - 62, 4, 2, 0x203b34);
    polygon(g, [
      { x: x - 21, y: y - 21 }, { x: x - 4, y: y - 12 },
      { x: x - 4, y: y + 2 }, { x: x - 21, y: y - 6 },
    ], 0x394d43);
    polygon(g, [
      { x: x - 18, y: y - 16 }, { x: x - 7, y: y - 10 },
      { x: x - 7, y: y - 2 }, { x: x - 18, y: y - 8 },
    ], 0xe5aa57);
    line(g, { x: x + 7, y: y - 8 }, { x: x + 23, y: y - 16 }, 0xb6c4b8, 2);
  } else if (b.kind === 'assembler') {
    prism(g, x, y - 3, 28, 14, 28, 0xb7c7bd, 0x7a9588, 0x53786d);
    prism(g, x, y - 31, 28, 14, 5, 0xe5e5d4, 0x9bac9e, 0x829c8a);
    diamond(g, x, y - 37, 18, 9, 0x456b61);
    prism(g, x - 9, y - 38, 7, 3.5, 5, 0xc5d3ca, 0x8ca49a, 0x6c887c);
    prism(g, x + 9, y - 38, 7, 3.5, 5, 0xdbad7c, 0xa87954, 0x886244);
    line(g, { x: x - 20, y: y - 35 }, { x: x + 20, y: y - 35 }, 0xd8b66f, 4);
    line(g, { x: x - 20, y: y - 35 }, { x: x - 20, y: y - 13 }, 0x9b8050, 4);
    line(g, { x: x + 20, y: y - 35 }, { x: x + 20, y: y - 13 }, 0x806941, 4);
    g.fillStyle(0xe8ce8b).fillCircle(x + 14, y - 20, 2);
  } else if (b.kind === 'outpost') {
    prism(g, x, y - 3, 29, 14.5, 30, 0xc7c9af, 0x999f7e, 0x717e61);
    prism(g, x, y - 33, 30, 15, 6, 0xece5cf, 0xb8b08c, 0x9d9b76);
    diamond(g, x, y - 40, 20, 10, 0x517c6a);
    g.lineStyle(2, 0xf1e6bd);
    g.strokePoints([{ x: x - 9, y: y - 40 }, { x: x - 2, y: y - 36 }, { x: x + 10, y: y - 43 }], false);
    polygon(g, [{ x: x - 21, y: y - 22 }, { x: x - 5, y: y - 14 },
      { x: x - 5, y: y + 2 }, { x: x - 21, y: y - 6 }], 0x3f5b47);
    line(g, { x: x + 18, y: y - 36 }, { x: x + 18, y: y - 62 }, 0x65795b, 2);
    polygon(g, [{ x: x + 19, y: y - 61 }, { x: x + 31, y: y - 55 }, { x: x + 19, y: y - 50 }], 0xd8b66f);
  } else {
    prism(g, x, y - 3, 28, 14, 27, 0xb4c2b6, 0x7d9488, 0x5d7d71);
    prism(g, x, y - 30, 29, 14.5, 4, 0xe0dfce, 0xa6b2a2, 0x8eaa9a);
    for (let i = 0; i < 3; i++) {
      line(g, { x: x - 22 + i * 7, y: y - 25 + i * 3.5 },
        { x: x - 22 + i * 7, y: y - 6 + i * 3.5 }, 0xa5b9a5, 2);
      line(g, { x: x + 7 + i * 7, y: y - 17 - i * 3.5 },
        { x: x + 7 + i * 7, y: y + 2 - i * 3.5 }, 0x8ea899, 2);
    }
    prism(g, x - 4, y - 36, 10, 5, 8, 0xd7b77b, 0xaa8d5c, 0x927648);
  }
  if (b.kind === 'outpost') return;
  const vector = DIRECTIONS[b.direction];
  const end = project(b.c + vector.c * 0.45, b.r + vector.r * 0.45);
  diamond(g, end.x, end.y - 4, 4, 2, 0xd8bd7d);
}

function drawBelt(g: Graphics, x: number, y: number, direction: Direction): void {
  prism(g, x, y + 1, HALF_WIDTH - 3, HALF_HEIGHT - 2, 5, 0xaeb4a2, 0x78887a, 0x62796d);
  diamond(g, x, y - 5, HALF_WIDTH - 8, HALF_HEIGHT - 5, 0x4e6259);
  const along = DIRECTIONS[direction];
  const across = DIRECTIONS[(direction + 1) % 4];
  for (let i = -2; i <= 2; i++) {
    const a = project(along.c * i * 0.15 - across.c * 0.31, along.r * i * 0.15 - across.r * 0.31);
    const b = project(along.c * i * 0.15 + across.c * 0.31, along.r * i * 0.15 + across.r * 0.31);
    line(g, { x: x + a.x, y: y - 5 + a.y }, { x: x + b.x, y: y - 5 + b.y }, 0x91a08d, 1.5, 0.7);
  }
  const tip = project(along.c * 0.18, along.r * 0.18);
  const left = project(-along.c * 0.08 + across.c * 0.12, -along.r * 0.08 + across.r * 0.12);
  const right = project(-along.c * 0.08 - across.c * 0.12, -along.r * 0.08 - across.r * 0.12);
  polygon(g, [
    { x: x + tip.x, y: y - 5 + tip.y },
    { x: x + left.x, y: y - 5 + left.y },
    { x: x + right.x, y: y - 5 + right.y },
  ], 0xdac58c);
}

export function drawParcel(g: Graphics, x: number, y: number, item: Item): void {
  if (item === 'defense-supply') {
    g.fillStyle(0x1f372f, 0.2).fillEllipse(x + 3, y + 2, 18, 8);
    prism(g, x, y, 8, 4, 6, 0xd8b66f, 0x9b8050, 0x806941);
    line(g, { x: x - 4, y: y - 5 }, { x: x + 4, y: y - 5 }, 0xf0e4c3, 2);
    return;
  }
  const copper = item.startsWith('copper');
  const plate = item.endsWith('plate');
  g.fillStyle(0x1f372f, 0.2).fillEllipse(x + 3, y + 2, 15, 7);
  prism(g, x, y, plate ? 8 : 6, plate ? 4 : 3, plate ? 2 : 6,
    copper ? 0xdbad7c : 0xc5d3ca, copper ? 0xa87954 : 0x8ca49a, copper ? 0x886244 : 0x6c887c);
}

export function drawPreview(g: Graphics, c: number, r: number, color: number): void {
  const { x, y } = project(c, r);
  diamond(g, x, y, HALF_WIDTH - 1, HALF_HEIGHT - 1, color, 0.24);
  g.lineStyle(2, color, 0.9);
  g.strokePoints([
    { x, y: y - HALF_HEIGHT }, { x: x + HALF_WIDTH, y },
    { x, y: y + HALF_HEIGHT }, { x: x - HALF_WIDTH, y },
  ], true);
}
