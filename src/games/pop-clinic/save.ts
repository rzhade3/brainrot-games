const legacyKey = 'brainrot:pop-clinic:v1';
export const soundKey = 'brainrot:pop-clinic:sound';
const recordKey = (slot: number, clean: boolean) => `brainrot:pop-clinic:case:${slot}:${clean ? 'clean' : 'cleared'}`;

export function createClinicSave(storage: Pick<Storage, 'getItem' | 'setItem'>) {
  const session = new Map<string, string>();
  const failedWrites = new Set<string>();
  const legacy = (() => {
    try { return JSON.parse(storage.getItem(legacyKey) ?? 'null'); } catch { return null; }
  })();

  function read(key: string): string | null {
    if (failedWrites.has(key)) return session.get(key) ?? null;
    try { return storage.getItem(key); } catch { return session.get(key) ?? null; }
  }

  function write(key: string, value: string): void {
    session.set(key, value);
    try {
      storage.setItem(key, value);
      failedWrites.delete(key);
    } catch {
      failedWrites.add(key);
    }
  }

  return {
    record(slot: number): { clean: boolean } | undefined {
      const prior = legacy?.records?.[slot]?.clean;
      if (prior === true || read(recordKey(slot, true)) === '1') return { clean: true };
      if (prior === false || read(recordKey(slot, false)) === '1') return { clean: false };
    },
    clear(slot: number, clean: boolean): void {
      // Independent, monotonic flags let overlapping tab writes preserve a clean finish.
      write(recordKey(slot, clean), '1');
    },
    get sound(): boolean {
      const value = read(soundKey);
      return value === null ? legacy?.sound !== false : value !== 'off';
    },
    set sound(enabled: boolean) {
      write(soundKey, enabled ? 'on' : 'off');
    },
  };
}
