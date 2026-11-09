import { dentalLifts, dentalSites, dentalSurfaces, type DentalLift, type DentalSite, type DentalSurface, type Mark, type Point, type Step } from './cases';
import { brushCoverageInset } from './coverage';

const assetRoot = '/assets/pop-clinic';
interface DentalPatch {
  image: string;
  size: Point;
  coveragePath?: string;
}

const patches: Record<DentalSite, DentalPatch> = {
  // Coverage follows the damage. The wider image masks feather the surrounding enamel.
  chip: {
    image: 'mouth-repaired', size: [54, 48],
    coveragePath: 'M169 278Q178 270 187 262L201 251Q210 241 218 250Q232 262 244 284L247 287Q205 290 182 284Q173 283 169 278Z',
  },
  cavity: {
    image: 'mouth-repaired', size: [40, 48],
    coveragePath: 'M435 353Q441 354 439 369L437 387Q434 398 426 404Q418 407 411 401Q404 396 409 383Q413 375 419 371Q429 365 435 353Z',
  },
  gunk: { image: 'mouth-repaired', size: [43, 64] },
  decay: { image: 'mouth-scooped', size: [40, 48] },
  tartar: {
    image: 'mouth-details', size: [36, 23],
    coveragePath: 'M100 186Q103 168 117 161Q129 151 142 165Q154 175 160 190L151 190Q142 179 133 175Q125 166 117 175L109 187Z',
  },
  'lower-stain': {
    image: 'mouth-details', size: [24, 33],
    coveragePath: 'M103 370C103 357 109 350 119 350C129 350 132 360 129 371C127 382 120 390 112 388C104 386 100 379 103 370Z',
  },
  'upper-stain': {
    image: 'mouth-details', size: [20, 29],
    coveragePath: 'M506 217Q508 204 519 205Q531 208 532 220Q533 233 523 237Q513 240 507 229Z',
  },
  crack: {
    image: 'mouth-details', size: [47, 39],
    coveragePath: 'M293 225L316 209L329 205L361 178L372 175L370 184L338 216L332 244L323 245L325 221L302 236L295 235Z',
  },
  'rough-enamel': {
    image: 'mouth-rough-edge', size: [42, 23],
    coveragePath: 'M226 336L233 325L240 328L251 320L259 330Q267 336 277 329Q281 334 289 336L288 338Q256 333 227 338Z',
  },
  bracket: { image: 'mouth-details', size: [28, 27] },
  caramel: { image: 'mouth-food', size: [28, 28] },
  seed: { image: 'mouth-food', size: [24, 39] },
};

const surfaceBrushes = {
  chip: 56, cavity: 46, tartar: 34, 'lower-stain': 38, 'upper-stain': 34, crack: 42, 'rough-enamel': 34,
} satisfies Record<DentalSurface, number>;

export const dentalBrushWidth = (site: DentalSurface) => surfaceBrushes[site];

const revealsRepair = (site: DentalSurface) => site === 'chip' || site === 'cavity';

const upperEnamel = `M6 231Q9 205 23 188Q36 179 47 205Q51 176 66 166Q78 159 96 196
  Q101 175 113 162Q127 146 146 168Q158 179 168 207Q175 169 198 155Q230 138 261 162Q285 182 291 220
  Q300 181 322 163Q355 143 378 158Q402 177 407 213Q417 187 430 170Q454 146 473 173Q483 187 486 202
  Q498 174 511 169Q529 159 540 205Q551 181 562 185Q576 190 583 210Q594 213 594 244
  Q594 272 578 268Q557 286 537 266Q521 294 497 272L488 258Q479 281 445 282Q422 284 408 272
  Q399 288 350 289Q303 292 292 278Q283 290 236 286L171 282Q165 275 164 269Q154 282 130 281
  Q108 282 97 266Q83 283 70 282Q62 280 55 263Q45 279 31 275Q26 274 21 267Q6 276 6 231Z`;
const lowerEnamel = `M21 332Q23 312 36 306Q47 303 57 315Q74 301 94 316L107 330Q122 312 139 324
  Q150 328 156 343Q163 327 183 329Q212 328 225 341Q235 332 262 334Q288 333 299 344Q307 335 340 333
  Q366 330 374 342Q383 329 413 327Q431 326 439 338Q451 321 468 320Q481 320 489 333Q501 317 515 313
  Q527 308 536 318Q550 303 563 307Q576 310 580 333Q575 351 548 362Q539 388 521 390Q506 389 498 379
  Q496 405 478 418Q461 429 443 397Q433 417 422 431Q404 446 391 420Q377 400 374 379
  Q367 414 349 432Q333 447 317 433Q303 414 299 378Q294 412 280 431Q259 450 240 428Q231 414 225 382
  Q216 423 192 433Q171 443 158 414Q152 398 151 377Q133 411 114 417Q95 421 94 395L94 376
  Q83 397 67 387Q56 380 50 356Q34 361 21 332Z`;

const frame = (name: string, attrs = '') =>
  `<image href="${assetRoot}/${name}.webp" width="600" height="600" ${attrs}/>`;

function surfaceLayer(site: DentalSurface, active: ReadonlySet<Mark>): string {
  const mask = `mask="url(#dental-brush-${site})"`;
  if (revealsRepair(site)) {
    return `<g data-dental-repair="${site}" ${active.has(site) ? mask : ''}>${patch(site)}</g>`;
  }
  return active.has(site) ? `<g data-mark="${site}" ${mask}>${patch(site)}</g>` : '';
}

function patch(site: DentalSite): string {
  return frame(patches[site].image, `mask="url(#dental-patch-${site})"`);
}

function liftPatch(site: 'gunk' | 'decay', active: ReadonlySet<Mark>): string {
  return `<g data-dental-lift="${site}" opacity="${active.has(site) ? 0 : 1}">${patch(site)}</g>`;
}

const fragmentOutlines: Record<DentalLift, string> = {
  gunk: 'M410 201Q412 194 418 190Q423 192 424 200Q421 209 429 215L435 228Q437 232 430 237Q423 242 422 250L423 261Q418 264 419 272Q413 283 409 276L407 266Q410 256 408 246L410 232Q406 222 409 214Z',
  decay: 'M420 372Q425 370 430 362Q435 359 437 363L436 379Q437 386 431 392L423 391Q416 389 416 382Z',
  bracket: 'M458 354Q459 348 467 346L483 345Q490 345 493 352L495 368Q496 376 489 378L469 381Q462 381 460 375Z',
  caramel: 'M106 214Q109 210 116 211Q121 200 129 204Q134 206 134 215L141 222Q150 229 142 234L132 237Q128 246 119 248Q111 247 108 240Q101 237 101 230Q100 224 106 221Z',
  seed: 'M300 350Q304 347 307 351Q306 363 302 380Q297 399 289 410Q285 414 284 405Q281 387 287 373Q290 362 300 350Z',
};

function liftPiece(site: DentalLift, active: ReadonlySet<Mark>): string {
  if (!active.has(site)) return '';
  const [x, y] = dentalSites[site];
  const hasSeat = site !== 'gunk' && site !== 'decay';
  const piece = frame(hasSeat ? patches[site].image : 'mouth', `clip-path="url(#dental-fragment-${site})"`);
  return `${hasSeat ? `<g data-dental-seat="${site}">${patch(site)}</g>` : ''}
    <g transform="translate(${x} ${y})">
      <g data-mark="${site}" opacity="0"><g transform="translate(${-x} ${-y})">${piece}</g></g>
    </g>`;
}

// The pickup follows the fragment shape with a little room for a fingertip.
const gripOffsets: readonly Point[] = [[0, 0], [-10, 0], [10, 0], [0, -10], [0, 10], [-7, -7], [-7, 7], [7, -7], [7, 7]];

export function dentalGripTouches(scene: SVGSVGElement, site: DentalLift, [x, y]: Point): boolean {
  const shape = scene.querySelector<SVGPathElement>(`#dental-piece-${site}`)!;
  const point = scene.createSVGPoint();
  return gripOffsets.some(([dx, dy]) => {
    point.x = x + dx;
    point.y = y + dy;
    return shape.isPointInFill(point);
  });
}

export function showDentalGuides(scene: SVGSVGElement, equipped: readonly Step[]): void {
  const surfaces = new Set<string>(equipped.flatMap(step => step.action === 'scrub' && step.reveal ? [step.reveal] : []));
  for (const guide of scene.querySelectorAll<SVGGElement>('[data-dental-guide]')) {
    guide.setAttribute('display', surfaces.has(guide.dataset.dentalGuide ?? '') ? 'inline' : 'none');
  }
}

export function dentalArt(active: ReadonlySet<Mark>): string {
  const patchMasks = (Object.keys(patches) as DentalSite[]).map(site => {
    const [x, y] = dentalSites[site];
    const { size: [rx, ry], coveragePath } = patches[site];
    return `<mask id="dental-patch-${site}" maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="600">
      <ellipse ${coveragePath ? '' : `data-dental-surface="${site}"`} cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="url(#dental-patch-fade)"/>
    </mask>${coveragePath ? `<path id="dental-contour-${site}" data-dental-surface="${site}" d="${coveragePath}"/>` : ''}`;
  }).join('');
  const brushStroke = (site: DentalSurface, color: 'black' | 'white', guide = false) => {
    const width = dentalBrushWidth(site) - (guide ? brushCoverageInset * 2 : 0);
    return `<use href="#dental-stroke-${site}" fill="none" stroke="${color}" stroke-width="${width}"
      stroke-linecap="round" ${guide ? '' : 'filter="url(#dental-stroke-feather)"'}/>`;
  };
  const brushMasks = dentalSurfaces.map(site => {
    const reveal = revealsRepair(site);
    const [x, y] = dentalSites[site];
    const { size: [rx, ry], coveragePath } = patches[site];
    const bounds = `x="${x - rx}" y="${y - ry}" width="${2 * rx}" height="${2 * ry}"`;
    return `<path id="dental-stroke-${site}" data-dental-strokes="${site}"/>
      <mask id="dental-brush-${site}" maskUnits="userSpaceOnUse" ${bounds}>
        ${reveal ? '' : `<rect ${bounds} fill="white"/>`}
        ${brushStroke(site, reveal ? 'white' : 'black')}
      </mask>
      ${coveragePath ? `<mask id="dental-remaining-${site}" maskUnits="userSpaceOnUse" ${bounds}>
        <rect ${bounds} fill="white"/>
        ${brushStroke(site, 'black', true)}
      </mask>` : ''}`;
  }).join('');
  const guides = dentalSurfaces.filter(site => patches[site].coveragePath && active.has(site)).map(site =>
    `<g data-dental-guide="${site}" display="none" mask="url(#dental-remaining-${site})">
      <use href="#dental-contour-${site}" class="dental-guide"/>
    </g>`).join('');
  return `<defs>
    <radialGradient id="dental-patch-fade"><stop offset=".65" stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/></radialGradient>
    <filter id="dental-stroke-feather" filterUnits="userSpaceOnUse" x="0" y="0" width="600" height="600"><feGaussianBlur stdDeviation="2.1"/></filter>
    <filter id="dental-brush-feather" filterUnits="userSpaceOnUse" x="0" y="0" width="600" height="600"><feGaussianBlur stdDeviation="4.5"/></filter>
    ${patchMasks}${brushMasks}
    ${dentalLifts.map(site => `<clipPath id="dental-fragment-${site}"><path id="dental-piece-${site}" d="${fragmentOutlines[site]}"/></clipPath>`).join('')}
    <mask id="dental-enamel" maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="600">
      <path id="enamel-surface" d="${upperEnamel} ${lowerEnamel}" fill="white" filter="url(#dental-stroke-feather)"/>
    </mask>
    <filter id="dental-brighten" color-interpolation-filters="sRGB">
      <feComponentTransfer><feFuncR type="table" tableValues="0 .25 .53 .81 1"/>
        <feFuncG type="table" tableValues="0 .27 .58 .86 1"/><feFuncB type="table" tableValues="0 .31 .65 .93 1"/>
      </feComponentTransfer>
    </filter>
  </defs>
  <g id="dental-mouth">
    ${frame('mouth')}${liftPatch('gunk', active)}${liftPatch('decay', active)}
    ${dentalSurfaces.map(site => surfaceLayer(site, active)).join('')}
  </g>
  <g data-brush-finish ${active.has('whitened') ? '' : 'mask="url(#brush-strokes)"'}>
    <g mask="url(#dental-enamel)"><use href="#dental-mouth" filter="url(#dental-brighten)"/></g>
  </g>
  ${dentalLifts.map(site => liftPiece(site, active)).join('')}${guides}`;
}

export function showDentalLift(scene: SVGSVGElement, site: DentalLift, fraction: number): void {
  const lifted = Math.min(1, fraction * 10);
  scene.querySelector(`[data-dental-lift="${site}"]`)?.setAttribute('opacity', String(lifted));
  scene.querySelector(`[data-dental-seat="${site}"]`)?.setAttribute('opacity', String(1 - lifted));
  scene.querySelector(`[data-mark="${site}"]`)!.setAttribute('opacity', String(lifted));
}

export function finishDentalLift(scene: SVGSVGElement, site: DentalLift): void {
  scene.querySelector(`[data-dental-lift="${site}"]`)?.setAttribute('opacity', '1');
  scene.querySelector(`[data-dental-seat="${site}"]`)?.setAttribute('display', 'none');
}
