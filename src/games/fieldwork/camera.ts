import { H, W } from "./engine";
export type Point = { x: number; y: number };
/** Affine ground-plane camera. The inverse is shared by mouse and touch aiming. */
export class Camera {
  x = W / 2;
  y = H / 2;
  overview = true;
  readonly zoom = 1.55;
  update(position: Point & { angle: number }, overview: boolean) {
    this.overview = overview;
    this.x = position.x;
    this.y = position.y;
  }
  toScreen(point: Point): Point {
    if (this.overview) return { ...point };
    return {
      x: W / 2 + (point.x - this.x) * this.zoom,
      y: H / 2 + (point.y - this.y) * this.zoom,
    };
  }
  toWorld(point: Point): Point {
    if (this.overview) return { ...point };
    return {
      x: this.x + (point.x - W / 2) / this.zoom,
      y: this.y + (point.y - H / 2) / this.zoom,
    };
  }
}
export const MAP = { x: W - 128, y: 16, width: 112, height: 142 };
export function onMap(point: Point) {
  return (
    point.x >= MAP.x - 6 &&
    point.x <= MAP.x + MAP.width + 6 &&
    point.y >= MAP.y - 6 &&
    point.y <= MAP.y + MAP.height + 22
  );
}
