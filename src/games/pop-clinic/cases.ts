export type Anatomy = 'toe' | 'ear' | 'eye' | 'mouth' | 'palm';
export type Point = readonly [number, number];
export type Tool = 'clip' | 'tweezers' | 'file' | 'pop' | 'wipe' | 'ointment' | 'dress' | 'lens' | 'cool' | 'paint' | 'bond' | 'floss' | 'scoop' | 'whiten' | 'drops' | 'lashes' | 'scale' | 'brush';
type Bump = 'bump' | 'second-bump';
type Gel = 'gel' | 'second-gel';
export type WipeMark = Gel | 'crease-residue' | 'palm-grit';
export const dentalSurfaces = ['chip', 'cavity', 'tartar', 'lower-stain', 'upper-stain', 'crack', 'rough-enamel'] as const;
export type DentalSurface = typeof dentalSurfaces[number];
export const dentalLifts = ['gunk', 'decay', 'bracket', 'caramel', 'seed'] as const;
export type DentalLift = typeof dentalLifts[number];
export type DentalSite = DentalSurface | DentalLift;
export type Mark = 'clip-tip' | 'clip-corner' | 'snag' | 'second' | 'rough' | Bump | WipeMark | 'stud' | 'lens' | 'fog' | 'wound' | 'second-wound' | 'patch' | 'redness' | 'cooled' | 'painted' | DentalSite | 'whitened' | 'piercing-crust' | 'ear-redness' | EyeMark | PalmMark;
export type EyeMark = 'eye-speck' | 'eye-red-left' | 'eye-red-right' | 'lash-strip';
export type SplinterMark = 'splinter-left' | 'splinter-right';
const gravelFragments = ['gravel-left', 'gravel-center', 'gravel-right'] as const;
type GravelFragment = typeof gravelFragments[number];
export type GravelEntry = `${GravelFragment}-entry`;
export type PalmFragment = SplinterMark | GravelFragment;
type PalmSpot = 'left' | 'right' | GravelFragment;
type PalmPad = `palm-pad-${PalmSpot}`;
export type PalmOintment = `palm-ointment-${PalmSpot}`;
export type PalmMark = PalmFragment | PalmPad | PalmOintment | GravelEntry;

export function isDentalLift(mark?: Mark): mark is DentalLift {
  return dentalLifts.some(site => site === mark);
}

export function isSplinter(mark?: Mark): mark is SplinterMark {
  return mark === 'splinter-left' || mark === 'splinter-right';
}

export function isPalmFragment(mark?: Mark): mark is PalmFragment {
  return isSplinter(mark) || gravelFragments.some(fragment => fragment === mark);
}

export function isGravelEntry(mark: Mark): mark is GravelEntry {
  return gravelFragments.some(fragment => `${fragment}-entry` === mark);
}

export function isPalmPad(mark: Mark): mark is PalmPad {
  return mark.startsWith('palm-pad-');
}

export function isPalmOintment(mark: Mark): mark is PalmOintment {
  return mark.startsWith('palm-ointment-');
}

export interface Field {
  anatomy: Anatomy;
  marks: Partial<Record<Mark, Point>>;
}

interface StepInfo {
  tool: Tool;
  title: string;
  hint: string;
  success: string;
  remove?: Mark[];
  add?: Mark[];
  requiresClear?: readonly Mark[];
}

export type Step = StepInfo & (
  | { action: 'tap'; targets: Point[]; cuts?: Mark[] }
  | { action: 'pull'; at: Point; to: Point; mark?: Mark }
  | ({ action: 'scrub'; at: Point } &
      ({ reveal: DentalSurface; radius?: never; distance?: never; edge?: never; wipe?: never; spread?: never }
        | { reveal?: never; radius: number; distance: number; edge?: readonly [Point, Point]; wipe?: WipeMark; spread?: PalmOintment }))
  | ({ action: 'paint'; at: Point; radius: number } &
      ({ tool: 'lashes'; line: readonly Point[] } | { tool: 'paint' | 'whiten'; line?: never }))
  | { action: 'hold'; at: Point; bump: Bump; gel: Gel; runoff: Point }
);

export interface Area {
  field: Field;
  initial: Mark[];
  treatments: Step[][];
}

export interface Patient {
  name: string;
  title: string;
  intro: string;
  reaction: string;
  color: string;
  portrait: number;
  areas: Area[];
}

const toeSite: Point = [441, 232];
const earSite: Point = [346, 459];
const piercingCrust: Point = [301, 436];
const earCrease: Point = [352, 370];
const toeRunoff: Point = [12, 46];
const earRunoff: Point = [-35, 40];

const toe: Field = { anatomy: 'toe', marks: {
  wound: toeSite, rough: [374, 172], second: [204, 176], 'clip-tip': [394, 158],
  bump: toeSite, snag: [388, 167], 'clip-corner': [385, 174], gel: toeSite,
  patch: toeSite, redness: [391, 149], cooled: [391, 149], painted: [300, 244],
} };
const ear: Field = { anatomy: 'ear', marks: {
  wound: earSite, bump: earSite, stud: earSite, gel: earSite, patch: earSite,
} };
const eye: Field = { anatomy: 'eye', marks: {
  lens: [307, 315], fog: [307, 315],
} };
export const dentalSites = {
  chip: [209, 269], gunk: [418, 233], decay: [426, 377], cavity: [426, 377],
  tartar: [129, 173], 'lower-stain': [115, 368], 'upper-stain': [518, 222],
  crack: [334, 209], bracket: [477, 363], 'rough-enamel': [257, 333], caramel: [123, 225], seed: [295, 377],
} as const satisfies Record<DentalSite, Point>;

const clip: Step = {
  action: 'tap', tool: 'clip', title: 'Clip the curled corner', hint: 'Tap the curled corner twice.', success: 'There’s the bit that’s been poking me.',
  targets: [toe.marks['clip-tip']!, toe.marks['clip-corner']!], cuts: ['clip-tip', 'clip-corner'],
};
const extract: Step = {
  action: 'pull', tool: 'tweezers', title: 'Pull out the buried nail', hint: 'Grip the exposed tip and lift.', success: 'Oh, that was the bit!',
  at: toe.marks.snag!, to: [399, 53], mark: 'snag', remove: ['snag'],
};
const file: Step = {
  action: 'scrub', tool: 'file', title: 'Smooth the jagged edge', hint: 'Sweep the file along the jagged corner.', success: 'That edge feels much better.',
  at: toe.marks.rough!, radius: 75, distance: 240, edge: [[338, 155], [401, 198]], remove: ['rough'],
};
const cool: Step = {
  action: 'scrub', tool: 'cool', title: 'Soothe the redness', hint: 'Sweep the pad over the red skin.', success: 'Ahh, that cools it right down.',
  at: toe.marks.redness!, radius: 64, distance: 156, remove: ['redness'], add: ['cooled'],
};
const paint: Step = {
  action: 'paint', tool: 'paint', title: 'Paint the nail', hint: 'Brush polish across the whole nail.', success: 'Now that’s a good color.',
  at: toe.marks.painted!, radius: 141, add: ['painted'],
};
function pop(at: Point, runoff: Point, bump: Bump = 'bump', gel: Gel = 'gel'): Extract<Step, { action: 'hold' }> {
  return {
    action: 'hold', tool: 'pop', title: 'Drain the swelling', hint: 'Hold until it pops and flattens.', success: 'Phew, the pressure’s gone.',
    at, bump, gel, runoff, remove: [bump], add: [gel],
  };
}
function wipe(at: Point, runoff: Point, gel: Gel = 'gel'): Step {
  return {
    action: 'scrub', tool: 'wipe', title: 'Wipe it clean', hint: 'Swipe over the gel.', success: 'Much less sticky now.',
    at: [at[0] + runoff[0], at[1] + runoff[1]], radius: 75, distance: 160, wipe: gel, remove: [gel],
  };
}
function dress(at: Point): Step {
  return {
    action: 'tap', tool: 'dress', title: 'Cover the spot', hint: 'Tap the cleaned spot.', success: 'That feels protected.',
    targets: [at], remove: ['wound'], add: ['patch'],
  };
}

const ingrownNail: Mark[] = ['wound', 'rough', 'clip-tip', 'clip-corner', 'snag'];

const fullToe: Area = {
  field: toe, initial: [...ingrownNail, 'bump', 'redness'],
  treatments: [
    [clip, extract, cool, file, paint],
    [pop(toeSite, toeRunoff), wipe(toeSite, toeRunoff), dress(toe.marks.patch!)],
  ],
};
const removeStud: Step = {
  action: 'pull', tool: 'tweezers', title: 'Remove the stud', hint: 'Grip the stud and pull away.', success: 'I barely felt that.',
  at: earSite, to: [142, 476], mark: 'stud', remove: ['stud'],
};
const drainPiercing = {
  ...pop(earSite, earRunoff),
  title: 'Drain the piercing',
} satisfies Step;
const fullEar: Area = {
  field: { anatomy: 'ear', marks: {
    wound: earSite, 'ear-redness': earSite, bump: earSite, 'piercing-crust': piercingCrust,
    stud: earSite, gel: earSite, patch: earSite, 'crease-residue': earCrease,
  } },
  initial: ['stud', 'bump', 'wound', 'ear-redness', 'piercing-crust', 'crease-residue'],
  treatments: [
    [
      removeStud,
      { action: 'pull', tool: 'tweezers', title: 'Lift the crust', hint: 'Grip the dry edge and peel it away.', success: 'That crust was stubborn!',
        at: piercingCrust, to: [218, 401], mark: 'piercing-crust', remove: ['piercing-crust'] },
      drainPiercing,
      wipe(earSite, earRunoff),
      { action: 'scrub', tool: 'cool', title: 'Soothe the lobe', hint: 'Sweep the pad over the red skin.', success: 'Ahh, that cools it right down.',
        at: earSite, radius: 57, distance: 140, remove: ['ear-redness'] },
      dress(earSite),
    ],
    [{ action: 'scrub', tool: 'wipe', title: 'Clean the ear fold', hint: 'Swab along the amber streak.', success: 'You got the bit hiding in the fold.',
      at: earCrease, radius: 46, distance: 70, wipe: 'crease-residue', remove: ['crease-residue'] }],
  ],
};
function restoreTooth(site: DentalSurface, tool: Tool, title: string, hint: string, success: string): Step {
  return { action: 'scrub', tool, title, hint, success, at: dentalSites[site], reveal: site, remove: [site] };
}

function liftFromTooth(site: DentalLift, tool: Tool, to: Point, title: string, hint: string, success: string): Step {
  return { action: 'pull', tool, to, title, hint, success, at: dentalSites[site], mark: site, remove: [site] };
}

const dental: Area = {
  field: { anatomy: 'mouth', marks: dentalSites },
  initial: [...dentalSurfaces, ...dentalLifts],
  treatments: [
    [restoreTooth('chip', 'bond', 'Rebuild the chipped edge', 'Sweep resin over the missing corner.', 'I can’t feel the chip anymore.')],
    [liftFromTooth('gunk', 'floss', [383, 313], 'Floss out the leaf', 'Catch the green edge and pull.', 'So that’s where my salad went.')],
    [
      liftFromTooth('decay', 'scoop', [454, 302], 'Scoop out the decay', 'Catch the dark plug and lift.', 'Whoa, that all came from one tooth?'),
      restoreTooth('cavity', 'bond', 'Fill the clean cavity', 'Sweep resin into the hollow.', 'I can’t feel that dip anymore.'),
    ],
    [restoreTooth('tartar', 'scale', 'Scrape off the tartar', 'Sweep along the crust at the gumline.', 'My tooth feels so smooth there.')],
    [restoreTooth('lower-stain', 'brush', 'Brush the lower tooth', 'Brush over the brown stain.', 'That lower tooth looks cleaner already.')],
    [restoreTooth('upper-stain', 'brush', 'Brush the upper tooth', 'Brush over the brown stain.', 'That stain’s finally gone!')],
    [restoreTooth('crack', 'bond', 'Seal the cracked tooth', 'Sweep resin along the fracture.', 'I can barely see where it was.')],
    [liftFromTooth('bracket', 'tweezers', [526, 289], 'Remove the loose bracket', 'Grip the silver tab and pull it free.', 'My cheek won’t catch on that now.')],
    [restoreTooth('rough-enamel', 'file', 'File the jagged edge', 'Sweep along the raised enamel.', 'My tongue won’t catch on that anymore.')],
    [liftFromTooth('caramel', 'scoop', [92, 302], 'Lift the sticky caramel', 'Catch the amber piece and peel it away.', 'I knew that caramel would stick.')],
    [liftFromTooth('seed', 'floss', [272, 301], 'Floss out the seed', 'Catch the seed and slide it out of the gap.', 'That’s been bugging me all day.')],
    [{ action: 'paint', tool: 'whiten', title: 'Whiten the smile', hint: 'Brush across both rows.', success: 'Look at that shine!',
      at: [300, 300], radius: 320, add: ['whitened'], requiresClear: [...dentalSurfaces, ...dentalLifts] }],
  ],
};
const draftEye: Area = {
  field: eye, initial: ['lens', 'fog'],
  treatments: [[
    { action: 'scrub', tool: 'wipe', title: 'Clear the fog', hint: 'Wipe back and forth.', success: 'There it is',
      at: eye.marks.fog!, radius: 110, distance: 265, remove: ['fog'] },
    { action: 'pull', tool: 'lens', title: 'Peel the lens', hint: 'Seal onto the glint, then lift the lens.', success: 'Peel complete',
      at: eye.marks.lens!, to: [482, 143], mark: 'lens', remove: ['lens'] },
    { action: 'tap', tool: 'wipe', title: 'Bring back the sparkle', hint: 'Tap the glint.', success: 'Crystal clear',
      targets: [[292, 279]] },
  ]],
};
const eyeFinishMarks = {
  'eye-speck': [343, 352], 'eye-red-left': [161, 345], 'eye-red-right': [453, 343], 'lash-strip': [284, 229],
} as const satisfies Record<EyeMark, Point>;
const lensAndSpeck = ['lens', 'eye-speck'] as const;
const eyeDrops = (mark: Exclude<EyeMark, 'lash-strip'>, title: string, hint: string, success: string): Step => ({
  action: 'tap', tool: 'drops', title, hint, success, targets: [eyeFinishMarks[mark]], remove: [mark],
});
const fullEye: Area = {
  field: { anatomy: 'eye', marks: { ...eyeFinishMarks, lens: eye.marks.lens! } },
  initial: ['eye-red-left', 'eye-red-right', 'eye-speck', 'lens'],
  treatments: [
    [
      { action: 'pull', tool: 'lens', title: 'Lift the stuck lens', hint: 'Seal onto the lens, then drag it free.', success: 'Oh, I can blink again.',
        at: eye.marks.lens!, to: [469, 155], mark: 'lens', remove: ['lens'] },
      eyeDrops('eye-speck', 'Rinse away the speck', 'Tap the speck the lens uncovered.', 'That scratchy feeling’s gone.'),
    ],
    ...(['eye-red-left', 'eye-red-right'] as const).map(mark => [
      { ...eyeDrops(mark, 'Brighten the whites', 'Tap the pink whites.', 'That side feels calmer.'), requiresClear: lensAndSpeck },
    ]),
    [{ action: 'paint', tool: 'lashes', title: 'Lay the lash strip', hint: 'Sweep along the upper lash line.', success: 'They look great!',
      at: eyeFinishMarks['lash-strip'], radius: 300, add: ['lash-strip'], requiresClear: ['eye-red-left', 'eye-red-right'],
      line: [[96, 331], [125, 302], [156, 276], [190, 252], [228, 236], [270, 227], [311, 225],
        [352, 229], [394, 240], [431, 256], [465, 279], [489, 300]] }],
  ],
};
const gravelEntries = { left: [120, 403], center: [298, 467], right: [446, 437] } as const;
const splinterEntries = { left: [212, 287], right: [358, 371] } as const;
export const palmSites = {
  'palm-grit': [147, 240], 'splinter-left': [205, 265], 'splinter-right': [365, 350],
  'gravel-left-entry': gravelEntries.left, 'gravel-left': [120, 387],
  'gravel-center-entry': gravelEntries.center, 'gravel-center': [298, 450],
  'gravel-right-entry': gravelEntries.right, 'gravel-right': [445, 423],
  'palm-ointment-left': splinterEntries.left, 'palm-ointment-right': splinterEntries.right,
  'palm-ointment-gravel-left': gravelEntries.left, 'palm-ointment-gravel-center': gravelEntries.center, 'palm-ointment-gravel-right': gravelEntries.right,
  'palm-pad-left': splinterEntries.left, 'palm-pad-right': splinterEntries.right,
  'palm-pad-gravel-left': gravelEntries.left, 'palm-pad-gravel-center': gravelEntries.center, 'palm-pad-gravel-right': gravelEntries.right,
} as const satisfies Record<PalmMark | 'palm-grit', Point>;
const splinter = (mark: SplinterMark, to: Point): Step => ({
  action: 'pull', tool: 'tweezers', title: 'Lift the splinter', hint: 'Grip the exposed end and lift.',
  success: 'There goes that sharp little sting.', at: palmSites[mark], to, mark, remove: [mark],
});
function finishPalmSpot(spot: PalmSpot, entry?: GravelEntry): Step[] {
  const ointment = `palm-ointment-${spot}` as const;
  const pad = `palm-pad-${spot}` as const;
  const at = palmSites[ointment];
  return [
    { action: 'scrub', tool: 'ointment', title: 'Apply ointment', hint: 'Swipe across the exposed spot.', success: 'That feels soothing.',
      at, radius: 30, distance: 42, spread: ointment, add: [ointment] },
    { action: 'tap', tool: 'dress', title: 'Dress the treated spot', hint: 'Tap the spot with ointment.', success: 'Nice, that spot’s covered.',
      targets: [at], remove: entry ? [ointment, entry] : [ointment], add: [pad] },
  ];
}
function gravelTreatment(mark: GravelFragment): Step[] {
  const [x, y] = palmSites[mark];
  return [
    { action: 'pull', tool: 'tweezers', title: 'Lift the gravel chip', hint: 'Grip the gravel and lift it out.', success: 'That pebble was really wedged in.',
      at: [x, y], to: [x, y - 74], mark, remove: [mark] },
    ...finishPalmSpot(mark, `${mark}-entry`),
  ];
}
const palm: Area = {
  field: { anatomy: 'palm', marks: palmSites },
  initial: ['palm-grit', 'splinter-left', 'splinter-right',
    ...gravelFragments.flatMap(mark => [mark, `${mark}-entry` as const])],
  treatments: [
    [{ action: 'scrub', tool: 'wipe', title: 'Sweep off the grit', hint: 'Swipe over the sandy patch.', success: 'So much for washing my hands.',
      at: palmSites['palm-grit'], radius: 47, distance: 82, wipe: 'palm-grit', remove: ['palm-grit'] }],
    [splinter('splinter-left', [176, 200]), ...finishPalmSpot('left')],
    [splinter('splinter-right', [396, 284]), ...finishPalmSpot('right')],
    ...gravelFragments.map(gravelTreatment),
  ],
};
const doubleToe: Area = {
  field: toe, initial: [...ingrownNail, 'second'],
  treatments: [[clip, extract,
    { action: 'pull', tool: 'tweezers', title: 'A second snag!', hint: 'Grip the exposed sliver and lift.', success: 'Both slivers out',
      at: toe.marks.second!, to: [74, 54], mark: 'second', remove: ['second'] },
    file, dress(toe.marks.patch!)]],
};
const quickToe: Area = { field: toe, initial: ingrownNail, treatments: [[clip, extract, file, dress(toe.marks.patch!)]] };
const quickEar: Area = { field: ear, initial: ['bump', 'wound'], treatments: [[drainPiercing, wipe(earSite, earRunoff), dress(earSite)]] };
const secondEarSite: Point = [319, 489];
const festivalEar: Area = {
  field: { anatomy: 'ear', marks: {
    'second-wound': secondEarSite, 'second-bump': secondEarSite, ...ear.marks, 'second-gel': secondEarSite,
  } },
  initial: ['stud', 'bump', 'wound', 'second-bump', 'second-wound'],
  treatments: [[
    removeStud,
    { ...pop(earSite, earRunoff), success: 'First pocket drained' },
    { ...wipe(earSite, earRunoff), success: 'First pocket clean' },
    pop(secondEarSite, earRunoff, 'second-bump', 'second-gel'), wipe(secondEarSite, earRunoff, 'second-gel'),
    { ...dress(earSite), remove: ['wound', 'second-wound'] },
  ]],
};
const reverseEye: Area = {
  ...draftEye,
  treatments: [[
    draftEye.treatments[0][0],
    { action: 'pull', tool: 'lens', title: 'Peel the folded lens', hint: 'Seal onto the glint, then lift the lens.', success: 'That folds right off',
      at: eye.marks.lens!, to: [135, 151], mark: 'lens', remove: ['lens'] },
    draftEye.treatments[0][2],
  ]],
};

const patientCatalog: Patient[] = [
  { name: 'Milo', title: 'The ingrown nail', intro: 'My left sneaker and I are on a break.', reaction: 'I can wear both sneakers again!', color: '#f6a789', portrait: 0, areas: [fullToe] },
  { name: 'Zuri', title: 'The infected piercing', intro: 'Cute earring. Terrible roommate.', reaction: 'My ear finally feels better.', color: '#b3a1f0', portrait: 1, areas: [fullEar] },
  { name: 'Nina', title: 'The stuck lens', intro: 'My contact lens is refusing to clock out.', reaction: 'Oh wow. You have freckles.', color: '#91d9cb', portrait: 10, areas: [fullEye] },
  { name: 'Rae', title: 'Double snag', intro: 'I thought it was one snag. Then I put on a sock.', reaction: 'Two for the price of one!', color: '#f5bb8a', portrait: 3, areas: [doubleToe] },
  { name: 'Jules', title: 'The double feature', intro: 'My earring and my shoe are both in trouble.', reaction: 'Whole new me. Same terrible shoes.', color: '#c9b9f4', portrait: 4, areas: [quickEar, quickToe] },
  { name: 'Bea', title: 'Festival fallout', intro: 'I brought home glitter, a wristband, and this.', reaction: 'I’m going home to take a very long nap.', color: '#f0b0cb', portrait: 5, areas: [festivalEar] },
  { name: 'Kit', title: 'The backflip lens', intro: 'Pretty sure my contact just did a backflip.', reaction: 'My vision is officially in HD.', color: '#a9ccfa', portrait: 6, areas: [reverseEye] },
  { name: 'Val', title: 'Last chair', intro: 'Can I get the eye and toe combo?', reaction: 'I’m leaving a five-star review for the sound alone.', color: '#eed18c', portrait: 7, areas: [reverseEye, doubleToe] },
  { name: 'Ari', title: 'The chipped smile', intro: 'One popcorn kernel took that way too personally.', reaction: 'I’m smiling in every photo now.', color: '#a1d7cb', portrait: 8, areas: [dental] },
  { name: 'Sol', title: 'The splintered palm', intro: 'The garden won. It left souvenirs.', reaction: 'Back to the garden.', color: '#9ad3c7', portrait: 9, areas: [palm] },
];

// Keep save slots stable when draft patients move in or out of the queue.
export const patientSaveSlots = [0, 1, 8, 2, 9] as const;
export const patients = patientSaveSlots.map(index => patientCatalog[index]);

export const toolNames: Record<Tool, string> = {
  clip: 'Clipper', tweezers: 'Tweezers', file: 'File', pop: 'Popper', wipe: 'Swab', ointment: 'Ointment', dress: 'Dressing', lens: 'Lens lifter', cool: 'Cool pad', paint: 'Polish brush',
  bond: 'Resin', floss: 'Floss', scoop: 'Scoop', whiten: 'Whitening brush', drops: 'Eye drops', lashes: 'Lash applicator', scale: 'Scaler', brush: 'Toothbrush',
};
