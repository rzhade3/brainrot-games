import { isDentalLift, isGravelEntry, isPalmFragment, isPalmOintment, isPalmPad, isSplinter, palmSites, type Anatomy, type DentalSite, type DentalSurface, type EyeMark, type Field, type Mark, type PalmFragment, type PalmMark, type PalmOintment, type Point, type Step, type Tool, type WipeMark } from './cases';
import { dentalArt, dentalBrushWidth, finishDentalLift } from './dental';
import { brushCoverageInset, Coverage, sampleLine, sampleSurface } from './coverage';
import type { PullPath } from './pull';

const root = '/assets/pop-clinic';
const svgNs = 'http://www.w3.org/2000/svg';
const tools: Record<Tool, string> = {
  clip: '<rect x="25" y="13" width="22" height="43" rx="9" fill="#cedddd" transform="rotate(33 36 35)"/><path d="m19 44 13 9m-8-21 14 9" stroke="#334e54" stroke-width="3"/><path d="m32 17 13 9 6-10-13-8Z" fill="#fbf8f1" stroke="#334e54" stroke-width="2"/>',
  tweezers: '<path d="M16 49 45 12Q52 7 56 12T55 23L20 54l14-19-19 14Z" fill="#dce9e6" stroke="#334e54" stroke-width="2.5" stroke-linejoin="round"/><path d="m36 23 9 8" stroke="#8caaa9" stroke-width="2"/>',
  file: '<g transform="rotate(-52 35 34)"><rect x="28" y="7" width="14" height="53" rx="7" fill="#afc2be" stroke="#4f6b69" stroke-width="2"/><path d="M31 15v24M35 12v27M39 15v24" stroke="#ecf2ea" stroke-width="1.4" stroke-dasharray="1.4 2.1" stroke-linecap="round"/><path d="M29 43h12v10a6 6 0 0 1-12 0Z" fill="#e68a78" stroke="#9e5b51" stroke-width="1.5"/></g>',
  pop: '<rect x="30" y="8" width="12" height="33" rx="5" fill="#baa8f6" stroke="#473a71" stroke-width="2" transform="rotate(35 36 26)"/><ellipse cx="24" cy="47" rx="7" ry="10" transform="rotate(35 24 47)" fill="none" stroke="#473a71" stroke-width="3"/>',
  wipe: '<path d="m17 50 34-34" stroke="#638783" stroke-width="5" stroke-linecap="round"/><ellipse cx="51" cy="16" rx="6" ry="9" transform="rotate(45 51 16)" fill="#fff8e7" stroke="#638783" stroke-width="2"/><ellipse cx="17" cy="50" rx="6" ry="9" transform="rotate(45 17 50)" fill="#fff8e7" stroke="#638783" stroke-width="2"/>',
  ointment: '<path d="m19 43 21-31 16 11-22 30Z" fill="#c1e1dc" stroke="#426e6c" stroke-width="2.4" stroke-linejoin="round"/><path d="m39 14 15 10m-25 7 12 9" stroke="#f8fff3" stroke-width="3"/><path d="m20 43 11 8-7 3-5-3Z" fill="#e5f2e8" stroke="#426e6c" stroke-width="2"/><path d="M17 56q3-2 4 0-1 4-4 3-2-1 0-3Z" fill="#fff2cb"/>',
  dress: '<rect x="12" y="23" width="47" height="22" rx="10" fill="#ffd59f" stroke="#a35745" stroke-width="2" transform="rotate(-37 36 34)"/><path d="m29 27 11 14m-5-18 11 14" stroke="#db9175" stroke-width="2"/>',
  cool: '<g transform="rotate(-24 34 36)"><rect x="12" y="19" width="44" height="33" rx="10" fill="#c4e9e7" stroke="#4c827c" stroke-width="2"/><path d="M19 27h29M19 45h29" stroke="#f4fffb" stroke-width="2" stroke-linecap="round"/><path d="M34 29v13m-6-9 12 5m0-5-12 5" stroke="#568c89" stroke-width="2" stroke-linecap="round"/></g>',
  paint: '<g transform="rotate(32 34 35)"><rect x="28" y="6" width="12" height="33" rx="5" fill="#c54b6d" stroke="#78334d" stroke-width="2"/><rect x="29" y="35" width="10" height="12" rx="2" fill="#e1d2d4"/><path d="M28 44h12l3 12q-9 5-18 0Z" fill="#cf4768" stroke="#78334d" stroke-width="2"/><path d="M30 49v5m4-5v6m4-6v5" stroke="#f2849f" stroke-width="1.3" stroke-linecap="round"/></g>',
  lens: '<path d="m29 39 20-23" stroke="#376964" stroke-width="9" stroke-linecap="round"/><path d="m34 32 12-14" stroke="#82b9ad" stroke-width="3" stroke-linecap="round"/><ellipse cx="25" cy="43" rx="13" ry="10" transform="rotate(-28 25 43)" fill="#c3f5e9" stroke="#376964" stroke-width="2"/><ellipse cx="25" cy="43" rx="9" ry="6" transform="rotate(-28 25 43)" fill="#72b2a8" stroke="#f0fff9" stroke-width="2"/>',
  bond: '<g transform="rotate(35 34 35)"><rect x="26" y="6" width="16" height="33" rx="5" fill="#81c0ad" stroke="#426c64" stroke-width="2"/><path d="M29 15h10v15H29z" fill="#e9f6e7"/><path d="M34 39v14l-4 6" fill="none" stroke="#526d71" stroke-width="5" stroke-linecap="round"/><path d="M30 60h3" stroke="#fff4db" stroke-width="4" stroke-linecap="round"/></g>',
  floss: '<path d="M16 49v-6q0-7 8-7h17q8 0 8 7v6M33 37V11" fill="none" stroke="#427b6a" stroke-width="7" stroke-linecap="round"/><path d="M16 48h33" stroke="#fff3d5" stroke-width="3" stroke-linecap="round"/><path d="M33 11v20" stroke="#a7ddbf" stroke-width="3" stroke-linecap="round"/>',
  scoop: '<path d="M25 45 52 16" stroke="#415e65" stroke-width="8" stroke-linecap="round"/><path d="m37 32 15-16" stroke="#c1d9d6" stroke-width="4" stroke-linecap="round"/><ellipse cx="23" cy="49" rx="11" ry="7" transform="rotate(-43 23 49)" fill="#d4e6e0" stroke="#496971" stroke-width="2"/><path d="m18 50 7-6" stroke="#f6fff6" stroke-width="2" stroke-linecap="round"/>',
  whiten: '<g transform="rotate(34 34 36)"><rect x="30" y="5" width="9" height="44" rx="4" fill="#89b7ea" stroke="#4a6b97" stroke-width="2"/><rect x="23" y="44" width="23" height="15" rx="6" fill="#d3ecff" stroke="#4a6b97" stroke-width="2"/><path d="M28 49v5m6-5v5m6-5v5" stroke="#fff" stroke-width="2" stroke-linecap="round"/></g>',
  drops: '<g transform="rotate(27 34 34)"><path d="M24 12Q24 7 29 7H42Q47 7 47 12V38Q47 44 41 44H30Q24 44 24 38Z" fill="#bbebed" stroke="#437783" stroke-width="2"/><path d="M29 19h13v13H29z" fill="#eafaff"/><path d="M30 44h11l-3 9h-5z" fill="#eef7eb" stroke="#437783" stroke-width="2"/><path d="M35 56q-6 7 0 9 6-2 0-9z" fill="#8fd7e8" stroke="#437783" stroke-width="1.6"/></g>',
  brush: '<path d="m22 45 23-31" stroke="#437c68" stroke-width="9" stroke-linecap="round"/><path d="m30 34 12-17" stroke="#addec1" stroke-width="3.1" stroke-linecap="round"/><g transform="rotate(34 20 49)"><rect x="14" y="40" width="12" height="20" rx="4" fill="#e9fff3" stroke="#437c68" stroke-width="2"/><path d="M16 45h8m-8 4h8m-8 4h8m-8 4h8" stroke="#8cc0a8" stroke-width="1.5"/></g>',
  scale: '<path d="M27 41 48 17" stroke="#3b6d68" stroke-width="9" stroke-linecap="round"/><path d="m32 34 13-14" stroke="#b2ded0" stroke-width="3" stroke-linecap="round"/><path d="M27 41 19 50q-2 5-9 3" fill="none" stroke="#4d686e" stroke-width="4" stroke-linecap="round"/><path d="M25 43 19 50q-2 3-7 3" fill="none" stroke="#edf4e9" stroke-width="1.5" stroke-linecap="round"/>',
  lashes: '<path d="M20 51Q24 35 48 15Q53 11 56 15L28 49Q26 53 20 51Z" fill="#d2a8d7" stroke="#644a6c" stroke-width="2.4"/><path d="M12 53Q20 49 28 53Q25 57 20 57T12 53Z" fill="#ad84b0" stroke="#644a6c" stroke-width="2"/>',
};

export function toolIcon(tool: Tool): string {
  return `<svg viewBox="0 0 68 68" aria-hidden="true">${tools[tool]}</svg>`;
}

const skinCenters = {
  toe: { raised: [441, 232], flat: [440, 254] },
  ear: { raised: [346, 459], flat: [353, 468] },
} as const;

function skinPatch(anatomy: 'toe' | 'ear', state: 'raised' | 'flat', smaller: boolean): string {
  const piercing = anatomy === 'ear' && state === 'raised' && !smaller;
  const [x, y] = piercing ? [345, 461] : skinCenters[anatomy][state];
  const frame = piercing ? 'ear-piercing' : `${anatomy}-${state}`;
  const whitehead = anatomy === 'toe' && state === 'raised';
  return `<g transform="scale(${smaller ? .72 : 1})">
    <g mask="url(#${anatomy}-skin-patch)">
      <image href="${root}/${frame}.webp" x="${-x}" y="${-y}" width="600" height="600"${whitehead ? ' transform="scale(1.75)"' : ''}/>
    </g>
    ${whitehead ? '<ellipse rx="27" ry="36" fill="url(#inflamed-skin)"/>' : ''}
  </g>`;
}

const swabWidth = 40;

function wipeable(mark: WipeMark, artwork: string): string {
  return `<defs><mask id="wipe-${mark}" maskUnits="userSpaceOnUse" x="-120" y="-70" width="240" height="165">
    <rect x="-120" y="-70" width="240" height="165" fill="white"/><path data-wipe-stroke="${mark}" stroke="black" stroke-width="${swabWidth}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </mask></defs><g mask="url(#wipe-${mark})">${artwork}</g>`;
}

const gelArt = `<g data-runoff>
    <path data-pool fill="url(#runoff-color)" filter="url(#runoff-contact)"/>
    <path data-wet-glint fill="none" stroke="#fff2cd" stroke-width="1.6" stroke-linecap="round" opacity=".55"/>
  </g>`;

const studImage = (mask: string) =>
  `<image href="${root}/ear-stud.webp" x="-344" y="-457" width="600" height="600" ${mask}/>`;

const toeDressing = `<path d="M107 343C126 355 162 367 213 368C303 369 398 324 419 249C431 204 455 195 476 205Q486 233 490 267C474 267 460 276 448 306C409 386 319 427 219 423C168 423 131 412 109 399Q104 370 107 343Z" fill="url(#toe-wrap)" stroke="#c18359" stroke-width="1.6"/>
  <path d="M109 350C139 365 174 374 213 374C306 377 401 331 424 252C436 211 456 203 476 211" fill="none" stroke="#fff4d9" stroke-opacity=".55" stroke-width="2"/>
  <path d="M419 250C430 211 450 198 476 205Q486 233 490 267C472 270 462 279 453 296Q449 301 444 297L415 282Q409 279 411 273Z" fill="url(#toe-pad)" stroke="#d39c72" stroke-width="1.4"/>
  <path d="M122 366Q214 414 316 375M122 381Q214 429 316 391" fill="none" stroke="#a66a46" stroke-opacity=".55" stroke-width="2.6" stroke-linecap="round" stroke-dasharray="0 8"/>`;

type BodyMark = Exclude<Mark, DentalSite | 'whitened'>;
type RegisteredMark = EyeMark | PalmMark | 'palm-grit';

function fieldImage(frame: string, [x, y]: Point, attrs: string, groupAttrs = ''): string {
  return `<g transform="translate(${-x} ${-y})" ${groupAttrs}><image href="${root}/${frame}.webp" width="600" height="600" ${attrs}/></g>`;
}

function palmFragmentImage(mark: PalmFragment, part: 'seat' | 'outline'): string {
  const [x, y] = palmSites[mark];
  const source: Point = isSplinter(mark) ? [x, y + 6] : [x, y];
  const asset = isSplinter(mark) ? 'palm' : mark === 'gravel-center' ? 'palm-pebble' : 'palm-gravel-sides';
  const attr = part === 'seat' ? 'mask' : 'clip-path';
  return fieldImage(asset, source, `${attr}="url(#${mark}-${part})"`);
}

function palmDressing(angle: number): string {
  return `<g transform="rotate(${angle})" filter="url(#palm-pad-shadow)">
    <rect x="-42" y="-18" width="84" height="36" rx="13" fill="url(#toe-wrap)" stroke="#bc8d67" stroke-width="1"/>
    <rect x="-40" y="-16" width="80" height="32" rx="11" fill="url(#palm-fabric)" opacity=".45"/>
    <rect x="-16" y="-14" width="32" height="28" rx="7" fill="url(#toe-pad)" stroke="#d1a685" stroke-width="1"/>
    <rect x="-14" y="-12" width="28" height="24" rx="6" fill="url(#palm-fabric)" opacity=".55"/>
  </g>`;
}

function palmOintmentArt(mark: PalmOintment): string {
  return `<defs><mask id="${mark}-strokes" maskUnits="userSpaceOnUse" x="-48" y="-48" width="96" height="96">
    <path data-ointment-stroke fill="none" stroke="white" stroke-width="32" stroke-linecap="round" stroke-linejoin="round" filter="url(#ointment-feather)"/>
  </mask></defs>
  <g mask="url(#${mark}-strokes)">
    <ellipse rx="27" ry="22" transform="rotate(-12)" fill="url(#ointment-gloss)"/>
    <path d="M-15-6Q-8-12 3-11M7-10l4 1" fill="none" stroke="#fff8df" stroke-width="2.1" stroke-linecap="round" opacity=".73"/>
  </g>`;
}

const shapes: Record<Exclude<BodyMark, 'bump' | 'second-bump' | 'wound' | 'second-wound' | 'patch' | RegisteredMark>, string> = {
  'clip-tip': `<image href="${root}/toe-ingrown.webp" x="-394" y="-158" width="600" height="600" clip-path="url(#toe-tip-fragment)"/>`,
  'clip-corner': `<image href="${root}/toe-notched.webp" x="-385" y="-174" width="600" height="600" clip-path="url(#toe-corner-fragment)"/>`,
  snag: `<image href="${root}/toe-notched.webp" x="-355" y="-204" width="600" height="600" clip-path="url(#toe-sliver-fragment)"/>
    <path d="M-3-4Q3-8 7-2C10 3 11 10 16 15C22 22 30 29 30 36Q27 40 22 36C17 28 9 22 5 14C1 8-1 2-3-4Z" fill="none" stroke="#ad705c" stroke-width="1.5" opacity=".72"/>
    <path d="M3 0C5 9 10 16 16 21" fill="none" stroke="#ffe4c6" stroke-width="2" stroke-linecap="round"/>`,
  second: '<path d="M9-34Q-5-33-12-5Q-15 17-2 38Q13 14 9-34Z" fill="url(#ivory)" stroke="#a96258" stroke-width="2"/>',
  rough: '',
  redness: '',
  cooled: '',
  painted: '',
  gel: wipeable('gel', gelArt),
  'second-gel': wipeable('second-gel', gelArt),
  'ear-redness': '<ellipse rx="46" ry="39" fill="url(#ear-rim-redness)"/>',
  'piercing-crust': `<g filter="url(#ear-crust-shadow)"><image href="${root}/ear-buildup.webp" x="-300" y="-438" width="600" height="600" clip-path="url(#ear-crust-outline)"/></g>`,
  'crease-residue': wipeable('crease-residue', `<image href="${root}/ear-buildup.webp" x="-352" y="-370" width="600" height="600" mask="url(#ear-crease-area)"/>`),
  stud: studImage('clip-path="url(#stud-outline)"'),
  lens: '<ellipse rx="86" ry="64" transform="rotate(-10)" fill="url(#glass)" stroke="#e2fffa" stroke-opacity=".85" stroke-width="3"/><path d="M-67-13q19-31 64-36m30 2 17 7" fill="none" stroke="#f4fffa" stroke-opacity=".88" stroke-width="4" stroke-linecap="round"/><ellipse cx="2" cy="-4" rx="9" ry="4" fill="#f3fffc" opacity=".55" transform="rotate(-15)"/>',
  fog: '<ellipse rx="139" ry="74" fill="url(#mist)"/>',
};

function markArt(field: Field, mark: BodyMark, visible: boolean): string {
  const anatomy = field.anatomy === 'toe' ? 'toe' : 'ear';
  if (mark === 'eye-red-left' || mark === 'eye-red-right') {
    return fieldImage('eye-irritated', field.marks[mark]!, `mask="url(#${mark}-area)"`);
  }
  if (mark === 'eye-speck') {
    return '<path d="M-12 3Q-11-2-7-3L-2-9Q1-7 7-8L12-3 9 0 12 5 5 6 1 10-5 7Z" fill="#583318" stroke="#2f1f16" stroke-width="1.7"/><path d="M-6 0 1-5 6-4" fill="none" stroke="#c8a376" stroke-width="2" stroke-linecap="round"/>';
  }
  if (mark === 'lash-strip') {
    return fieldImage('eye-lashes', field.marks[mark]!, 'mask="url(#lash-area)"',
      `data-brush-finish ${visible ? '' : 'mask="url(#brush-strokes)"'}`);
  }
  if (mark === 'palm-grit') {
    return wipeable(mark, fieldImage('palm', field.marks[mark]!, 'mask="url(#palm-grit-area)"'));
  }
  if (isPalmFragment(mark)) {
    return `<g filter="url(#palm-fragment-shadow)">
      ${isSplinter(mark) ? '<path data-buried-wood fill="url(#buried-wood)" stroke="#634021" stroke-width="1"/>' : ''}
      ${palmFragmentImage(mark, 'outline')}
    </g>`;
  }
  if (isGravelEntry(mark)) return fieldImage('palm-clean', palmSites['palm-pad-right'], 'mask="url(#palm-pebble-entry-area)"');
  if (isPalmOintment(mark)) return palmOintmentArt(mark);
  if (isPalmPad(mark)) {
    return palmDressing(mark === 'palm-pad-left' ? -20 : mark === 'palm-pad-right' ? 19 : -7);
  }
  if (mark === 'patch') {
    const [x, y] = field.marks.patch!;
    if (anatomy === 'ear') {
      return `<image href="${root}/ear-dressed.webp" x="${-x}" y="${-y}" width="600" height="600" mask="url(#ear-dressing-area)"/>`;
    }
    return `<g transform="translate(${-x} ${-y})">${toeDressing}</g>`;
  }
  if (mark === 'bump' || mark === 'second-bump') {
    return `<g data-mound>${skinPatch(anatomy, 'raised', mark === 'second-bump')}</g>`;
  }
  if (mark === 'wound' || mark === 'second-wound') {
    return skinPatch(anatomy, 'flat', mark === 'second-wound');
  }
  return shapes[mark];
}

const definitions = `<defs>
  <radialGradient id="patch-fade"><stop offset=".61" stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/></radialGradient>
  <filter id="eye-patch-feather" filterUnits="userSpaceOnUse" x="0" y="0" width="600" height="600"><feGaussianBlur stdDeviation="3.5"/></filter>
  <mask id="eye-red-left-area" maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="600">
    <path d="M100 344Q128 276 231 239C193 273 185 351 249 415Q146 412 111 369Q101 356 100 344Z" fill="white" filter="url(#eye-patch-feather)"/>
  </mask>
  <mask id="eye-red-right-area" maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="600">
    <path d="M382 240Q450 263 493 325Q506 347 475 385Q422 403 371 415C423 366 428 286 382 240Z" fill="white" filter="url(#eye-patch-feather)"/>
  </mask>
  <mask id="lash-area" maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="600">
    <path d="M6 363Q-10 267 56 197Q125 143 183 139Q323 133 395 178Q479 204 514 282L497 314Q439 262 387 248Q301 218 227 241Q151 259 102 327Q66 367 6 363Z" fill="white" filter="url(#eye-patch-feather)"/>
  </mask>
  <mask id="palm-grit-area" maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="600">
    <ellipse cx="147" cy="240" rx="46" ry="43" fill="url(#patch-fade)"/>
  </mask>
  <mask id="splinter-left-seat" maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="600">
    <ellipse cx="209" cy="282" rx="27" ry="33" fill="url(#patch-fade)"/>
  </mask>
  <mask id="splinter-right-seat" maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="600">
    <ellipse cx="362" cy="365" rx="27" ry="33" fill="url(#patch-fade)"/>
  </mask>
  <clipPath id="splinter-left-outline">
    <path d="M193 269C192 264 198 259 204 260C211 258 215 263 215 269L221 289Q222 294 214 296Q205 299 201 292Z"/>
  </clipPath>
  <clipPath id="splinter-right-outline">
    <path d="M350 364L354 350C358 343 369 343 374 350Q379 356 374 364L366 377Q361 382 351 378Q346 376 348 370Z"/>
  </clipPath>
  <mask id="palm-pebble-entry-area" maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="600">
    <ellipse cx="358" cy="371" rx="24" ry="22" fill="url(#skin-feather)"/>
  </mask>
  <mask id="gravel-center-seat" maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="600">
    <ellipse cx="300" cy="454" rx="47" ry="42" fill="url(#patch-fade)"/>
  </mask>
  <clipPath id="gravel-center-outline"><path d="M272 466Q271 453 278 447L292 436Q299 428 307 430Q315 431 323 440Q326 445 325 452Q324 460 315 464Q297 473 282 471Q274 471 272 466Z"/></clipPath>
  <mask id="gravel-left-seat" maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="600">
    <ellipse cx="119" cy="391" rx="43" ry="39" fill="url(#patch-fade)"/>
  </mask>
  <clipPath id="gravel-left-outline"><path d="M96 398Q97 389 106 377L130 366Q134 364 137 374L140 390Q141 397 134 400Q123 404 105 402Q98 402 96 398Z"/></clipPath>
  <mask id="gravel-right-seat" maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="600">
    <ellipse cx="445" cy="425" rx="43" ry="39" fill="url(#patch-fade)"/>
  </mask>
  <clipPath id="gravel-right-outline"><path d="M423 432Q425 424 433 413Q443 405 453 402Q457 401 461 408L467 419Q468 426 461 432Q453 438 438 437Q425 438 423 432Z"/></clipPath>
  <linearGradient id="buried-wood" x2="1" y2=".25">
    <stop stop-color="#60371b"/><stop offset=".36" stop-color="#ad713a"/><stop offset=".6" stop-color="#d39954"/>
    <stop offset=".74" stop-color="#ae7037"/><stop offset="1" stop-color="#6e4325"/>
  </linearGradient>
  <filter id="palm-fragment-shadow" filterUnits="userSpaceOnUse" x="-46" y="-38" width="92" height="100" color-interpolation-filters="sRGB">
    <feDropShadow dx="3" dy="5" stdDeviation="2.5" flood-color="#7d3719" flood-opacity=".36"/>
  </filter>
  <filter id="palm-pad-shadow" color-interpolation-filters="sRGB"><feDropShadow dx="1" dy="2" stdDeviation="1.6" flood-color="#6b321d" flood-opacity=".44"/></filter>
  <filter id="ointment-feather" filterUnits="userSpaceOnUse" x="-48" y="-48" width="96" height="96"><feGaussianBlur stdDeviation="2.8"/></filter>
  <radialGradient id="ointment-gloss" cx=".39" cy=".31" r=".65">
    <stop stop-color="#fff2cb" stop-opacity=".82"/><stop offset=".55" stop-color="#f4dfa5" stop-opacity=".62"/>
    <stop offset=".84" stop-color="#ffebbd" stop-opacity=".31"/><stop offset="1" stop-color="#ffebbd" stop-opacity="0"/>
  </radialGradient>
  <pattern id="palm-fabric" width="4" height="4" patternUnits="userSpaceOnUse">
    <path d="M0 1h4m-2 1v2" stroke="#fff7e3" stroke-opacity=".8" stroke-width=".7"/>
  </pattern>
  <mask id="toe-edit-area" maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="600">
    <circle cx="389" cy="166" r="115" fill="url(#patch-fade)"/>
  </mask>
  <mask id="toe-cooled-area" maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="600">
    <ellipse cx="390" cy="147" rx="75" ry="58" fill="url(#patch-fade)"/>
    <use href="#nail-outline" fill="black"/>
  </mask>
  <clipPath id="nail-plate">
    <path id="nail-outline" d="M184 246C183 192 201 162 245 150Q301 129 350 151C370 160 379 176 394 184Q415 204 415 255C418 309 404 340 369 344H236C200 343 181 316 184 246Z"/>
  </clipPath>
  <mask id="toe-filed-area" maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="600">
    <ellipse cx="375" cy="173" rx="65" ry="51" fill="url(#patch-fade)"/>
  </mask>
  <filter id="file-stroke-feather" filterUnits="userSpaceOnUse" x="0" y="0" width="600" height="600">
    <feGaussianBlur stdDeviation="4"/>
  </filter>
  <mask id="toe-file-strokes" maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="600">
    <path data-file-strokes filter="url(#file-stroke-feather)" fill="none" stroke="white" stroke-width="51" stroke-linecap="round" stroke-linejoin="round"/>
  </mask>
  <clipPath id="toe-sliver-fragment"><path d="M-3-4Q3-8 7-2C10 3 11 10 16 15C22 22 30 29 30 36Q27 40 22 36C17 28 9 22 5 14C1 8-1 2-3-4Z"/></clipPath>
  <mask id="toe-sliver-pocket" maskUnits="userSpaceOnUse" x="-420" y="-420" width="840" height="840">
    <rect x="-420" y="-420" width="840" height="840" fill="white"/>
    <path d="M-13 23Q7 11 14 6L48 23L48 60L-13 60Z" fill="black"/>
  </mask>
  <clipPath id="toe-tip-fragment"><path d="M-8-3Q2-7 8 1Q10 5 9 11Z"/></clipPath>
  <clipPath id="toe-corner-fragment"><path d="M-36-17Q-13-8 2-19L18-4Q18 10 20 21Q3 7-14-7Z"/></clipPath>
  <radialGradient id="skin-feather"><stop offset=".47" stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/></radialGradient>
  <radialGradient id="inflamed-skin">
    <stop offset=".2" stop-color="#c52827" stop-opacity="0"/>
    <stop offset=".59" stop-color="#d4322c" stop-opacity=".56"/>
    <stop offset="1" stop-color="#db4335" stop-opacity="0"/>
  </radialGradient>
  <mask id="toe-skin-patch" maskUnits="userSpaceOnUse" x="-30" y="-42" width="60" height="84">
    <ellipse rx="28" ry="39" fill="url(#skin-feather)"/>
  </mask>
  <mask id="ear-skin-patch" maskUnits="userSpaceOnUse" x="-48" y="-48" width="96" height="96">
    <circle r="46" fill="url(#skin-feather)"/>
  </mask>
  <filter id="ear-dressing-feather"><feGaussianBlur stdDeviation="5"/></filter>
  <mask id="ear-dressing-area" maskUnits="userSpaceOnUse" x="-155" y="-80" width="260" height="165">
    <path d="M-137-6Q-104-35 80-62L85 33Q-16 65-98 66Z" fill="white" filter="url(#ear-dressing-feather)"/>
  </mask>
  <radialGradient id="ear-rim-redness">
    <stop offset=".12" stop-color="#c33029" stop-opacity="0"/>
    <stop offset=".44" stop-color="#c33029" stop-opacity=".57"/>
    <stop offset="1" stop-color="#d93a31" stop-opacity="0"/>
  </radialGradient>
  <clipPath id="ear-crust-outline">
    <path d="M-37 7Q-38 2-35-4Q-36-8-32-8L-27-10L-22-12Q-24-17-23-21Q-22-25-18-25L-9-22
      Q-7-23-5-26Q0-29 3-24L5-21L10-20L16-13L20-12L26-6L30-2L37 2L36 5L31 8L28 13L26 14
      L20 16L15 20L10 21L7 24L-1 24L-5 27L-13 26L-20 25L-22 26L-24 23L-24 18L-22 14L-25 11L-29 10L-32 11L-36 10Z"/>
  </clipPath>
  <filter id="ear-crust-shadow" filterUnits="userSpaceOnUse" x="-46" y="-37" width="92" height="76" color-interpolation-filters="sRGB">
    <feDropShadow dx="1" dy="3" stdDeviation="2.5" flood-color="#713511" flood-opacity=".6"/>
  </filter>
  <mask id="ear-crease-area" maskUnits="userSpaceOnUse" x="-56" y="-39" width="112" height="78">
    <ellipse rx="53" ry="20" transform="rotate(25)" fill="url(#patch-fade)"/>
  </mask>
  <clipPath id="stud-outline"><ellipse id="stud-edge" rx="16.4" ry="15.1"/></clipPath>
  <mask id="stud-contact" maskUnits="userSpaceOnUse" x="-43" y="-43" width="86" height="86">
    <circle cy="2" r="40" fill="url(#skin-feather)"/><use href="#stud-edge" fill="black"/>
  </mask>
  <linearGradient id="ivory" x2=".8" y2="1" gradientUnits="objectBoundingBox"><stop stop-color="#fff6d8"/><stop offset="1" stop-color="#ca8169"/></linearGradient>
  <linearGradient id="runoff-color" x2="1" y2=".18">
    <stop stop-color="#c88e54" stop-opacity=".82"/><stop offset=".28" stop-color="#eed19d" stop-opacity=".94"/>
    <stop offset=".55" stop-color="#edcb95"/><stop offset=".83" stop-color="#dbb079" stop-opacity=".95"/><stop offset="1" stop-color="#c89458" stop-opacity=".82"/>
  </linearGradient>
  <filter id="runoff-contact" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB">
    <feDropShadow dx=".7" dy="1" stdDeviation="1.1" flood-color="#793713" flood-opacity=".52"/>
  </filter>
  <linearGradient id="chrome" x2=".3" y2="1" gradientUnits="objectBoundingBox"><stop stop-color="#fff"/><stop offset=".47" stop-color="#e1dafa"/><stop offset=".68" stop-color="#6f608b"/><stop offset="1" stop-color="#c4b1e9"/></linearGradient>
  <linearGradient id="glass" x2=".3" y2="1" gradientUnits="objectBoundingBox"><stop stop-color="#eafffd" stop-opacity=".65"/><stop offset=".5" stop-color="#a5eee2" stop-opacity=".06"/><stop offset="1" stop-color="#63bdb6" stop-opacity=".45"/></linearGradient>
  <radialGradient id="mist"><stop stop-color="#f5fffb" stop-opacity=".92"/><stop offset="1" stop-color="#d4f9f2" stop-opacity="0"/></radialGradient>
  <linearGradient id="toe-wrap" x2="1" y2="0"><stop stop-color="#cf966b"/><stop offset=".34" stop-color="#ffe4b6"/><stop offset=".62" stop-color="#f9d5a3"/><stop offset="1" stop-color="#cf956e"/></linearGradient>
  <linearGradient id="toe-pad" x2="1" y2="0"><stop stop-color="#ffe5be"/><stop offset=".56" stop-color="#f9d7ad"/><stop offset="1" stop-color="#dfa77e"/></linearGradient>
</defs>`;

const brushWidths = { toe: 88, mouth: 142, eye: 162 } as const;

function brushMask(anatomy: Field['anatomy']): string {
  if (anatomy !== 'toe' && anatomy !== 'mouth' && anatomy !== 'eye') return '';
  const width = brushWidths[anatomy];
  return `<mask id="brush-strokes" maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="600">
    <path data-paint-strokes fill="none" stroke="white" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"
      ${anatomy === 'mouth' ? 'filter="url(#dental-brush-feather)"' : anatomy === 'eye' ? 'filter="url(#eye-patch-feather)"' : ''}/>
  </mask>`;
}

const toeEdits = [
  { frame: 'toe-notched', after: 'clip-tip' },
  { frame: 'toe-clipped', after: 'clip-corner' },
] as const;

function updateToeArt(scene: SVGSVGElement, active: ReadonlySet<Mark>): void {
  for (const { frame, after } of toeEdits) {
    scene.querySelector(`[data-toe-edit="${frame}"]`)!.setAttribute('opacity', active.has(after) ? '0' : '1');
  }
  const filed = scene.querySelector('#filed-edge')!;
  const rough = scene.querySelector('#rough-edge')!;
  rough.setAttribute('display', active.has('rough') && !active.has('clip-corner') ? 'inline' : 'none');
  if (active.has('rough')) filed.setAttribute('mask', 'url(#toe-file-strokes)');
  else filed.removeAttribute('mask');
  // These layers are already in the scene, behind the intact nail corner.
  for (const mark of ['snag', 'second'] as const) {
    const exposed = active.has(mark) && !active.has('clip-corner');
    scene.querySelector(`[data-mark="${mark}"]`)?.setAttribute('display', exposed ? 'inline' : 'none');
  }
}

const wideFrameTop: Record<Anatomy, number> = { toe: 40, ear: 95, mouth: 75, eye: 90, palm: 105 };

export function frameField(scene: SVGSVGElement, anatomy: Anatomy): void {
  const { width, height } = scene.getBoundingClientRect();
  if (!width || !height) return;
  const viewHeight = Math.min(600, Math.max(450, 600 * height / width));
  // Reveal more of the same artwork as the window grows taller.
  const top = wideFrameTop[anatomy] * (600 - viewHeight) / 150;
  scene.setAttribute('viewBox', `0 ${top} 600 ${viewHeight}`);
}

export function renderField(scene: SVGSVGElement, field: Field, active: ReadonlySet<Mark>): void {
  frameField(scene, field.anatomy);
  const toe = field.anatomy === 'toe';
  const base = toe ? 'toe-ingrown' : field.anatomy === 'palm' ? 'palm-clean' : field.anatomy;
  const edits = toe ? toeEdits.map(({ frame, after }) =>
    `<image class="toe-edit" data-toe-edit="${frame}" href="${root}/${frame}.webp" width="600" height="600" mask="url(#toe-edit-area)" opacity="${active.has(after) ? 0 : 1}"/>`
  ).join('') : '';
  const filing = toe
    ? `<image id="rough-edge" href="${root}/toe-rough-edge.webp" width="600" height="600" mask="url(#toe-filed-area)" display="none"/>
    <g id="filed-edge"><image href="${root}/toe-filed.webp" width="600" height="600" mask="url(#toe-filed-area)"/></g>`
    : '';
  const finish = toe ? `<image id="cooled-skin" class="toe-edit" href="${root}/toe-cooled.webp" width="600" height="600"
      mask="url(#toe-cooled-area)" opacity="${active.has('cooled') ? 1 : 0}"/>
    <g id="nail-polish" data-brush-finish ${active.has('painted') ? '' : 'mask="url(#brush-strokes)"'}>
      <image href="${root}/toe-painted.webp" width="600" height="600" clip-path="url(#nail-plate)"/>
    </g>` : '';
  const artwork = field.anatomy === 'mouth' ? dentalArt(active) : `<image href="${root}/${base}.webp" width="600" height="600" aria-hidden="true"/>${edits}${filing}${finish}${
    Object.entries(field.marks).map(([key, [x, y]]) => {
      const visible = active.has(key as Mark) && key !== 'clip-tip' && key !== 'clip-corner';
      const pocket = key === 'snag' ? ' mask="url(#toe-sliver-pocket)"' : '';
      const contact = key === 'stud' ? studImage(`data-stud-contact mask="url(#stud-contact)" opacity="${visible ? 1 : 0}"`) : '';
      const mark = key as BodyMark;
      const seat = isPalmFragment(mark)
        ? `<g data-palm-seat="${mark}" opacity="${visible ? 1 : 0}">${palmFragmentImage(mark, 'seat')}</g>`
        : '';
      const fragmentOpacity = seat ? 'opacity="0"' : '';
      const display = visible || key === 'lash-strip' ? '' : 'display="none"';
      return `<g transform="translate(${x} ${y})"${pocket}>${contact}${seat}<g data-mark="${key}" ${display} ${fragmentOpacity}>${markArt(field, mark, visible)}</g></g>`;
    }).join('')
  }`;
  scene.innerHTML = `${definitions}${artwork}${brushMask(field.anatomy)}<g id="cue"></g><g id="file-dust" display="none" fill="#fff0d3" opacity=".8">
    <circle cx="-9" cy="-10" r="2"/><circle cx="-3" cy="-14" r="1.4"/><circle cx="4" cy="-9" r="1.6"/>
  </g><g id="held-tool"></g><g id="effects"></g>`;
  if (toe) updateToeArt(scene, active);
}

export function targetOf(step: Step, hits: number): Point {
  return step.action === 'tap' ? step.targets[hits] : step.at;
}

export function drawCue(scene: SVGSVGElement, step: Step, hits: number): void {
  const [x, y] = targetOf(step, hits);
  const cue = scene.querySelector('#cue')!;
  cue.classList.remove('hint');
  cue.innerHTML = `    <g class="target-ring" transform="translate(${x} ${y})"><circle class="halo-shadow" r="31"/><circle class="halo" r="31"/>${step.tool === 'dress' || (step.action === 'pull' && step.mark === 'snag') ? '' : '<circle class="pin" r="4"/>'}</g>`;
}

export function moveTool(scene: SVGSVGElement, tool: Tool, [x, y]: Point, alignment?: PullPath | number): void {
  const held = scene.querySelector('#held-tool')!;
  if (held.getAttribute('data-tool') !== tool) {
    held.setAttribute('data-tool', tool);
    const offsets = { pop: '-30 -58', tweezers: '-20 -63', file: '-43.75 -42.5', cool: '-42.5 -45',
      paint: '-28 -65', lens: '-31.25 -53.75', bond: '-22 -67', floss: '-41 -60', scoop: '-29 -61', whiten: '-32 -60', lashes: '-25 -67.5',
      ointment: '-22 -70', scale: '-13 -66', brush: '-24 -63', wipe: '-21 -63' };
    const offset = offsets[tool as keyof typeof offsets] ?? '4 -83';
    const seal = tool === 'lens'
      ? '<ellipse class="lens-seal" rx="22" ry="15" fill="none" stroke="#e8fff6" stroke-width="4"/>'
      : '';
    held.innerHTML = `${seal}<g class="tool-in-field" transform="translate(${offset}) scale(1.25)">${tools[tool]}</g>`;
  }
  // The tweezer handle in the artwork points about 45 degrees up and right from the tip.
  const rotation = typeof alignment === 'number' ? alignment : tool === 'tweezers' && alignment
    ? Math.atan2(alignment.to[1] - alignment.at[1], alignment.to[0] - alignment.at[0]) * 180 / Math.PI + 45
    : 0;
  held.setAttribute('transform', `translate(${x} ${y}) rotate(${rotation})`);
  held.removeAttribute('display');
}

function finishLensLift(scene: SVGSVGElement, pull: PullPath): void {
  const lens = scene.querySelector('[data-mark="lens"]')!.parentElement!.cloneNode(true) as SVGGElement;
  lens.firstElementChild!.removeAttribute('data-mark');
  const tool = scene.querySelector('#held-tool')!.cloneNode(true) as SVGGElement;
  tool.removeAttribute('id');
  tool.querySelector('.lens-seal')?.remove();

  const dx = pull.to[0] - pull.at[0];
  const dy = pull.to[1] - pull.at[1];
  const length = Math.hypot(dx, dy);
  const lifted = document.createElementNS(svgNs, 'g');
  lifted.classList.add('lens-exit');
  lifted.style.setProperty('--lift-x', `${dx / length * 42}px`);
  lifted.style.setProperty('--lift-y', `${dy / length * 42}px`);
  lifted.append(lens, tool);
  scene.querySelector('#effects')!.append(lifted);
  setTimeout(() => lifted.remove(), 330);
}

function dropFragment(scene: SVGSVGElement, mark: Mark, pull?: PullPath): void {
  const original = scene.querySelector(`[data-mark="${mark}"]`)!;
  const fragment = original.parentElement!.cloneNode(false) as SVGGElement;
  const piece = original.cloneNode(true) as SVGGElement;
  piece.removeAttribute('data-mark');
  piece.removeAttribute('display');
  const flight = document.createElementNS(svgNs, 'g');
  flight.classList.add('nail-clipping');
  flight.append(piece);
  if (pull) {
    const palm = isPalmFragment(mark);
    const dx = pull.to[0] - pull.at[0];
    const dy = pull.to[1] - pull.at[1];
    const length = Math.hypot(dx, dy);
    const distance = palm ? 54 : 65;
    flight.classList.add(palm ? 'palm-release' : 'extracted-nail');
    flight.style.setProperty('--exit-x', `${dx / length * distance}px`);
    flight.style.setProperty('--exit-y', `${dy / length * distance}px`);
    flight.style.setProperty('--exit-spin', `${-Math.sign(dx) * (palm ? 17 : 39)}deg`);
    if (palm) {
      const [x, y] = palmSites[mark];
      const tweezers = scene.querySelector('#held-tool')!.cloneNode(true) as SVGGElement;
      tweezers.removeAttribute('id');
      const grip = document.createElementNS(svgNs, 'g');
      grip.setAttribute('transform', `translate(${-x} ${-y})`);
      grip.append(tweezers);
      flight.append(grip);
      showPalmRelease(scene, palmEntry(mark));
    }
  }
  fragment.append(flight);
  scene.querySelector('#effects')!.append(fragment);
  setTimeout(() => fragment.remove(), 520);
}

function palmEntry(mark: PalmFragment): Point {
  if (mark === 'splinter-left') return palmSites['palm-pad-left'];
  if (mark === 'splinter-right') return palmSites['palm-pad-right'];
  return palmSites[`${mark}-entry`];
}

function showPalmRelease(scene: SVGSVGElement, [x, y]: Point): void {
  const effect = document.createElementNS(svgNs, 'g');
  effect.setAttribute('transform', `translate(${x} ${y})`);
  effect.innerHTML = '<g class="palm-release-flash" fill="none" stroke="#fff1ce" stroke-width="2.4" stroke-linecap="round"><circle r="10"/><path d="m-13-10-4-4m34 5 4-3m-28 27-2 4"/></g>';
  scene.querySelector('#effects')!.append(effect);
  setTimeout(() => effect.remove(), 240);
}

function showSnip(scene: SVGSVGElement, cut: Mark, [x, y]: Point): void {
  dropFragment(scene, cut);
  const clipper = document.createElementNS(svgNs, 'g');
  clipper.setAttribute('transform', `translate(${x} ${y}) rotate(30)`);
  clipper.innerHTML = `<g class="clipper-snap" filter="drop-shadow(3px 5px 4px #37242363)">
    <path d="M-17 8Q-17 1-11 0H12Q17 1 17 8V88Q17 100 4 100H-5Q-17 100-17 88Z" fill="url(#chrome)" stroke="#415258" stroke-width="2"/>
    <path d="M-17 4Q0-5 17 4L15 12Q0 7-15 12Z" fill="#f7f6ef" stroke="#415258" stroke-width="2"/>
    <rect x="-10" y="20" width="20" height="63" rx="9" fill="#9bb8b3" stroke="#5a7277" stroke-width="2"/>
    <path d="M-5 50V72M0 50V72M5 50V72" stroke="#d1e3dd" stroke-width="2" stroke-linecap="round"/>
  </g>`;
  scene.querySelector('#effects')!.append(clipper);
  setTimeout(() => clipper.remove(), 300);
}

export function showDrain(scene: SVGSVGElement, step: Extract<Step, { action: 'hold' }>, fraction: number, pressure: number): void {
  const bump = scene.querySelector(`[data-mark="${step.bump}"]`)!;
  const pool = scene.querySelector(`[data-mark="${step.gel}"]`)!;
  const skin = bump.querySelector('[data-mound]')!;
  const collapse = 1 - (1 - fraction) ** 4;
  const squeeze = pressure * (1 - collapse);
  skin.setAttribute('transform', `scale(${1 + .1 * squeeze - .26 * collapse} ${1 - .2 * squeeze - .7 * collapse})`);
  skin.setAttribute('opacity', String(1 - collapse));
  pool.setAttribute('display', fraction > 0 ? 'inline' : 'none');
  if (fraction <= 0) return;

  // The same bead stretches from the pore and settles on the skin until it is wiped.
  const [x, y] = step.runoff;
  const length = 3 + Math.hypot(x, y) * Math.sqrt(fraction);
  const spread = 2 + 14 * Math.sqrt(fraction);
  const bend = 9 * fraction;
  const angle = Math.atan2(-x, y) * 180 / Math.PI;
  pool.querySelector('[data-runoff]')!.setAttribute('transform', `rotate(${angle})`);
  pool.querySelector('[data-pool]')!.setAttribute('d', `M0 -2
    C4 -2 3 ${length * .29} ${4 + bend * .36} ${length * .57}
    C${bend + spread} ${length * .79} ${bend + spread} ${length} ${bend} ${length}
    C${bend - spread} ${length} ${bend - spread * .8} ${length * .83} ${bend * .36 - 4} ${length * .61}
    C-3 ${length * .36} -5 0 0 -2Z`);
  pool.querySelector('[data-wet-glint]')!.setAttribute('d',
    `M-1 2 Q-2 ${length * .35} ${bend * .36 - 2} ${length * .59} M${bend - 4} ${length * .76} q-2 ${length * .1} 0 ${length * .15}`);
}

export function showDrainPop(scene: SVGSVGElement, { at: [x, y], runoff: [dx, dy] }: Extract<Step, { action: 'hold' }>): void {
  const effect = document.createElementNS(svgNs, 'g');
  const angle = Math.atan2(-dx, dy) * 180 / Math.PI;
  effect.setAttribute('transform', `translate(${x} ${y}) rotate(${angle})`);
  effect.innerHTML = `<g class="drain-pop" fill="#ffe0a1" stroke="#bd8553" stroke-width="1">
    <ellipse cx="-5" cy="4" rx="5.5" ry="3.5" transform="rotate(-31 -5 4)"/>
    <ellipse cx="2" cy="8" rx="3" ry="4.2" transform="rotate(28 2 8)"/>
    <circle cx="-11" cy="-1" r="2.8"/>
  </g>`;
  scene.querySelector('#effects')!.append(effect);
  setTimeout(() => effect.remove(), 300);
}

export function makeRunoffCoverage(scene: SVGSVGElement, mark: 'gel' | 'second-gel'): Coverage {
  const pool = scene.querySelector<SVGPathElement>(`[data-mark="${mark}"] [data-pool]`)!;
  const intoPool = pool.getCTM()!.inverse().multiply(scene.getCTM()!);
  const point = scene.createSVGPoint();
  return new Coverage(sampleSurface(([x, y]) => {
    point.x = x;
    point.y = y;
    return pool.isPointInFill(point.matrixTransform(intoPool));
  }), swabWidth / 2 - brushCoverageInset);
}

export function makeCoverage(scene: SVGSVGElement, current: Extract<Step, { action: 'paint' | 'scrub' }>): Coverage {
  if (current.tool === 'lashes' && current.action === 'paint') return new Coverage(sampleLine(current.line), 23);

  const tooth = current.action === 'scrub' ? current.reveal : undefined;
  const surface = scene.querySelector<SVGGeometryElement>(tooth ? `[data-dental-surface="${tooth}"]`
    : current.tool === 'whiten' ? '#enamel-surface' : '#nail-outline')!;
  const width = tooth ? dentalBrushWidth(tooth) : current.tool === 'whiten' ? brushWidths.mouth : brushWidths.toe;
  const point = scene.createSVGPoint();
  const samples = sampleSurface(([x, y]) => {
    point.x = x;
    point.y = y;
    return surface.isPointInFill(point);
  });
  // The rendered brush extends past each credited cell, covering gaps between samples.
  return new Coverage(samples, width / 2 - brushCoverageInset);
}

export function showPaint(scene: SVGSVGElement, from: Point, to: Point, tooth?: DentalSurface): void {
  const stroke = scene.querySelector(tooth ? `[data-dental-strokes="${tooth}"]` : '[data-paint-strokes]')!;
  const [x1, y1] = from.map(Math.round);
  const [x2, y2] = to.map(Math.round);
  const segment = `M${x1} ${y1}L${x2} ${y2}`;
  stroke.setAttribute('d', (stroke.getAttribute('d') ?? '') + segment);
}

export function showOintment(scene: SVGSVGElement, mark: PalmOintment, [x, y]: Point, from: Point, to: Point): void {
  const coat = scene.querySelector(`[data-mark="${mark}"]`)!;
  coat.removeAttribute('display');
  const stroke = coat.querySelector('[data-ointment-stroke]')!;
  const segment = `M${from[0] - x} ${from[1] - y}L${to[0] - x} ${to[1] - y}`;
  stroke.setAttribute('d', (stroke.getAttribute('d') ?? '') + segment);
}

export function showPalmLift(scene: SVGSVGElement, mark: PalmFragment, [x, y]: Point, pull: PullPath): void {
  const fragment = scene.querySelector(`[data-mark="${mark}"]`)!;
  const travel = Math.hypot(x, y);
  const detached = Math.min(1, travel / 6);
  scene.querySelector(`[data-palm-seat="${mark}"]`)!.setAttribute('opacity', String(1 - detached));
  fragment.setAttribute('opacity', String(detached));
  if (!isSplinter(mark)) return;
  const buried = fragment.querySelector('[data-buried-wood]')!;
  if (!travel) {
    buried.removeAttribute('d');
    return;
  }
  const [entryX, entryY] = palmEntry(mark);
  const [gripX, gripY] = palmSites[mark];
  const baseX = entryX - gripX;
  const baseY = entryY - gripY;
  const dx = pull.to[0] - pull.at[0];
  const dy = pull.to[1] - pull.at[1];
  const length = Math.hypot(dx, dy);
  const ux = dx / length;
  const uy = dy / length;
  const depth = Math.min(travel, 19);
  const tipX = baseX - ux * depth;
  const tipY = baseY - uy * depth;
  // The point stays in the entry until the buried part has slid out.
  const width = 3.4;
  buried.setAttribute('d', `M${baseX + uy * width + ux * 3} ${baseY - ux * width + uy * 3}
    Q${baseX + uy * width} ${baseY - ux * width} ${tipX} ${tipY}
    Q${baseX - uy * width} ${baseY + ux * width} ${baseX - uy * width + ux * 3} ${baseY + ux * width + uy * 3}Z`);
}

export function showFiling(scene: SVGSVGElement, from: Point, to: Point): void {
  const stroke = scene.querySelector('[data-file-strokes]')!;
  const segment = `M${from.join(' ')}L${to.join(' ')}`;
  stroke.setAttribute('d', (stroke.getAttribute('d') ?? '') + segment);
  showFileDust(scene, to);
}

export function showFileDust(scene: SVGSVGElement, at: Point): void {
  const dust = scene.querySelector('#file-dust')!;
  dust.setAttribute('transform', `translate(${at.join(' ')})`);
  dust.removeAttribute('display');
}

function clearWipe(scene: SVGSVGElement, mark: WipeMark): void {
  scene.querySelector(`[data-wipe-stroke="${mark}"]`)!.removeAttribute('d');
}

export function showWipe(scene: SVGSVGElement, mark: WipeMark, [x, y]: Point, from: Point, to: Point): void {
  const stroke = scene.querySelector(`[data-wipe-stroke="${mark}"]`)!;
  const segment = `M${from[0] - x} ${from[1] - y}L${to[0] - x} ${to[1] - y}`;
  stroke.setAttribute('d', (stroke.getAttribute('d') ?? '') + segment);
}

function showEffect(scene: SVGSVGElement, [x, y]: Point, action: Step['action'], tool?: Tool): void {
  const effect = document.createElementNS(svgNs, 'g');
  effect.setAttribute('transform', `translate(${x} ${y})`);
  effect.innerHTML = `<g class="burst ${action}"><circle r="27"/><path d="M-54-28l-16-9M0-51v-18M49-30l16-10M52 17l19 7M-49 21l-18 8"/></g>`;
  if (tool) effect.insertAdjacentHTML('beforeend', `<g transform="translate(3 -76) scale(1.3)"><g class="tool-hit">${tools[tool]}</g></g>`);
  scene.querySelector('#effects')?.append(effect);
  setTimeout(() => effect.remove(), 500);
}

function showEyeDrop(scene: SVGSVGElement, [x, y]: Point): void {
  const effect = document.createElementNS(svgNs, 'g');
  effect.setAttribute('transform', `translate(${x} ${y})`);
  effect.innerHTML = `<g class="eye-drop-fall"><path d="M0-18C-4-10-12-4-12 3a12 12 0 0 0 24 0C12-4 4-10 0-18Z"
    fill="#a4e3ef" fill-opacity=".8" stroke="#e7fbff" stroke-width="2"/><path d="M-6 1q0-4 4-8" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></g>
    <ellipse class="eye-drop-ripple" rx="26" ry="15" fill="none" stroke="#e4fbff" stroke-width="3"/>`;
  scene.querySelector('#effects')!.append(effect);
  setTimeout(() => effect.remove(), 450);
}

export function portrait(index: number): string {
  return `${root}/patient-${index + 1}.webp`;
}

export function setMark(scene: SVGSVGElement, mark: Mark, attribute: string, value: string): void {
  scene.querySelector(`[data-mark="${mark}"]`)?.setAttribute(attribute, value);
}

export function setStudContact(scene: SVGSVGElement, opacity: number): void {
  scene.querySelector('[data-stud-contact]')!.setAttribute('opacity', String(opacity));
}

export function showTreatmentImpact(scene: SVGSVGElement, current: Step, at: Point, marks: ReadonlySet<Mark>, cut?: Mark, pull?: PullPath): void {
  if (cut) {
    showSnip(scene, cut, at);
    setMark(scene, cut, 'display', 'none');
    updateToeArt(scene, marks);
  } else if (current.action === 'pull') {
    if (current.mark === 'lens') finishLensLift(scene, pull ?? current);
    else if (current.mark === 'snag' || current.mark === 'second' || current.mark === 'piercing-crust' || isPalmFragment(current.mark) || isDentalLift(current.mark)) {
      dropFragment(scene, current.mark, pull ?? current);
    }
  } else if (current.tool === 'drops') {
    showEyeDrop(scene, at);
  } else if (current.action === 'tap' || (current.action === 'scrub' && current.tool === 'wipe')) {
    showEffect(scene, at, current.action, current.action === 'tap' ? current.tool : undefined);
  }
}

export function finishTreatmentArt(scene: SVGSVGElement, field: Field, marks: ReadonlySet<Mark>, current: Step): void {
  current.remove?.forEach(mark => {
    if (current.tool === 'drops') setMark(scene, mark, 'class', 'rinsed-mark');
    else setMark(scene, mark, 'display', 'none');
  });
  if (current.action === 'pull') {
    if (current.mark === 'stud') setStudContact(scene, 0);
    if (isPalmFragment(current.mark)) scene.querySelector(`[data-palm-seat="${current.mark}"]`)!.setAttribute('opacity', '0');
    if (isDentalLift(current.mark)) finishDentalLift(scene, current.mark);
  }
  if (current.action === 'scrub') {
    if (current.reveal) scene.querySelector(`[data-dental-repair="${current.reveal}"]`)?.removeAttribute('mask');
    if (current.wipe) clearWipe(scene, current.wipe);
  }
  if (current.tool === 'file' && field.anatomy === 'toe') updateToeArt(scene, marks);
  if (current.tool === 'cool') scene.querySelector('#cooled-skin')?.setAttribute('opacity', '1');
  if (current.action === 'paint') scene.querySelector('[data-brush-finish]')!.removeAttribute('mask');
  current.add?.forEach(mark => {
    setMark(scene, mark, 'opacity', '1');
    setMark(scene, mark, 'display', 'inline');
    if (mark === 'patch') setMark(scene, mark, 'class', field.anatomy === 'ear' ? 'dressing-settle' : 'appearing');
    if (isPalmPad(mark)) setMark(scene, mark, 'class', 'dressing-settle');
  });
}
