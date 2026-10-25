import { H, W } from "./engine";
export type Point = { x: number; y: number };
/** Affine ground-plane camera. The inverse is shared by mouse and touch aiming. */
export class Camera {
  x = W / 2;
  y = H / 2;
  heading = -Math.PI / 2;
  overview = true;
  readonly zoom = 2.35;
  readonly tilt = 0.76;
  update(
    position: Point & { angle: number },
    dt: number,
    overview: boolean,
    reduced: boolean,
  ) {
    const changed = overview !== this.overview;
    this.overview = overview;
    this.x = position.x;
    this.y = position.y;
    // Reduced-motion players get a fixed north-up view without camera rotation.
    const desired = reduced ? -Math.PI / 2 : position.angle;
    const delta = Math.atan2(
      Math.sin(desired - this.heading),
      Math.cos(desired - this.heading),
    );
    this.heading +=
      changed || reduced ? delta : delta * (1 - Math.exp(-Math.max(0, dt) * 8));
  }
  get rotation() {
    return -Math.PI / 2 - this.heading;
  }
  toScreen(point: Point): Point {
    if (this.overview) return { ...point };
    const dx = point.x - this.x,
      dy = point.y - this.y;
    const c = Math.cos(this.rotation),
      s = Math.sin(this.rotation);
    return {
      x: W / 2 + (dx * c - dy * s) * this.zoom,
      y: H * 0.68 + (dx * s + dy * c) * this.zoom * this.tilt,
    };
  }
  toWorld(point: Point): Point {
    if (this.overview) return { ...point };
    const dx = (point.x - W / 2) / this.zoom,
      dy = (point.y - H * 0.68) / (this.zoom * this.tilt);
    const c = Math.cos(this.rotation),
      s = Math.sin(this.rotation);
    return { x: this.x + dx * c + dy * s, y: this.y - dx * s + dy * c };
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
