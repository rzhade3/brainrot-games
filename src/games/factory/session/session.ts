import { createSave, FactorySave, FactorySaveStore, restoreSave, SaveConflictError, SaveStorageError } from './persistence';
import { FactorySaveError } from './saveErrors';
import { FactorySimulation } from '../game/simulation';

export interface SaveStore {
  load(): Promise<FactorySave | null>;
  write(save: FactorySave): Promise<void>;
  close(): void;
}

interface SessionView {
  setSavedSettlement(resumable: boolean, message: string, blocked: boolean, existing: boolean): void;
  setSaveStatus(text: string, error?: boolean, retry?: boolean): void;
}

function storageMessage(error: unknown, action: 'load' | 'replace' | 'save'): string {
  if (error instanceof SaveStorageError || error instanceof SaveConflictError) return error.message;
  if (error instanceof DOMException) {
    if (error.name === 'QuotaExceededError') return 'Not enough space to save. Free some space on this device, then retry.';
    if (error.name === 'SecurityError' || error.name === 'NotAllowedError') {
      return 'Browser settings block local saving. Allow storage for this site, then retry.';
    }
  }
  console.error(`Pocket Factory save ${action} failed.`, error);
  return action === 'load' ? 'Could not read your save. Retry loading.'
    : action === 'replace' ? 'Could not save the new settlement. Try again.'
      : 'Could not save changes. Retry saving.';
}

export class FactorySession {
  simulation = FactorySimulation.create();
  paused = false;
  worldId: string | null = null;
  private savedFactory: FactorySave | null = null;
  private existingSave = false;
  private saveQueue: Promise<void> = Promise.resolve();
  private revision = 0;
  private savedRevision = -1;
  private autosaveElapsed = 0;
  private conflicted = false;
  private loading = false;
  private replacing = false;
  private closed = false;

  constructor(
    private view: SessionView,
    private activate: (simulation: FactorySimulation, paused: boolean, resumed: boolean) => void,
    private store: SaveStore = new FactorySaveStore(),
  ) {}

  async load(): Promise<void> {
    if (this.loading || this.worldId || this.closed) return;
    this.loading = true;
    this.view.setSavedSettlement(false, 'Reading local save...', true, false);
    try {
      const saved = await this.store.load();
      if (this.closed) return;
      this.savedFactory = saved;
      this.existingSave = !!saved;
      this.view.setSavedSettlement(!!saved, saved
        ? `Last saved ${new Date(saved.savedAt).toLocaleString()}` : '', false, !!saved);
      this.view.setSaveStatus(saved ? 'Saved on this device' : 'No saved settlement');
    } catch (error) {
      if (this.closed) return;
      const invalid = error instanceof FactorySaveError;
      this.existingSave = invalid;
      const message = invalid
        ? `${error.kind === 'incompatible' ? 'This save cannot be resumed in this version of Pocket Factory.'
          : 'This save is damaged and cannot be resumed.'} You can replace it with a new settlement.`
        : storageMessage(error, 'load');
      this.view.setSavedSettlement(false, `${message} No save was replaced.`, !invalid, invalid);
      this.view.setSaveStatus(invalid ? 'Existing save kept on this device' : 'Local save unavailable');
    } finally {
      this.loading = false;
    }
  }

  private queueWrite(save: FactorySave): Promise<void> {
    const operation = this.saveQueue.then(() => {
      if (this.closed) throw new Error('Factory session is closed.');
      return this.store.write(save);
    });
    this.saveQueue = operation.then(() => {}, () => {});
    return operation;
  }

  async replace(seed: string): Promise<boolean> {
    if (this.closed || this.replacing) return false;
    this.replacing = true;
    this.view.setSaveStatus('Saving new settlement...');
    try {
      const simulation = FactorySimulation.create(seed.trim() || crypto.randomUUID());
      const id = crypto.randomUUID();
      const save = createSave(simulation, false, id);
      await this.queueWrite(save);
      if (this.closed) return false;
      this.worldId = id;
      this.savedFactory = save;
      this.existingSave = true;
      this.revision = this.savedRevision = 0;
      this.autosaveElapsed = 0;
      this.conflicted = false;
      this.simulation = simulation;
      this.paused = false;
      this.activate(simulation, false, false);
      this.view.setSavedSettlement(true, 'New settlement saved on this device.', false, true);
      this.view.setSaveStatus('Saved on this device');
      return true;
    } catch (error) {
      if (this.closed) return false;
      const message = storageMessage(error, 'replace');
      this.view.setSavedSettlement(!!this.savedFactory,
        `${message} No save was replaced.`, false, this.existingSave);
      this.view.setSaveStatus('New settlement not saved', !!this.worldId, false);
      return false;
    } finally {
      this.replacing = false;
    }
  }

  resume(): void {
    if (!this.savedFactory || this.closed || this.replacing) return;
    const { save, simulation } = restoreSave(this.savedFactory);
    this.simulation = simulation;
    this.worldId = save.worldId;
    this.paused = save.paused;
    this.revision = this.savedRevision = 0;
    this.activate(simulation, save.paused, true);
    this.view.setSaveStatus('Saved on this device');
  }

  changed(saveImmediately = true): void {
    this.revision++;
    if (saveImmediately) void this.save();
  }

  update(elapsedMs: number, suspended: boolean): void {
    if (!this.worldId || suspended || this.closed) return;
    this.autosaveElapsed += Math.min(elapsedMs, 250);
    if (this.autosaveElapsed >= 5000) {
      this.autosaveElapsed = 0;
      void this.save();
    }
  }

  async save(force = false): Promise<void> {
    if (!this.worldId || this.replacing || this.conflicted || this.closed ||
        !force && this.savedRevision === this.revision) return;
    const worldId = this.worldId;
    const revision = this.revision;
    const save = createSave(this.simulation, this.paused, worldId);
    this.view.setSaveStatus('Saving on this device...');
    try {
      await this.queueWrite(save);
      if (this.closed || this.worldId !== worldId) return;
      this.savedFactory = save;
      this.savedRevision = revision;
      this.view.setSaveStatus(this.savedRevision === this.revision ? 'Saved on this device' : 'Saving new changes...');
    } catch (error) {
      if (this.closed || this.worldId !== worldId) return;
      if (error instanceof SaveConflictError) this.conflicted = true;
      this.view.setSaveStatus(storageMessage(error, 'save'), true, !this.conflicted);
    }
  }

  close(): void {
    this.closed = true;
    this.store.close();
  }
}
