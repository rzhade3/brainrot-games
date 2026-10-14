import { requireSave, saveObject } from './saveState';
import { requireCompatibleSave } from './saveErrors';
import { FactorySimulation, SimulationSave } from '../game/simulation';
import { GENERATOR_VERSION, WORLD_SIZE, WorldIdentity } from '../game/world';

export const SAVE_VERSION = 4;
export const CONTRACT_VERSION = 1;

export interface FactorySave {
  version: number;
  contractVersion: number;
  worldId: string;
  savedAt: number;
  map: WorldIdentity;
  paused: boolean;
  simulation: SimulationSave;
}

export function createSave(simulation: FactorySimulation, paused: boolean, worldId: string): FactorySave {
  return {
    version: SAVE_VERSION, contractVersion: CONTRACT_VERSION, worldId, savedAt: Date.now(),
    map: simulation.world.identity(), paused, simulation: simulation.serialize(),
  };
}

export function restoreSave(value: unknown): { save: FactorySave; simulation: FactorySimulation } {
  const source = saveObject(value);
  requireCompatibleSave(source.version === SAVE_VERSION && source.contractVersion === CONTRACT_VERSION,
    'Unsupported factory save version');
  const map = saveObject(source.map);
  requireCompatibleSave(map.id === 'seeded-world' && map.generatorVersion === GENERATOR_VERSION && map.size === WORLD_SIZE,
    'Unsupported factory map version');
  requireSave(typeof source.worldId === 'string' && source.worldId.length > 0 && source.worldId.length <= 100, 'invalid world identity');
  requireSave(typeof source.savedAt === 'number' && Number.isSafeInteger(source.savedAt) && source.savedAt >= 0, 'invalid save date');
  requireSave(typeof source.paused === 'boolean', 'invalid pause state');
  const simulation = FactorySimulation.restore(source.simulation);
  const identity = simulation.world.identity();
  requireSave(map.id === identity.id && map.seed === identity.seed && map.size === identity.size &&
    map.generatorVersion === identity.generatorVersion && Array.isArray(map.terrainChanges) &&
    map.terrainChanges.length === 0, 'world identity mismatch');
  return {
    simulation,
    save: {
      version: SAVE_VERSION, contractVersion: CONTRACT_VERSION, worldId: source.worldId, savedAt: source.savedAt,
      map: identity, paused: source.paused, simulation: simulation.serialize(),
    },
  };
}

export const SAVE_DATABASE = 'brainrot-pocket-factory';
export const SAVE_STORE = 'worlds';

export class SaveConflictError extends Error {
  constructor() {
    super('Another tab changed this save. Autosave has stopped. Reload to use the saved settlement.');
  }
}

export class SaveStorageError extends Error {}

export class FactorySaveStore {
  private connection: Promise<IDBDatabase> | null = null;
  private expected: unknown = null;
  private loaded = false;
  private expectedValid = false;
  private conflicted = false;

  private open(): Promise<IDBDatabase> {
    if (this.connection) return this.connection;
    this.connection = new Promise<IDBDatabase>((resolve, reject) => {
      if (!globalThis.indexedDB) {
        reject(new SaveStorageError('This browser cannot save settlements on this device. Try a browser with local storage enabled.'));
        return;
      }
      const request = indexedDB.open(SAVE_DATABASE, 1);
      let settled = false;
      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reject(error);
      };
      const timeout = setTimeout(() => fail(new SaveStorageError('Local storage did not respond. Close other Pocket Factory tabs, then retry.')), 10000);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(SAVE_STORE)) request.result.createObjectStore(SAVE_STORE);
      };
      request.onerror = () => fail(request.error ?? new SaveStorageError('Could not open local storage. Check your browser settings, then retry.'));
      request.onblocked = () => fail(new SaveStorageError('Another tab is blocking local storage. Close other Pocket Factory tabs, then retry.'));
      request.onsuccess = () => {
        if (settled) {
          request.result.close();
          return;
        }
        settled = true;
        clearTimeout(timeout);
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          this.connection = null;
        };
        resolve(db);
      };
    }).catch(error => {
      this.connection = null;
      throw error;
    });
    return this.connection;
  }

  async load(): Promise<FactorySave | null> {
    const db = await this.open();
    const value = await new Promise<unknown>((resolve, reject) => {
      const transaction = db.transaction(SAVE_STORE, 'readonly');
      const request = transaction.objectStore(SAVE_STORE).get('active');
      transaction.oncomplete = () => resolve(request.result ?? null);
      transaction.onabort = () => reject(transaction.error ?? new SaveStorageError('Could not read the saved settlement. Retry loading.'));
    });
    this.expected = value;
    this.loaded = true;
    this.expectedValid = false;
    this.conflicted = false;
    if (value === null) return null;
    const { save } = restoreSave(value);
    this.expectedValid = true;
    return save;
  }

  async write(save: FactorySave): Promise<void> {
    restoreSave(save);
    if (!this.loaded) throw new SaveStorageError('The existing save has not been read. Retry loading before replacing it.');
    if (this.conflicted) throw new SaveConflictError();
    const db = await this.open();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(SAVE_STORE, 'readwrite');
      const store = transaction.objectStore(SAVE_STORE);
      const request = store.get('active');
      let conflict = false;
      request.onsuccess = () => {
        if (JSON.stringify(request.result ?? null) !== JSON.stringify(this.expected)) {
          conflict = true;
          this.conflicted = true;
          transaction.abort();
          return;
        }
        if (this.expectedValid) store.put(this.expected, 'previous');
        store.put(save, 'active');
      };
      transaction.oncomplete = () => {
        this.expected = save;
        this.expectedValid = true;
        resolve();
      };
      transaction.onabort = () => reject(conflict ? new SaveConflictError()
        : transaction.error ?? new SaveStorageError('Could not save the settlement. Retry saving.'));
    });
  }

  close(): void {
    if (this.connection) void this.connection.then(db => db.close(), () => {});
    this.connection = null;
  }
}
