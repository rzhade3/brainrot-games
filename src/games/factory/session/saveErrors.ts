export class FactorySaveError extends Error {
  constructor(readonly kind: 'incompatible' | 'damaged', detail: string) {
    super(detail);
  }
}

export function requireCompatibleSave(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new FactorySaveError('incompatible', detail);
}
