import * as THREE from 'three';
import { TrackballControls } from 'three/addons/controls/TrackballControls.js';
import { FACE_AXES, firstImpact, impactMotion, movingPath, surfacePath, toWorld, worldDirection } from './geometry';
import { FACES, headFace, type Face, type Layout, type PuzzleLine } from './rules';
import type { Vec3 } from './surface';

const INK = 0x192739;
const ACCENT = 0x8543d6;
const BLOCKED = 0xc33f28;
const DEFAULT_VIEW = new THREE.Vector3(4.3, 3.3, 5.4);
type LineAnimation = { line: PuzzleLine; start: number; done: () => void } & (
  { kind: 'remove'; duration: number } |
  { kind: 'blocked'; distance: number; blocker: PuzzleLine; impacted: boolean }
);

export class CubeRenderer {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(36, 1, 0.1, 60);
  private controls: TrackballControls;
  private cube: THREE.Mesh;
  private raycaster = new THREE.Raycaster();
  private groups = new Map<string, THREE.Group>();
  private layout: Layout = { size: 4, lines: [] };
  private resizeObserver: ResizeObserver;
  private abort = new AbortController();
  private frame = 0;
  private animation: LineAnimation | null = null;
  private shake: Animation | null = null;
  private marked: string | null = null;
  private blockedIds: readonly string[] = [];
  private blockedUntil = 0;
  private tap: { id: number; x: number; y: number } | null = null;
  private pointers = new Set<number>();
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private enabled = true;
  private dirty = true;

  constructor(private host: HTMLElement, private onPick: (id: string) => void,
    private onError: (message: string) => void) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.canvas = this.renderer.domElement;
    this.canvas.tabIndex = -1;
    this.canvas.setAttribute('aria-label', '3D puzzle. Drag to rotate, tap a line to release it, and pinch or scroll to zoom.');
    this.host.appendChild(this.canvas);
    this.camera.position.copy(DEFAULT_VIEW);
    this.controls = new TrackballControls(this.camera, this.canvas);
    this.controls.noPan = true;
    this.controls.staticMoving = true;
    this.controls.keys = ['', '', ''];
    this.controls.minDistance = 4.8;
    this.controls.maxDistance = 12;
    this.controls.rotateSpeed = 2;
    this.controls.zoomSpeed = 0.7;
    this.controls.addEventListener('change', () => { this.dirty = true; });
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x79749b, 2.6));
    const light = new THREE.DirectionalLight(0xffffff, 2.5);
    light.position.set(3, 6, 5);
    this.scene.add(light);
    const colors = [0xe4e5f4, 0xd6dce9, 0xf4f5fa, 0xd4d9e9, 0xeef2fa, 0xdde5f0];
    this.cube = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2),
      colors.map(color => new THREE.MeshStandardMaterial({ color, roughness: 0.8 })));
    this.scene.add(this.cube);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(this.cube.geometry),
      new THREE.LineBasicMaterial({ color: 0xa0adc2, transparent: true, opacity: 0.5 }));
    this.scene.add(edges);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.host);
    const options = { signal: this.abort.signal };
    this.canvas.addEventListener('pointerdown', event => {
      this.pointers.add(event.pointerId);
      this.tap = this.pointers.size === 1 && event.button === 0
        ? { id: event.pointerId, x: event.clientX, y: event.clientY } : null;
    }, options);
    this.canvas.addEventListener('pointermove', event => {
      if (this.tap && Math.hypot(event.clientX - this.tap.x, event.clientY - this.tap.y) > 7) this.tap = null;
      if (!this.pointers.size) this.canvas.style.cursor = this.pick(event.clientX, event.clientY) ? 'pointer' : 'grab';
    }, options);
    this.canvas.addEventListener('pointerup', event => {
      this.pointers.delete(event.pointerId);
      if (this.tap?.id === event.pointerId && this.enabled) {
        const id = this.pick(event.clientX, event.clientY);
        if (id) this.onPick(id);
      }
      this.tap = null;
    }, options);
    this.canvas.addEventListener('pointercancel', event => {
      this.pointers.delete(event.pointerId);
      this.tap = null;
    }, options);
    this.canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      this.enabled = false;
      this.onError('The 3D view lost its graphics context. Reload to restore the saved puzzle.');
    }, options);
    this.resize();
    this.tick();
  }

  private resize(): void {
    const { width, height } = this.host.getBoundingClientRect();
    if (!width || !height) return;
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.controls.handleResize();
    this.dirty = true;
  }

  private clearGroup(group: THREE.Group): void {
    const materials = new Set<THREE.Material>();
    for (const child of [...group.children]) {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        const list = Array.isArray(child.material) ? child.material : [child.material];
        list.forEach(material => materials.add(material));
      }
      group.remove(child);
    }
    materials.forEach(material => material.dispose());
  }

  private drawLine(line: PuzzleLine, path: readonly Vec3[], group: THREE.Group, opacity = 1): void {
    this.dirty = true;
    this.clearGroup(group);
    const highlighted = line.id === this.marked;
    const blocked = this.blockedIds.includes(line.id);
    const material = new THREE.MeshBasicMaterial({
      color: highlighted ? ACCENT : blocked ? BLOCKED : INK,
      transparent: opacity < 1,
      opacity,
      side: THREE.DoubleSide,
    });
    const radius = 2 / this.layout.size * (highlighted || blocked ? 0.09 : 0.065);
    const points = path.map(point => new THREE.Vector3(...point));
    for (let i = 1; i < points.length; i++) {
      const from = points[i - 1];
      const to = points[i];
      const delta = new THREE.Vector3().subVectors(to, from);
      if (delta.length() < 0.0001) continue;
      const segment = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), 8), material);
      segment.position.copy(from).add(to).multiplyScalar(0.5);
      segment.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
      group.add(segment);
    }
    for (const point of points.slice(0, -1)) {
      const join = new THREE.Mesh(new THREE.SphereGeometry(radius, 8, 6), material);
      join.position.copy(point);
      group.add(join);
    }
    const head = path[path.length - 1];
    const d = worldDirection(line);
    const n = new THREE.Vector3(...FACE_AXES[headFace(line)].normal);
    const side = new THREE.Vector3().crossVectors(n, new THREE.Vector3(...d));
    const scale = 2 / this.layout.size;
    const triangle = [
      [0.28, 0], [-0.25, 0.24], [-0.25, -0.24],
    ].flatMap(([forward, lateral]) => head.map((value, axis) =>
      value + d[axis] * forward * scale + side.getComponent(axis) * lateral * scale + n.getComponent(axis) * 0.003));
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(triangle, 3));
    group.add(new THREE.Mesh(geometry, material));
  }

  setLayout(layout: Layout, highlightedId: string | null = null): void {
    this.dirty = true;
    this.animation = null;
    this.shake?.cancel();
    this.shake = null;
    for (const group of this.groups.values()) {
      this.clearGroup(group);
      this.scene.remove(group);
    }
    this.groups.clear();
    this.layout = layout;
    this.marked = layout.lines.some(line => line.id === highlightedId) ? highlightedId : null;
    this.blockedIds = [];
    for (const line of layout.lines) {
      const group = new THREE.Group();
      this.groups.set(line.id, group);
      this.scene.add(group);
      this.drawLine(line, surfacePath(line, layout.size), group);
    }
  }

  private recolor(): void {
    for (const line of this.layout.lines) {
      const group = this.groups.get(line.id);
      if (group && this.animation?.line.id !== line.id) this.drawLine(line, surfacePath(line, this.layout.size), group);
    }
  }

  highlight(line: PuzzleLine): void {
    this.marked = line.id;
    this.faceView(headFace(line));
    this.recolor();
  }

  get isAnimating(): boolean {
    return this.animation !== null;
  }

  slam(line: PuzzleLine, done: () => void): void {
    const impact = firstImpact(line, this.layout.lines, this.layout.size);
    if (!impact) throw new Error(`Cube Lines: no obstruction for blocked line ${line.id}.`);
    this.animation = {
      kind: 'blocked', line, done, start: performance.now(),
      distance: impact.distance, blocker: impact.blocker, impacted: false,
    };
  }

  private strike(line: PuzzleLine, blocker: PuzzleLine): void {
    this.blockedIds = [line.id, blocker.id];
    this.blockedUntil = performance.now() + 600;
    this.recolor();
    if (this.reducedMotion.matches) return;
    const head = line.cells[line.cells.length - 1];
    const d = new THREE.Vector3(...worldDirection(line));
    const origin = new THREE.Vector3(...toWorld(head.face, head, this.layout.size));
    const from = origin.clone().project(this.camera);
    const to = origin.addScaledVector(d, 2 / this.layout.size).project(this.camera);
    const axis = new THREE.Vector2(to.x - from.x, -(to.y - from.y)).normalize();
    this.shake?.cancel();
    this.shake = this.canvas.animate([0, 1, -0.65, 0.4, -0.2, 0].map((weight, index) => ({
      transform: `translate(${axis.x * weight * 7}px, ${axis.y * weight * 7}px) rotate(${weight * 0.22}deg)`,
      offset: [0, 0.1, 0.28, 0.49, 0.73, 1][index],
    })), { duration: 280, easing: 'ease-out' });
  }

  remove(line: PuzzleLine, done: () => void): void {
    this.animation = {
      kind: 'remove', line, done, start: performance.now(),
      duration: this.reducedMotion.matches ? 0 : Math.min(900, 380 + line.cells.length * 25),
    };
  }

  resetView(): void {
    this.placeCamera(DEFAULT_VIEW, new THREE.Vector3(0, 1, 0));
  }

  faceView(face: Face): void {
    const { normal, v } = FACE_AXES[face];
    this.placeCamera(new THREE.Vector3(...normal).multiplyScalar(6.8), new THREE.Vector3(...v));
  }

  private placeCamera(position: THREE.Vector3, up: THREE.Vector3): void {
    this.controls.update();
    this.camera.position.copy(position);
    this.camera.up.copy(up);
    this.controls.target.set(0, 0, 0);
    this.camera.lookAt(0, 0, 0);
    this.controls.update();
    this.dirty = true;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.controls.enabled = enabled;
    if (!enabled) {
      this.animation = null;
      this.shake?.cancel();
    }
  }

  private pick(x: number, y: number): string | null {
    if (!this.enabled || this.animation) return null;
    const rect = this.canvas.getBoundingClientRect();
    this.raycaster.setFromCamera(new THREE.Vector2(
      (x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1), this.camera);
    const hit = this.raycaster.intersectObject(this.cube)[0];
    if (!hit?.face) return null;
    const normal = hit.face.normal;
    const face = FACES.find(name => new THREE.Vector3(...FACE_AXES[name].normal).dot(normal) > 0.99);
    if (!face) return null;
    const { u, v } = FACE_AXES[face];
    const cx = (hit.point.dot(new THREE.Vector3(...u)) + 1) * this.layout.size / 2 - 0.5;
    const cy = (hit.point.dot(new THREE.Vector3(...v)) + 1) * this.layout.size / 2 - 0.5;
    let closest: string | null = null;
    let distance = 0.3;
    const normalVector = new THREE.Vector3(...FACE_AXES[face].normal);
    const uVector = new THREE.Vector3(...u);
    const vVector = new THREE.Vector3(...v);
    for (const line of this.layout.lines) {
      const path = surfacePath(line, this.layout.size).map(point => new THREE.Vector3(...point));
      for (let i = 1; i < path.length; i++) {
        if ([path[i - 1], path[i]].some(point => Math.abs(point.dot(normalVector) - 1.02) > 0.0001)) continue;
        const local = (point: THREE.Vector3) => ({
          x: (point.dot(uVector) + 1) * this.layout.size / 2 - 0.5,
          y: (point.dot(vVector) + 1) * this.layout.size / 2 - 0.5,
        });
        const a = local(path[i - 1]);
        const b = local(path[i]);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const t = THREE.MathUtils.clamp(((cx - a.x) * dx + (cy - a.y) * dy) / (dx * dx + dy * dy), 0, 1);
        const candidate = Math.hypot(cx - a.x - dx * t, cy - a.y - dy * t);
        if (candidate < distance) { distance = candidate; closest = line.id; }
      }
    }
    return closest;
  }

  private tick = (): void => {
    this.frame = requestAnimationFrame(this.tick);
    this.controls.update();
    if (this.blockedIds.length && performance.now() > this.blockedUntil) {
      this.blockedIds = [];
      this.recolor();
    }
    const animation = this.animation;
    if (animation) {
      const elapsed = performance.now() - animation.start;
      const group = this.groups.get(animation.line.id);
      let complete: boolean;
      if (animation.kind === 'blocked') {
        const motion = impactMotion(elapsed, animation.distance);
        const reduced = this.reducedMotion.matches;
        if ((motion.hit || reduced) && !animation.impacted) {
          animation.impacted = true;
          this.strike(animation.line, animation.blocker);
        }
        if (group) this.drawLine(animation.line,
          reduced ? surfacePath(animation.line, this.layout.size) : movingPath(animation.line, motion.distance, this.layout.size), group);
        complete = reduced ? elapsed >= 220 : motion.complete;
      } else {
        const t = animation.duration === 0 ? 1 : Math.min(1, elapsed / animation.duration);
        if (group) {
          const travel = this.layout.size + animation.line.cells.length + 1;
          this.drawLine(animation.line, movingPath(animation.line, travel * (1 - (1 - t) ** 2), this.layout.size),
            group, Math.min(1, (1 - t) * 5));
        }
        complete = t === 1;
      }
      if (complete) {
        this.animation = null;
        if (group && animation.kind === 'blocked') this.drawLine(animation.line, surfacePath(animation.line, this.layout.size), group);
        animation.done();
      }
    }
    if (this.dirty) {
      this.renderer.render(this.scene, this.camera);
      this.dirty = false;
    }
  };

  dispose(): void {
    cancelAnimationFrame(this.frame);
    this.animation = null;
    this.shake?.cancel();
    this.abort.abort();
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.scene.traverse(object => {
      if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach(material => material.dispose());
      }
    });
    this.renderer.dispose();
    this.canvas.remove();
  }
}
