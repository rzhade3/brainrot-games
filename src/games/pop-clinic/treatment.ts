import type { Area, Mark, Step } from './cases';
import type { Coverage } from './coverage';

export interface Treatment {
  steps: readonly Step[];
  next: number;
  hits: number;
  progress: number;
  coverage?: Coverage;
}

export function startTreatments(area: Area): Treatment[] {
  return area.treatments.map(steps => ({ steps, next: 0, hits: 0, progress: 0 }));
}

export const step = (treatment: Treatment) => treatment.steps[treatment.next];

function blocked(current: Step, marks: ReadonlySet<Mark>): boolean {
  return current.requiresClear?.some(mark => marks.has(mark)) ?? false;
}

export function readyTreatments(treatments: readonly Treatment[], marks: ReadonlySet<Mark>): Treatment[] {
  return treatments.filter(treatment => {
    const current = step(treatment);
    return current && !blocked(current, marks);
  });
}

export function areaStatus(treatments: readonly Treatment[], marks: ReadonlySet<Mark>): 'ready' | 'blocked' | 'finished' {
  if (treatments.every(treatment => treatment.next === treatment.steps.length)) return 'finished';
  return readyTreatments(treatments, marks).length ? 'ready' : 'blocked';
}

export function applyTreatmentHit(treatment: Treatment, marks: Set<Mark>) {
  const current = step(treatment);
  if (!current || blocked(current, marks)) return;
  const cut = current.action === 'tap' ? current.cuts?.[treatment.hits] : undefined;
  if (cut) marks.delete(cut);
  if (current.action === 'tap' && ++treatment.hits < current.targets.length) return { current, cut, finished: false };

  current.remove?.forEach(mark => marks.delete(mark));
  current.add?.forEach(mark => marks.add(mark));
  treatment.next++;
  treatment.hits = 0;
  treatment.progress = 0;
  treatment.coverage = undefined;
  return { current, cut, finished: true };
}

export function finishedMarks(area: Area): Set<Mark> | undefined {
  const marks = new Set(area.initial);
  const treatments = startTreatments(area);
  while (true) {
    const [ready] = readyTreatments(treatments, marks);
    if (!ready) return areaStatus(treatments, marks) === 'finished' ? marks : undefined;
    applyTreatmentHit(ready, marks);
  }
}
