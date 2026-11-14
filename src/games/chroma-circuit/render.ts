import { palette, SIZE, type Mosaic } from './art';
import { riderPosition, type Circuit, type Hit } from './engine';

const MARGIN = 3.05;
const AREA = SIZE + MARGIN * 2;
const TRACK_EDGE = -1.6;
const TRACK_WIDTH = SIZE - 2 * TRACK_EDGE;
const TRACK_RADIUS = 1;
const TRACK_STRAIGHT = TRACK_WIDTH - 2 * TRACK_RADIUS;
const TRACK_QUARTER = TRACK_STRAIGHT + Math.PI / 2 * TRACK_RADIUS;
const ARROW_SPACING = TRACK_QUARTER / 3;

function drawBeltArrows(ctx: CanvasRenderingContext2D, now: number, reducedMotion: boolean): void {
  const offset = reducedMotion ? ARROW_SPACING / 2 : now / 115 % ARROW_SPACING;
  ctx.strokeStyle = '#5f79ad';
  ctx.lineWidth = .13;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.save();
  ctx.translate(SIZE / 2, SIZE / 2);
  for (let side = 0; side < 4; side++) {
    for (let arrow = 0; arrow < 3; arrow++) {
      const distance = arrow * ARROW_SPACING + offset;
      const angle = Math.max(0, distance - TRACK_STRAIGHT) / TRACK_RADIUS;
      const x = Math.min(distance, TRACK_STRAIGHT) - TRACK_STRAIGHT / 2 + Math.sin(angle) * TRACK_RADIUS;
      const y = -TRACK_STRAIGHT / 2 - Math.cos(angle) * TRACK_RADIUS;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(-.15, -.22);
      ctx.lineTo(.15, 0);
      ctx.lineTo(-.15, .22);
      ctx.stroke();
      ctx.restore();
    }
    ctx.rotate(Math.PI / 2);
  }
  ctx.restore();
}

function context(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  return canvas.getContext('2d')!;
}

export function drawTiles(ctx: CanvasRenderingContext2D, tiles: Mosaic, marks = false): void {
  for (let index = 0; index < tiles.length; index++) {
    const color = tiles[index];
    if (!color) continue;
    const x = index % SIZE;
    const y = Math.floor(index / SIZE);
    ctx.fillStyle = palette[color].fill;
    ctx.beginPath();
    ctx.roundRect(x + .018, y + .018, .964, .964, .12);
    ctx.fill();
    ctx.fillStyle = '#ffffff46';
    ctx.fillRect(x + .11, y + .08, .78, .11);
    ctx.fillStyle = '#28133d35';
    ctx.fillRect(x + .09, y + .8, .82, .12);
    if (marks) {
      ctx.fillStyle = color === 'ink' ? '#fff' : '#2d1c3f';
      ctx.font = 'bold .64px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(palette[color].mark, x + .5, y + .49);
    }
  }
}

export function drawThumbnail(canvas: HTMLCanvasElement, tiles: Mosaic): void {
  const ctx = context(canvas);
  ctx.scale(canvas.width / SIZE, canvas.height / SIZE);
  drawTiles(ctx, tiles);
}

export class BoardRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly tiles = document.createElement('canvas');
  private readonly tileContext: CanvasRenderingContext2D;
  private hits: Hit[] = [];

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = context(canvas);
    this.tiles.width = this.tiles.height = 1040;
    this.tileContext = context(this.tiles);
    this.tileContext.scale(40, 40);
  }

  updateTiles(tiles: Mosaic, marks: boolean): void {
    this.tileContext.clearRect(0, 0, SIZE, SIZE);
    drawTiles(this.tileContext, tiles, marks);
  }

  addHit(hit: Hit): void {
    this.hits.push(hit);
  }

  reset(): void {
    this.hits = [];
  }

  draw(game: Circuit, now: number, reducedMotion: boolean, marks: boolean): void {
    const size = Math.round(this.canvas.clientWidth * Math.min(window.devicePixelRatio || 1, 3));
    if (size === 0) return;
    if (this.canvas.width !== size) this.canvas.width = this.canvas.height = size;
    const ctx = this.ctx;
    const scale = size / AREA;
    ctx.setTransform(scale, 0, 0, scale, MARGIN * scale, MARGIN * scale);
    ctx.clearRect(-MARGIN, -MARGIN, AREA, AREA);

    ctx.fillStyle = '#edf4ff';
    ctx.beginPath();
    ctx.roundRect(-.6, -.6, SIZE + 1.2, SIZE + 1.2, 1.15);
    ctx.fill();

    ctx.beginPath();
    ctx.roundRect(TRACK_EDGE, TRACK_EDGE + .22, TRACK_WIDTH, TRACK_WIDTH, TRACK_RADIUS);
    ctx.lineWidth = 2.03;
    ctx.strokeStyle = '#5575b57d';
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(TRACK_EDGE, TRACK_EDGE, TRACK_WIDTH, TRACK_WIDTH, TRACK_RADIUS);
    ctx.lineWidth = 1.95;
    ctx.strokeStyle = '#647eb4';
    ctx.stroke();
    ctx.lineWidth = 1.52;
    ctx.strokeStyle = '#afc2ec';
    ctx.stroke();
    drawBeltArrows(ctx, now, reducedMotion);

    ctx.fillStyle = '#4f67a0';
    ctx.beginPath();
    ctx.roundRect(SIZE / 2 - 1.65, SIZE + 1.12, 3.3, .96, .42);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold .67px system-ui';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText('‹ ‹ ‹', SIZE / 2, SIZE + 1.6);
    ctx.drawImage(this.tiles, 0, 0, SIZE, SIZE);

    this.hits = this.hits.filter(hit => game.time - hit.time < 240);
    if (!reducedMotion) this.hits.forEach(hit => this.drawHit(hit, game.time - hit.time));

    for (const rider of game.riders) {
      const { x, y } = riderPosition(rider, game.time);
      const color = palette[rider.color];
      ctx.fillStyle = '#27174366';
      ctx.beginPath();
      ctx.roundRect(x - 1.35, y - 1, 2.7, 2.35, .78);
      ctx.fill();
      ctx.fillStyle = color.fill;
      ctx.beginPath();
      ctx.roundRect(x - 1.35, y - 1.23, 2.7, 2.35, .78);
      ctx.fill();
      ctx.fillStyle = '#ffffff65';
      ctx.beginPath();
      ctx.roundRect(x - .84, y - 1, 1.68, .17, .085);
      ctx.fill();
      ctx.fillStyle = rider.color === 'ink' ? '#fff' : '#241932';
      ctx.font = '800 1.13px system-ui';
      const label = marks ? `${color.mark} ${rider.ammo}` : String(rider.ammo);
      ctx.fillText(label, x, y + .05, 2.35);
    }
  }

  private drawHit(hit: Hit, elapsed: number): void {
    const ctx = this.ctx;
    const x = hit.tile % SIZE + .5;
    const y = Math.floor(hit.tile / SIZE) + .5;
    const flight = Math.min(1, elapsed / 90);
    const bx = hit.x + (x - hit.x) * flight;
    const by = hit.y + (y - hit.y) * flight;
    ctx.fillStyle = palette[hit.color].fill;
    if (elapsed < 90) {
      ctx.beginPath();
      ctx.arc(bx, by, .31, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffffb0';
      ctx.beginPath();
      ctx.arc(bx - .06, by - .06, .12, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const spread = (elapsed - 90) / 150;
      ctx.globalAlpha = 1 - spread;
      for (const [dx, dy] of [[-.8, -.7], [.7, -.9], [-.55, .7], [.8, .6]]) {
        ctx.fillRect(x + dx * spread - .14, y + dy * spread - .14, .28, .28);
      }
      ctx.globalAlpha = 1;
    }
  }
}
