import '../../core/pwa-game-gestures';
import './style.css';
import { isDentalLift, isPalmFragment, patients, patientSaveSlots, toolNames, type DentalSurface, type Mark, type Point, type Step, type Tool } from './cases';
import { drawCue, finishTreatmentArt, makeCoverage, makeRunoffCoverage, moveTool, portrait, renderField, setMark, setStudContact, showDrain, showDrainPop, showFileDust, showFiling, showOintment, showPaint, showPalmLift, showTreatmentImpact, showWipe, targetOf, toolIcon } from './art';
import { dentalGripTouches, showDentalGuides, showDentalLift } from './dental';
import { releaseAt, resolvePull, type PullPath } from './pull';
import { playContact, playFileContact, playSound, preloadRecordedSounds, setSoundEnabled, stopFileContact, treatmentImpact, unlockAudio } from './sound';
import { bound, edgeContact, gap } from './coverage';
import { advanceDrain, drainReach, setDrainContact, startDrain, type DrainClock } from './drain';
import { createClinicSave, soundKey } from './save';
import { applyTreatmentHit, areaStatus, finishedMarks, readyTreatments, startTreatments, step, type Treatment } from './treatment';

const app = document.querySelector<HTMLElement>('#app')!;
app.innerHTML = `
  <header class="masthead">
    <a class="small-button back" href="/" aria-label="Back to arcade">← <span>Arcade</span></a>
    <h1 aria-label="Pop Clinic">POP<span aria-hidden="true">✦</span>CLINIC</h1>
    <button class="small-button" id="audio" aria-pressed="true">Sound on</button>
  </header>
  <section class="clinic" aria-label="Treatment room">
    <div class="patient">
      <img id="portrait" width="40" height="40" alt="">
      <div class="patient-details"><p class="eyebrow" id="patient-name"></p><h2 id="case-title"></h2></div>
      <button class="text-button" id="open-gallery">Casebook</button>
      <div class="speech-bubble patient-speech" id="patient-speech" hidden>
        <p id="patient-line"></p>
        <p id="patient-next"></p>
      </div>
    </div>
    <div class="stage" id="stage" role="group" aria-label="Procedure table" aria-describedby="hint">
      <svg id="scene" viewBox="0 0 600 600" aria-hidden="true"></svg>
      <span class="field-label" id="field-label"></span>
      <span class="toast" id="toast" hidden></span>
      <div class="meter" id="meter" hidden aria-hidden="true"><div class="meter-track"><i id="fill"></i></div><span id="meter-label"></span></div>
    </div>
    <div id="procedure">
      <div class="instruction">
        <div class="instruction-line"><h3 id="instruction"></h3><p class="eyebrow" id="step-label"></p></div>
        <p id="hint"></p>
      </div>
      <div class="tool-grid" id="tool-grid" role="group" aria-label="Choose a tool"></div>
    </div>
    <section class="result" id="result" aria-label="Case result" hidden>
      <p class="eyebrow">Discharge note</p>
      <h3>Case closed!</h3>
      <div class="result-tools">
        <button class="small-button" id="compare" aria-pressed="false">See before</button>
        <button class="small-button" id="angle" hidden>Other area</button>
      </div>
      <button class="next" id="next"><span></span><strong aria-hidden="true">→</strong></button>
    </section>
  </section>
  <dialog id="gallery" aria-labelledby="gallery-title">
    <header><div><p class="eyebrow">Clinic records</p><h2 id="gallery-title">Casebook</h2></div><form method="dialog"><button class="small-button" aria-label="Close casebook">Close ×</button></form></header>
    <div class="casebook-reaction" id="casebook-reaction" hidden>
      <img id="casebook-portrait" width="36" height="36" alt="">
      <div class="speech-bubble" id="casebook-speech">
        <p class="eyebrow" id="casebook-patient"></p>
        <p id="casebook-line"></p>
      </div>
    </div>
    <div id="records"></div>
  </dialog>
  <div id="live" class="sr-only" role="status"></div>
`;

function element<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

const stage = element('stage');
const scene = document.querySelector<SVGSVGElement>('#scene')!;
const gallery = element<HTMLDialogElement>('gallery');
const soundButton = element<HTMLButtonElement>('audio');
const compare = element<HTMLButtonElement>('compare');
const next = element<HTMLButtonElement>('next');
const angle = element<HTMLButtonElement>('angle');
const toolGrid = element('tool-grid');

const save = createClinicSave({
  getItem: key => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
});
let soundOn = save.sound;

interface Gesture {
  treatment: Treatment;
  current: Step;
  pointer: number;
  origin: Point;
  previous: Point;
  drain?: DrainClock;
}

let patientIndex = Math.min(unlocked(), patients.length - 1);
let areaIndex = 0;
let treatments: Treatment[] = [];
let selectedTool: Tool | null = null;
let mistakes = 0;
let marks = new Set<Mark>();
let finalMarks: Set<Mark>[] = [];
let gesture: Gesture | null = null;
let drainFrame = 0;
let transition: ReturnType<typeof setTimeout> | undefined;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
let phase: 'treating' | 'transitioning' | 'result' = 'treating';
let before = false;
let viewingRecord = false;
let lastCompletedIndex: number | undefined;

const patient = () => patients[patientIndex];
const area = () => patient().areas[areaIndex];
const ready = () => readyTreatments(treatments, marks);
const treatmentsForTool = () => ready().filter(treatment => step(treatment).tool === selectedTool);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

function unlocked(): number {
  const first = patientSaveSlots.findIndex(slot => !save.record(slot));
  return first === -1 ? patients.length : first;
}

function updateSound(): void {
  soundOn = save.sound;
  setSoundEnabled(soundOn);
  soundButton.textContent = soundOn ? 'Sound on' : 'Sound off';
  soundButton.setAttribute('aria-pressed', String(soundOn));
}

soundButton.onclick = () => {
  save.sound = !soundOn;
  updateSound();
  if (soundOn) unlockAudio();
};

function play(tool: Parameters<typeof playSound>[0]): void {
  if (soundOn) playSound(tool);
}

function announce(message: string): void {
  element('live').textContent = message;
}

function toast(message: string): void {
  const label = element('toast');
  clearTimeout(toastTimer);
  label.textContent = message;
  label.hidden = false;
  toastTimer = setTimeout(() => { label.hidden = true; }, 1050);
}

function patientSpeaks(line: string, suggestion?: Step): void {
  const followUp = suggestion ? `Next: ${suggestion.title} · ${toolNames[suggestion.tool]}` : '';
  element('patient-line').textContent = line;
  const prompt = element('patient-next');
  prompt.textContent = followUp;
  prompt.hidden = !followUp;
  element('patient-speech').hidden = false;
  announce(`${phase === 'result' ? 'Case closed. ' : ''}${patient().name}: ${line}${followUp ? ` ${followUp}` : ''}`);
}

function updatePatient(): void {
  const current = patient();
  app.style.setProperty('--patient', current.color);
  element<HTMLImageElement>('portrait').src = portrait(current.portrait);
  element('patient-name').textContent = `${current.name} · ${patientIndex + 1}/${patients.length}`;
  element('case-title').textContent = current.title;
}

function renderToolTray(): void {
  const tools = new Set(patient().areas.flatMap(entry => entry.treatments.flat().map(step => step.tool)));
  preloadRecordedSounds(tools);
  toolGrid.innerHTML = (Object.keys(toolNames) as Tool[]).filter(tool => tools.has(tool)).map(tool => `
    <button class="tool-button" type="button" data-tool-choice="${tool}" aria-pressed="false">
      ${toolIcon(tool)}<span>${toolNames[tool]}</span>
    </button>`).join('');
}

toolGrid.onclick = event => {
  const button = (event.target as Element).closest<HTMLButtonElement>('[data-tool-choice]');
  if (!button) return;
  if (gesture) cancelGesture();
  selectedTool = button.dataset.toolChoice as Tool;
  if (soundOn && (selectedTool === 'clip' || selectedTool === 'lens' || selectedTool === 'file' || selectedTool === 'pop')) unlockAudio();
  for (const choice of toolGrid.querySelectorAll<HTMLButtonElement>('[data-tool-choice]')) {
    choice.setAttribute('aria-pressed', String(choice === button));
  }
  if (phase === 'treating') renderTreatment();
};

function startCase(index: number, { greet = true } = {}): void {
  clearTimeout(transition);
  transition = undefined;
  cancelGesture();
  element('patient-speech').hidden = true;
  patientIndex = index;
  selectedTool = null;
  renderToolTray();
  areaIndex = 0;
  mistakes = 0;
  finalMarks = [];
  phase = 'treating';
  before = false;
  viewingRecord = false;
  element('toast').hidden = true;
  element('result').hidden = true;
  element('procedure').hidden = false;
  stage.setAttribute('aria-describedby', 'hint');
  updatePatient();
  startArea();
  if (greet) patientSpeaks(patient().intro);
}

function startArea(): void {
  treatments = startTreatments(area());
  marks = new Set(area().initial);
  renderField(scene, area().field, marks);
  const label = element('field-label');
  label.hidden = patient().areas.length === 1;
  label.textContent = `Area ${areaIndex + 1}/${patient().areas.length}`;
  renderTreatment();
}

const multiSpotPrompts: Partial<Record<Tool, readonly [string, string]>> = {
  bond: ['Apply resin', 'Sweep over an exposed repair.'],
  wipe: ['Swab the residue', 'Sweep over an exposed patch.'],
  tweezers: ['Pick what to lift', 'Grip an exposed piece and lift.'],
  brush: ['Brush the teeth', 'Sweep over either brown stain.'],
  floss: ['Floss the gaps', 'Catch an exposed piece and pull it out.'],
  scoop: ['Pick what to scoop', 'Catch the decay or the caramel and lift.'],
};

function renderTreatment(announceInstructions = true): void {
  const available = ready();
  const equippedTreatments = available.filter(treatment => step(treatment).tool === selectedTool);
  if (area().field.anatomy === 'mouth') showDentalGuides(scene, equippedTreatments.map(step));
  const equipped = equippedTreatments[0];
  const prompt = selectedTool && equippedTreatments.length > 1 ? multiSpotPrompts[selectedTool] : undefined;
  const suggested = equipped ?? (available.length === 1 ? available[0] : undefined);
  const current = suggested && step(suggested);
  const completed = treatments.reduce((sum, treatment) => sum + treatment.next, 0)
    + patient().areas.slice(0, areaIndex).reduce((sum, entry) => sum + entry.treatments.flat().length, 0);
  const total = patient().areas.reduce((sum, entry) => sum + entry.treatments.flat().length, 0);
  const title = prompt?.[0] ?? current?.title ?? 'Pick a spot';
  const hint = prompt?.[1] ?? (equipped && current ? current.hint
    : selectedTool === 'whiten' ? 'Finish the repairs before whitening.' : 'Pick a tool for an exposed spot.');
  element('step-label').textContent = `${completed}/${total} done`;
  if (areaStatus(treatments, marks) === 'blocked') {
    element('instruction').textContent = 'Treatment blocked';
    element('hint').textContent = 'This case can’t continue. Open the casebook to replay.';
    announce('Treatment blocked.');
    return;
  }
  element('instruction').textContent = title;
  element('hint').textContent = hint;
  if (equipped && current && equippedTreatments.length === 1 && !(current.action === 'scrub' && current.reveal)) drawCue(scene, current, equipped.hits);
  else scene.querySelector('#cue')!.replaceChildren();
  if (announceInstructions) {
    if (equipped && !element('patient-speech').hidden) {
      const prompt = element('patient-next');
      prompt.textContent = hint;
      prompt.hidden = false;
    }
    announce(`${title}. ${hint}`);
  }
}

function renderResult(): void {
  const current = patient();
  const visible = before ? new Set(area().initial) : new Set(finalMarks[areaIndex]);
  renderField(scene, area().field, visible);
  element('field-label').hidden = false;
  element('field-label').textContent = `${before ? 'Before' : 'After'}${current.areas.length > 1 ? ` · Area ${areaIndex + 1}` : ''}`;
  compare.textContent = before ? 'See after' : 'See before';
  compare.setAttribute('aria-pressed', String(before));
  angle.hidden = current.areas.length < 2;
}

function showResult(fromGallery: boolean): void {
  phase = 'result';
  before = false;
  viewingRecord = fromGallery;
  stage.removeAttribute('aria-describedby');
  element('toast').hidden = true;
  element('procedure').hidden = true;
  element('result').hidden = false;
  const upcoming = patients[patientIndex + 1];
  next.querySelector('span')!.textContent = fromGallery || !upcoming ? 'Open casebook' : `Next patient · ${upcoming.title}`;
  renderResult();
}

function finish(): void {
  play('finish');
  updatePatient();
  showResult(false);
  patientSpeaks(patient().reaction);
  if (!gallery.open) next.focus({ preventScroll: true });
}

compare.onclick = () => {
  before = !before;
  renderResult();
};

angle.onclick = () => {
  areaIndex = (areaIndex + 1) % patient().areas.length;
  renderResult();
};

next.onclick = () => {
  if (viewingRecord || patientIndex === patients.length - 1) openGallery();
  else startCase(patientIndex + 1);
};

function openGallery(): void {
  cancelGesture();
  renderRecords();
  if (!gallery.open) gallery.showModal();
}

function renderRecords(): void {
  const reactionIndex = phase === 'result' ? patientIndex : lastCompletedIndex;
  const speaker = reactionIndex === undefined ? undefined : patients[reactionIndex];
  element('casebook-reaction').hidden = !speaker;
  if (speaker) {
    element<HTMLImageElement>('casebook-portrait').src = portrait(speaker.portrait);
    element('casebook-patient').textContent = speaker.name;
    element('casebook-line').textContent = speaker.reaction;
    gallery.setAttribute('aria-describedby', 'casebook-speech');
  } else {
    gallery.removeAttribute('aria-describedby');
  }

  const available = unlocked();
  element('records').innerHTML = patients.map((entry, index) => {
    const record = save.record(patientSaveSlots[index]);
    return `<article class="record">
      <img src="${portrait(entry.portrait)}" width="45" height="45" alt="" loading="lazy">
      <div><strong>${entry.title}</strong><span>${entry.name} · ${record ? 'Cleared' : index === available ? 'Ready' : 'Waiting'}</span></div>
      ${record ? `<button class="small-button" data-view="${index}" aria-label="View ${entry.title}">View</button>` : ''}
      <button class="small-button" data-play="${index}" aria-label="Play ${entry.title}" ${index > available ? 'disabled' : ''}>${record ? 'Replay' : 'Play'}</button>
    </article>`;
  }).join('');
}

window.addEventListener('storage', event => {
  if (event.key === null || event.key === soundKey) updateSound();
});

element('open-gallery').onclick = openGallery;
element('records').addEventListener('click', event => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (!button || button.disabled) return;
  gallery.close();
  const playIndex = button.dataset.play;
  if (playIndex !== undefined) {
    startCase(Number(playIndex));
    return;
  }
  const index = Number(button.dataset.view);
  const resolved = patients[index].areas.map(finishedMarks);
  if (resolved.some(remaining => !remaining)) {
    toast('This case record is unavailable');
    return;
  }
  startCase(index, { greet: false });
  finalMarks = resolved.filter(remaining => remaining !== undefined);
  showResult(true);
  patientSpeaks(patient().reaction);
  compare.focus({ preventScroll: true });
});

function complete(treatment: Treatment, at: Point, pull?: PullPath): void {
  const previouslyReady = new Set(ready().map(step));
  const outcome = applyTreatmentHit(treatment, marks);
  if (!outcome) return;
  const { current, cut, finished } = outcome;
  showTreatmentImpact(scene, current, at, marks, cut, pull);
  const cue = treatmentImpact(current, cut);
  if (cue) play(cue);
  if (!finished) {
    drawCue(scene, current, treatment.hits);
    return;
  }
  cancelGesture();
  scene.querySelector('#cue')!.replaceChildren();
  finishTreatmentArt(scene, area().field, marks, current);
  clearTimeout(toastTimer);
  element('toast').hidden = true;
  if (areaStatus(treatments, marks) !== 'finished') {
    const available = ready();
    renderTreatment(false);
    if (available.length) {
      const steps = available.map(step);
      const suggestion = available.includes(treatment) ? step(treatment)
        : steps.find(candidate => !previouslyReady.has(candidate))
          ?? steps.find(candidate => candidate.tool === current.tool)
          ?? steps[0];
      patientSpeaks(current.success, suggestion);
    }
    return;
  }

  phase = 'transitioning';
  finalMarks.push(new Set(marks));
  const lastArea = areaIndex + 1 === patient().areas.length;
  if (lastArea) {
    save.clear(patientSaveSlots[patientIndex], mistakes === 0);
    lastCompletedIndex = patientIndex;
    if (gallery.open) renderRecords();
  }
  transition = setTimeout(() => {
    transition = undefined;
    if (lastArea) finish();
    else {
      areaIndex++;
      phase = 'treating';
      startArea();
      patientSpeaks(current.success, ready().map(step)[0]);
    }
  }, reducedMotion.matches ? 80 : 390);
}

const fileReach = 30;
const drainReleaseAt = .24;

function drain(active: Gesture, current: Extract<Step, { action: 'hold' }>, clock: DrainClock, now: number): void {
  if (gesture !== active || clock.contactAt === null) return;
  const { treatment } = active;
  const fraction = advanceDrain(clock, now);
  const opened = treatment.progress <= drainReleaseAt && fraction > drainReleaseAt;
  const flowing = fraction > treatment.progress && fraction < 1;
  treatment.progress = fraction;
  const flow = bound((fraction - drainReleaseAt) / (1 - drainReleaseAt));
  const pressure = bound(fraction / drainReleaseAt);
  showDrain(scene, current, flow, pressure);
  if (opened) {
    play(area().field.anatomy === 'toe' ? 'abscess-release' : 'pop');
    if (!reducedMotion.matches) showDrainPop(scene, current);
  }
  // Leave the first beat clear for the pop before layering in the runoff.
  if (soundOn && flowing && flow > .06) playContact('pop', 3 + (1 - flow) * 12);
  updateMeter(fraction, flow > 0 ? 'Draining…' : pressure > 0 ? 'Building pressure…' : 'Hold steady');
  if (fraction >= 1) complete(treatment, current.at);
  else drainFrame = requestAnimationFrame(time => drain(active, current, clock, time));
}

function updateMeter(fraction: number, label: string): void {
  element('meter').hidden = false;
  element('fill').style.transform = `scaleX(${bound(fraction)})`;
  element('meter-label').textContent = label;
}

function cancelGesture(): void {
  const active = gesture;
  gesture = null;
  cancelAnimationFrame(drainFrame);
  stopFileContact();
  if (active && stage.hasPointerCapture(active.pointer)) {
    stage.releasePointerCapture(active.pointer);
  }
  if (active && phase === 'treating') {
    const { current } = active;
    if (current.action === 'pull' && current.mark) {
      setMark(scene, current.mark, 'transform', '');
      if (current.mark === 'lens') setMark(scene, 'lens', 'class', '');
      if (current.mark === 'stud') setStudContact(scene, 1);
      if (isPalmFragment(current.mark)) showPalmLift(scene, current.mark, [0, 0], current);
      if (isDentalLift(current.mark)) showDentalLift(scene, current.mark, 0);
    }
  }
  scene.querySelector('#held-tool')?.setAttribute('display', 'none');
  scene.querySelector('#file-dust')?.setAttribute('display', 'none');
  element('meter').hidden = true;
}

function begin(at: Point, pointer: number): void {
  if (phase !== 'treating' || gesture || gallery.open) return;
  const distanceTo = (treatment: Treatment) => gap(at, targetOf(step(treatment), treatment.hits));
  const treatment = treatmentsForTool().sort((left, right) => distanceTo(left) - distanceTo(right))[0];
  if (!treatment) return;
  const current = step(treatment);
  const target = targetOf(current, treatment.hits);
  const dentalScrub = current.action === 'scrub' && current.reveal;
  const radius = current.action === 'paint' ? current.radius : current.action === 'scrub' && !current.reveal
    ? Math.min(current.radius, 60) : current.action === 'hold' ? drainReach : 45;
  const hitsTarget = dentalScrub || current.action === 'paint' && current.tool === 'whiten'
    ? (treatment.coverage ??= makeCoverage(scene, current)).touches(at)
    : current.action === 'pull' && isDentalLift(current.mark)
      ? dentalGripTouches(scene, current.mark, at)
      : gap(at, target) <= radius;
  if (soundOn) unlockAudio();
  const cue = scene.querySelector('#cue')!;
  if (dentalScrub) cue.replaceChildren();
  else drawCue(scene, current, treatment.hits);
  if (!hitsTarget) {
    cue.classList.add('hint');
    toast(current.tool === 'whiten' ? 'Start on the teeth' : 'Try the highlighted spot');
    return;
  }
  cue.classList.remove('hint');
  if (current.action === 'tap') {
    complete(treatment, target);
    return;
  }
  const active: Gesture = { treatment, current, pointer, origin: at, previous: at };
  gesture = active;
  if (current.action !== 'paint') {
    moveTool(scene, current.tool, current.action === 'hold' || current.action === 'pull' ? target : at,
      current.action === 'pull' ? current : undefined);
  }
  stage.setPointerCapture(pointer);
  if (current.tool === 'lens') {
    setMark(scene, 'lens', 'class', 'lens-lifting');
    play('seal');
  } else if (current.action === 'pull' && current.tool === 'tweezers') {
    play('grip');
  }
  if (current.action === 'hold') {
    const now = performance.now();
    active.drain = startDrain(treatment.progress, now);
    drain(active, current, active.drain, now);
  }
  if (current.action === 'paint') paintAt(treatment, current, at, at);
}

type PaintStep = Extract<Step, { action: 'paint' }>;

function lashContact(line: readonly Point[], at: Point): { point: Point; angle: number; segment: number } | undefined {
  let nearest;
  let distance = 58;
  for (let segment = 0; segment + 1 < line.length; segment++) {
    const start = line[segment];
    const end = line[segment + 1];
    const point = edgeContact([start, end], at);
    const reach = gap(point, at);
    if (reach >= distance) continue;
    distance = reach;
    const angle = Math.atan2(end[1] - start[1], end[0] - start[0]) * 180 / Math.PI;
    nearest = { point, angle, segment };
  }
  return nearest;
}

function paintAt(treatment: Treatment, current: PaintStep, from: Point, to: Point): void {
  if (current.tool !== 'lashes') {
    moveTool(scene, current.tool, to);
    paintStroke(treatment, current, [from, to]);
    return;
  }
  const end = lashContact(current.line, to);
  if (!end) {
    scene.querySelector('#held-tool')!.setAttribute('display', 'none');
    return;
  }
  const start = lashContact(current.line, from) ?? end;
  const first = Math.min(start.segment, end.segment);
  const last = Math.max(start.segment, end.segment);
  const between = current.line.slice(first + 1, last + 1);
  if (start.segment > end.segment) between.reverse();
  moveTool(scene, 'lashes', end.point, end.angle);
  paintStroke(treatment, current, [start.point, ...between, end.point]);
}

function paintStroke(treatment: Treatment, current: PaintStep, points: readonly Point[]): void {
  const coverage = treatment.coverage ??= makeCoverage(scene, current);
  let distance = 0;
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1];
    const to = points[i];
    if (coverage.stroke(from, to)) showPaint(scene, from, to);
    distance += gap(from, to);
  }
  if (soundOn) playContact(current.tool, distance);
  const label = current.tool === 'whiten' ? 'Whitening…' : current.tool === 'lashes' ? 'Setting lashes…' : 'Polishing…';
  updateMeter(coverage.fraction, label);
  if (coverage.complete) complete(treatment, points[points.length - 1]);
}

const scrubLabels: Partial<Record<Tool, string>> = {
  file: 'Filing…', ointment: 'Spreading…',
};

const dentalScrubLabels: Partial<Record<Tool, string>> = {
  bond: 'Resin', file: 'Filing', scale: 'Scraping', brush: 'Brushing',
};

function scrubSound(tool: Tool, from: Point, to: Point, distance: number): void {
  if (!soundOn) return;
  if (tool === 'file') {
    const direction = Math.sign(to[0] - from[0] || to[1] - from[1]);
    playFileContact(distance, direction);
  } else playContact(tool, distance);
}

type DentalScrub = Extract<Step, { action: 'scrub'; reveal: DentalSurface }>;

function scrubTooth(treatment: Treatment, current: DentalScrub, from: Point, to: Point): void {
  const coverage = treatment.coverage ??= makeCoverage(scene, current);
  const painted = coverage.stroke(from, to);
  if (painted) showPaint(scene, from, to, current.reveal);
  const touching = coverage.touches(to);
  moveTool(scene, current.tool, to);
  if (current.tool === 'file') {
    if (touching && gap(from, to) > 0) showFileDust(scene, to);
    else scene.querySelector('#file-dust')!.setAttribute('display', 'none');
    if (!touching) stopFileContact();
  }
  if (touching || painted) scrubSound(current.tool, from, to, gap(from, to));
  const fraction = coverage.fraction;
  const label = dentalScrubLabels[current.tool] ?? 'Coverage';
  updateMeter(fraction, `${label} · ${Math.floor(fraction * 100)}%`);
  if (coverage.complete) complete(treatment, current.at);
}

function move(at: Point): void {
  if (!gesture) return;
  const { treatment, current } = gesture;
  if (current.action === 'hold' && gesture.drain) {
    const clock = gesture.drain;
    const touching = gap(at, current.at) <= drainReach;
    if (touching === (clock.contactAt !== null)) return;
    const now = performance.now();
    setDrainContact(clock, touching, now);
    if (touching) {
      moveTool(scene, current.tool, current.at);
      drain(gesture, current, clock, now);
    } else {
      cancelAnimationFrame(drainFrame);
      scene.querySelector('#held-tool')!.setAttribute('display', 'none');
      updateMeter(treatment.progress, 'Return to the spot');
    }
    return;
  }
  if (current.action === 'paint') {
    const previous = gesture.previous;
    gesture.previous = at;
    if (gap(previous, at) > 0) paintAt(treatment, current, previous, at);
    return;
  }
  if (current.action === 'pull') {
    const palmFragment = isPalmFragment(current.mark) ? current.mark : undefined;
    const embedded = current.mark === 'snag' || current.mark === 'second' || current.mark === 'piercing-crust';
    const { fraction, offset: [x, y], direction } = resolvePull(current, gesture.origin, at, palmFragment ? 'palm' : embedded ? 'embedded' : 'free');
    const position: Point = [current.at[0] + x, current.at[1] + y];
    const visualPull = fraction > 0 ? { at: current.at, to: position } : current;
    const lens = current.mark === 'lens';
    const turn = palmFragment ? 0 : current.mark === 'snag'
      ? 27 * fraction
      : -Math.sign(current.to[0] - current.at[0]) * (embedded ? 32 : lens ? 28 : 0) * fraction;
    const stretch = current.mark === 'stud' || current.mark === 'bracket' || palmFragment ? 0 : fraction;
    const width = 1 + stretch * (lens ? -.48 : .13);
    const height = 1 + stretch * (lens ? .08 : .32);
    if (current.mark) {
      setMark(scene, current.mark, 'transform', `translate(${x} ${y}) rotate(${turn}) scale(${width} ${height})`);
    }
    if (current.mark === 'stud') setStudContact(scene, 1 - bound(Math.hypot(x, y) / 19));
    if (palmFragment) showPalmLift(scene, palmFragment, [x, y], current);
    if (isDentalLift(current.mark)) showDentalLift(scene, current.mark, fraction);
    moveTool(scene, current.tool, position, visualPull);
    updateMeter(fraction, fraction === 0 ? 'Pull outward' : palmFragment ? 'Tension…' : lens ? 'Lifting…' : 'Keep pulling');
    if (fraction >= releaseAt) {
      const release = palmFragment
        ? { at: current.at, to: [current.at[0] + direction[0], current.at[1] + direction[1]] as Point }
        : visualPull;
      complete(treatment, position, release);
    }
  }
  if (current.action === 'scrub') {
    const previous = gesture.previous;
    gesture.previous = at;
    if (current.reveal) {
      scrubTooth(treatment, current, previous, at);
      return;
    }
    if (current.wipe === 'gel' || current.wipe === 'second-gel') {
      const coverage = treatment.coverage ??= makeRunoffCoverage(scene, current.wipe);
      moveTool(scene, current.tool, at);
      if (coverage.stroke(previous, at)) {
        showWipe(scene, current.wipe, area().field.marks[current.wipe]!, previous, at);
        if (soundOn) playContact('wipe', gap(previous, at));
      }
      updateMeter(coverage.fraction, 'Wiping away residue…');
      if (coverage.complete) complete(treatment, current.at);
      return;
    }
    const contact = current.edge ? edgeContact(current.edge, at) : at;
    const lastContact = current.edge ? edgeContact(current.edge, previous) : previous;
    const touching = current.edge ? gap(at, contact) <= fileReach : gap(at, current.at) <= current.radius;
    const wasTouching = current.edge ? gap(previous, lastContact) <= fileReach : gap(previous, current.at) <= current.radius;
    moveTool(scene, current.tool, touching ? contact : at);
    scene.querySelector('#file-dust')!.setAttribute('display', 'none');
    if (current.tool === 'file' && (!touching || !wasTouching)) stopFileContact();
    if (touching && wasTouching) {
      const distance = gap(contact, lastContact);
      treatment.progress += distance;
      scrubSound(current.tool, lastContact, contact, distance);
      if (current.edge && distance > 0) showFiling(scene, lastContact, contact);
      if (current.wipe) showWipe(scene, current.wipe, area().field.marks[current.wipe]!, previous, at);
      if (current.spread && distance > 0) showOintment(scene, current.spread, current.at, previous, at);
    }
    const fraction = bound(treatment.progress / current.distance);
    const coolingOverlay = current.tool === 'cool' ? scene.querySelector('#cooled-skin') : null;
    if (coolingOverlay) coolingOverlay.setAttribute('opacity', String(fraction));
    else if (!current.edge) current.remove?.forEach(mark => setMark(scene, mark, 'opacity', String(1 - fraction * .94)));
    updateMeter(fraction, scrubLabels[current.tool] ?? 'Keep swiping');
    if (fraction >= 1) complete(treatment, current.at);
  }
}

function release(): void {
  if (!gesture) return;
  const current = gesture.current;
  if (current.action === 'hold' && gesture.treatment.progress > 0) {
    toast(gesture.treatment.progress <= drainReleaseAt ? 'Paused · hold to build pressure' : 'Paused · hold to keep draining');
  }
  if (current.action === 'pull') {
    mistakes++;
    toast('Keep pulling until it comes free');
  }
  cancelGesture();
}

function point(event: PointerEvent): Point {
  const rect = scene.getBoundingClientRect();
  return [(event.clientX - rect.left) * 600 / rect.width, (event.clientY - rect.top) * 600 / rect.height];
}

stage.addEventListener('pointerdown', event => {
  if (!event.isPrimary || event.button !== 0 || phase !== 'treating') return;
  event.preventDefault();
  begin(point(event), event.pointerId);
});
stage.addEventListener('pointermove', event => {
  if (gesture?.pointer === event.pointerId) move(point(event));
});
stage.addEventListener('pointerup', event => {
  if (gesture?.pointer !== event.pointerId) return;
  move(point(event));
  release();
});
stage.addEventListener('lostpointercapture', event => {
  if (gesture?.pointer === event.pointerId) cancelGesture();
});
stage.addEventListener('pointercancel', event => {
  if (gesture?.pointer === event.pointerId) cancelGesture();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) cancelGesture();
});

updateSound();
startCase(patientIndex);
if (unlocked() === patients.length) openGallery();
// Keep the first paint free of the other close-ups, then warm the clinic queue.
window.addEventListener('load', () => {
  setTimeout(() => {
    for (const frame of ['toe-ingrown', 'toe-notched', 'toe-clipped', 'toe-rough-edge', 'toe-filed', 'toe-cooled', 'toe-painted', 'toe-raised', 'toe-flat',
      'ear', 'ear-stud', 'ear-piercing', 'ear-flat', 'ear-buildup', 'ear-dressed', 'mouth', 'mouth-repaired', 'mouth-scooped', 'mouth-details', 'mouth-rough-edge', 'mouth-food',
      'eye', 'eye-irritated', 'eye-lashes', 'palm', 'palm-clean', 'palm-pebble', 'palm-gravel-sides']) {
      const img = new Image();
      img.src = `/assets/pop-clinic/${frame}.webp`;
    }
  }, 650);
}, { once: true });
