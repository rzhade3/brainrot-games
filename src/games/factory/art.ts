import Phaser from 'phaser';
import {
  Building, conveyorInputs, Direction, DIRECTIONS, HALF_HEIGHT, HALF_WIDTH, nextDirection, Point, project, variation,
} from './model';
import { Item } from './simulation';
import type { Biome } from './world';

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

export function drawTree(g: Graphics, x: number, y: number, c: number, r: number, biome: Biome = 'upland'): void {
  g.fillStyle(0x314f40, 0.14).fillEllipse(x + 9, y + 4, 44, 15);
  if (biome !== 'upland') {
    const height = 34 + variation(c, r) * 8;
    prism(g, x, y, 3, 1.5, height, 0xa18f6b, 0x776d55, 0x615e4b);
    line(g, { x, y: y - 20 }, { x: x - 13, y: y - 38 }, 0x776d55, 3);
    line(g, { x, y: y - 24 }, { x: x + 11, y: y - 43 }, 0x615e4b, 3);
    const crown = biome === 'riverbank' ? [0x4f735b, 0x6e8d68, 0x8aa078] : [0x70885e, 0x91a473, 0xa7b47e];
    const top = y - height - 9;
    g.fillStyle(crown[0]).fillEllipse(x + 3, top + 7, 48, 32);
    g.fillStyle(crown[1]).fillEllipse(x - 12, top, 34, 28);
    g.fillStyle(crown[1]).fillEllipse(x + 12, top - 6, 34, 30);
    g.fillStyle(crown[2]).fillEllipse(x - 7, top - 10, 30, 23);
    g.fillStyle(crown[2], 0.6).fillEllipse(x + 13, top - 11, 16, 11);
    line(g, { x: x - 5, y: y + 1 }, { x: x + 1, y: y - 5 }, 0x776d55, 2);
    line(g, { x: x + 6, y: y + 2 }, { x: x + 1, y: y - 5 }, 0x615e4b, 2);
    return;
  }
  const shape = variation(c, r);
  const spread = 17 + shape * 5;
  line(g, { x, y }, { x: x - 10, y: y - 16 }, 0x776d55, 2);
  line(g, { x: x + 2, y }, { x: x + 13, y: y - 18 }, 0x615e4b, 2);
  g.fillStyle(0x596c50).fillEllipse(x + 2, y - 8, spread * 2.2, 17);
  for (let i = 0; i < 5; i++) {
    const dx = (i - 2) * spread * 0.4;
    const top = y - 13 - variation(c + i * 3, r + i) * 9;
    const width = 15 + variation(c + i, r + 5) * 9;
    g.fillStyle(i % 2 ? 0x879574 : 0x748568).fillEllipse(x + dx, top, width, 17);
    g.fillStyle(0xa5ae89, 0.65).fillEllipse(x + dx - 3, top - 4, width * 0.6, 7);
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

export function drawBuilding(g: Graphics, b: Building, buildings?: ReadonlyMap<string, Building>): void {
  const { x, y } = project(b.c, b.r);
  if (b.kind === 'belt') {
    drawBelt(g, x, y, b.direction, buildings ? conveyorInputs(b, buildings) : []);
    return;
  }
  if (b.kind === 'splitter') {
    drawSplitter(g, x, y, b.direction);
    return;
  }
  g.fillStyle(0x243c36, 0.18).fillEllipse(x + 10, y + 10, 68, 23);
  prism(g, x, y, 32, 16, 5, 0xc5c9b9, 0x929f93, 0x7c9087);
  if (b.kind === 'food-plot') {
    diamond(g, x, y - 6, 29, 14, 0x84745a);
    for (let i = -2; i <= 2; i++) {
      const a = project(i * 0.15 - 0.3, i * 0.15 + 0.3);
      const z = project(i * 0.15 + 0.3, i * 0.15 - 0.3);
      line(g, { x: x + a.x, y: y - 7 + a.y }, { x: x + z.x, y: y - 7 + z.y }, 0xa69872, 3);
      for (let j = -1; j <= 1; j++) {
        const p = project(i * 0.15 + j * 0.16, i * 0.15 - j * 0.16);
        g.fillStyle(0x658658).fillEllipse(x + p.x, y - 10 + p.y, 7, 5);
        g.fillStyle(0x9db579).fillEllipse(x + p.x - 1, y - 12 + p.y, 4, 4);
      }
    }
  } else if (b.kind === 'home' || b.kind === 'kitchen') {
    const kitchen = b.kind === 'kitchen';
    prism(g, x, y - 4, 27, 13.5, 28, 0xe2ddc9, 0xa9b09a, 0x839783);
    polygon(g, [{ x: x - 31, y: y - 32 }, { x: x - 4, y: y - 53 },
      { x: x + 31, y: y - 32 }, { x, y: y - 16 }], kitchen ? 0x9f9473 : 0x7d9488);
    polygon(g, [{ x: x - 4, y: y - 53 }, { x: x + 31, y: y - 32 },
      { x: x + 31, y: y - 28 }, { x: x - 4, y: y - 48 }], kitchen ? 0x756e56 : 0x526e66);
    prism(g, x + 15, y - 34, 5, 2.5, 19, 0xb6c0af, 0x7e9485, 0x5d7d71);
    polygon(g, [{ x: x - 19, y: y - 19 }, { x: x - 9, y: y - 14 },
      { x: x - 9, y: y + 1 }, { x: x - 19, y: y - 4 }], 0x567464);
    g.fillStyle(0xe8ce8b).fillEllipse(x + 12, y - 13, 8, 6);
    if (kitchen) {
      prism(g, x - 21, y + 2, 12, 6, 9, 0xd7b77b, 0xaa8d5c, 0x927648);
      drawParcel(g, x - 21, y - 7, 'food-unit');
    }
  } else if (b.kind === 'miner') {
    prism(g, x, y - 3, 26, 13, 18, 0xa9bab1, 0x718a80, 0x526e66);
    prism(g, x - 5, y - 8, 19, 9, 20, 0xd8b66f, 0x9b8050, 0x806941);
    prism(g, x + 10, y - 6, 9, 4, 33, 0xe0dfd1, 0x9cab9f, 0x71897f);
    g.fillStyle(0x344b48).fillEllipse(x - 5, y - 45, 20, 10);
    g.fillStyle(0x8fa5a0).fillEllipse(x - 5, y - 46, 13, 6);
    line(g, { x: x - 24, y: y - 15 }, { x: x - 5, y: y - 6 }, 0xd9c58e, 3);
    g.fillStyle(0xe8ce8b).fillCircle(x + 15, y - 25, 2);
    if (b.upgraded) line(g, { x: x - 18, y: y - 23 }, { x: x - 6, y: y - 17 }, 0x3f8c76, 4);
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
  if (b.kind === 'outpost' || b.kind === 'home' || b.kind === 'kitchen') return;
  const vector = DIRECTIONS[b.direction];
  const end = project(b.c + vector.c * 0.45, b.r + vector.r * 0.45);
  if (b.kind === 'storage' && b.outputEnabled) drawArrow(g, end.x, end.y + 1, b.direction, 0x3f8c76, 0.75);
  else diamond(g, end.x, end.y - 4, 4, 2, 0xd8bd7d);
}

function drawBelt(g: Graphics, x: number, y: number, direction: Direction, inputs: readonly Direction[]): void {
  prism(g, x, y + 1, HALF_WIDTH - 3, HALF_HEIGHT - 2, 5, 0xaeb4a2, 0x78887a, 0x62796d);
  diamond(g, x, y - 5, HALF_WIDTH - 8, HALF_HEIGHT - 5, 0x4e6259);
  const along = DIRECTIONS[direction];
  const across = DIRECTIONS[(direction + 1) % 4];
  for (let i = -2; i <= 2; i++) {
    const a = project(along.c * i * 0.15 - across.c * 0.31, along.r * i * 0.15 - across.r * 0.31);
    const b = project(along.c * i * 0.15 + across.c * 0.31, along.r * i * 0.15 + across.r * 0.31);
    line(g, { x: x + a.x, y: y - 5 + a.y }, { x: x + b.x, y: y - 5 + b.y }, 0x91a08d, 1.5, 0.7);
  }
  if (inputs.length > 1 || inputs.some(input => input !== direction)) {
    for (const input of inputs) {
      drawTrack(g, x, y, input, -0.43);
      const vector = DIRECTIONS[input];
      const p = project(-vector.c * 0.29, -vector.r * 0.29);
      drawArrow(g, x + p.x, y + p.y, input, 0xb8c6ab, 0.65);
    }
    drawTrack(g, x, y, direction, 0.43);
    const p = project(along.c * 0.27, along.r * 0.27);
    drawArrow(g, x + p.x, y + p.y, direction, 0xdac58c);
    if (inputs.length > 1) g.fillStyle(0xdac58c).fillCircle(x, y - 5, 2.5);
  } else drawArrow(g, x, y, direction, 0xdac58c);
}

function drawTrack(g: Graphics, x: number, y: number, direction: Direction, length: number): void {
  const vector = DIRECTIONS[direction];
  const p = project(vector.c * length, vector.r * length);
  line(g, { x, y: y - 5 }, { x: x + p.x, y: y - 5 + p.y }, 0x354f45, 10);
  line(g, { x, y: y - 5 }, { x: x + p.x, y: y - 5 + p.y }, 0x91a08d, 4, 0.8);
}

function drawArrow(g: Graphics, x: number, y: number, direction: Direction, color: number, scale = 1): void {
  const along = DIRECTIONS[direction];
  const across = DIRECTIONS[nextDirection(direction)];
  const tip = project(along.c * 0.18 * scale, along.r * 0.18 * scale);
  const left = project((-along.c * 0.08 + across.c * 0.12) * scale, (-along.r * 0.08 + across.r * 0.12) * scale);
  const right = project((-along.c * 0.08 - across.c * 0.12) * scale, (-along.r * 0.08 - across.r * 0.12) * scale);
  polygon(g, [
    { x: x + tip.x, y: y - 5 + tip.y },
    { x: x + left.x, y: y - 5 + left.y },
    { x: x + right.x, y: y - 5 + right.y },
  ], color);
}

function drawSplitter(g: Graphics, x: number, y: number, direction: Direction): void {
  prism(g, x, y + 1, HALF_WIDTH - 3, HALF_HEIGHT - 2, 5, 0xc7b27d, 0x99865e, 0x7a785c);
  diamond(g, x, y - 5, HALF_WIDTH - 8, HALF_HEIGHT - 5, 0x4e6259);
  drawTrack(g, x, y, direction, -0.43);
  const incoming = DIRECTIONS[direction];
  const entry = project(-incoming.c * 0.3, -incoming.r * 0.3);
  drawArrow(g, x + entry.x, y + entry.y, direction, 0xb8c6ab, 0.7);
  for (const output of [direction, nextDirection(direction)]) {
    drawTrack(g, x, y, output, 0.43);
    const vector = DIRECTIONS[output];
    const p = project(vector.c * 0.3, vector.r * 0.3);
    drawArrow(g, x + p.x, y + p.y, output, 0xe9cb81, 0.8);
  }
  prism(g, x, y - 5, 5, 2.5, 3, 0xe9cb81, 0xb49763, 0x9b8050);
}

export function drawParcel(g: Graphics, x: number, y: number, item: Item): void {
  if (item === 'food-unit') {
    prism(g, x, y, 7, 3.5, 5, 0xb9be82, 0x92975b, 0x727c4d);
    line(g, { x: x - 4, y: y - 5 }, { x: x + 3, y: y - 2 }, 0xe0d7a4, 1.5);
    return;
  }
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

export function drawResident(
  g: Graphics, x: number, y: number, id: number, stride: number,
  cargo: Item | null, farming: boolean, facing: Point,
): void {
  g.fillStyle(0x243c36, 0.2).fillEllipse(x + 2, y + 1, 15, 6);
  const swing = Math.sin(stride) * 2;
  const shirt = [0x829c8a, 0xbca777, 0x9bafa4, 0xc19c80][id];
  const skin = [0xd9b997, 0xb88b6b, 0xccaa87, 0xa87b5a][id];
  if (facing.x !== 0) {
    const side = Math.sign(facing.x);
    const away = facing.y < 0;
    const stepX = swing * side;
    const stepY = swing * facing.y / Math.abs(facing.x);
    const bob = Math.abs(Math.sin(stride)) * 0.6;
    const shoulderY = y - 14 - bob;
    const handX = x + side * (cargo ? 7 : 3) - (cargo ? 0 : stepX);
    const handY = y - 10 - bob - (cargo ? 0 : stepY);
    line(g, { x: x - side, y: y - 7 }, { x: x - stepX - side, y: y - stepY - 1 }, 0x405b54, 2.5);
    line(g, { x: x - side * 2, y: shoulderY - 1 },
      { x: x + side * (cargo ? 6 : 2) + (cargo ? 0 : stepX), y: y - 11 - bob + (cargo ? 0 : stepY) }, skin, 2);
    line(g, { x: x + side, y: y - 7 }, { x: x + stepX + side, y: y + stepY }, 0x526e66, 2.5);
    prism(g, x, y - 7 - bob, 3.5, 2, 9, shirt,
      side < 0 && !away ? shirt : 0x718a80, side > 0 && !away ? shirt : 0x526e66);
    g.fillStyle(skin).fillEllipse(x, y - 21 - bob, 6, 7);
    g.fillStyle(skin).fillCircle(x + side * 3, y - 20.5 - bob, 1.3);
    g.fillStyle(0x596f5f).fillEllipse(x - side, y - 23 - bob, away ? 6 : 4, away ? 5 : 3);
    if (!away) g.fillStyle(0x344b48).fillCircle(x + side * 1.8, y - 21.5 - bob, 0.65);
    g.fillStyle(0x596f5f).fillEllipse(x + side, y - 24 - bob, 9, 3);
    if (cargo) drawParcel(g, x + side * 8, y - 9 - bob, cargo);
    line(g, { x: x + side * 2, y: shoulderY }, { x: handX, y: handY }, skin, 2.5);
    if (farming) line(g, { x: handX, y: handY - 2 },
      { x: handX + side * 6, y: y - 2 + swing }, 0xaa8d5c, 2);
    return;
  }
  line(g, { x: x - 2, y: y - 7 }, { x: x - 3 - swing, y }, 0x526e66, 2.5);
  line(g, { x: x + 2, y: y - 7 }, { x: x + 3 + swing, y }, 0x526e66, 2.5);
  prism(g, x, y - 7, 5, 2.5, 9, shirt, 0x718a80, 0x526e66);
  g.fillStyle(skin).fillCircle(x, y - 21, 3.5);
  g.fillStyle(0x596f5f).fillEllipse(x, y - 24, 9, 4);
  line(g, { x: x - 5, y: y - 14 }, { x: x - 8, y: y - 10 + swing }, 0xcbb391, 2);
  line(g, { x: x + 5, y: y - 14 }, { x: x + 8, y: y - 10 - swing }, 0xcbb391, 2);
  if (cargo) drawParcel(g, x + 8, y - 9, cargo);
  if (farming) line(g, { x: x + 7, y: y - 12 }, { x: x + 13, y: y - 2 + swing }, 0xaa8d5c, 2);
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
