import type { Scenario } from '../game/domain';
import { createSave, FactorySave, FactorySaveStore, restoreSave, SaveConflictError } from './persistence';
import { FactorySimulation } from '../game/simulation';

export interface SaveStore {
  load(): Promise<FactorySave | null>;
  write(save: FactorySave): Promise<void>;
  close(): void;
}

interface SessionView {
  setSavedScenario(scenario: Scenario | null, message: string, blocked: boolean, existing: boolean): void;
  setSaveStatus(text: string, error?: boolean, retry?: boolean): void;
}

export class FactorySession {
  simulation = FactorySimulation.forScenario('free-play');
  paused = false;
  worldId: string | null = null;
  private savedFactory: FactorySave | null = null;
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
    this.view.setSavedScenario(null, 'Reading local save...', true, false);
    try {
      const saved = await this.store.load();
      if (this.closed) return;
      this.savedFactory = saved;
      this.view.setSavedScenario(saved?.simulation.scenario ?? null, saved
        ? `Last saved ${new Date(saved.savedAt).toLocaleString()}` : '', false, !!saved);
      this.view.setSaveStatus(saved ? 'Local save available to resume' : 'Choose a scenario to begin autosaving');
    } catch (error) {
      if (this.closed) return;
      const message = error instanceof Error ? error.message : String(error);
      const invalid = /Corrupt factory save|Unsupported factory/.test(message);
      this.view.setSavedScenario(null, `${message} ${invalid ? 'Start a new factory only if you want to replace this unreadable save.' : 'No save was replaced.'}`,
        !invalid, invalid);
      this.view.setSaveStatus(`Load failed: ${message}`);
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

  async replace(scenario: Scenario, seed: string): Promise<boolean> {
    if (this.closed || this.replacing) return false;
    this.replacing = true;
    this.view.setSaveStatus('Saving new factory...');
    try {
      const simulation = FactorySimulation.forScenario(scenario, seed.trim() || crypto.randomUUID());
      const id = crypto.randomUUID();
      const save = createSave(simulation, false, id);
      await this.queueWrite(save);
      if (this.closed) return false;
      this.worldId = id;
      this.savedFactory = save;
      this.revision = this.savedRevision = 0;
      this.autosaveElapsed = 0;
      this.conflicted = false;
      this.simulation = simulation;
      this.paused = false;
      this.activate(simulation, false, false);
      this.view.setSavedScenario(scenario, 'New factory saved on this device.', false, true);
      this.view.setSaveStatus('Saved on this device');
      return true;
    } catch (error) {
      if (this.closed) return false;
      const message = error instanceof Error ? error.message : String(error);
      this.view.setSavedScenario(this.savedFactory?.simulation.scenario ?? null,
        `Could not start a new factory: ${message} Your previous save was not changed.`, false, true);
      this.view.setSaveStatus(`Save failed: ${message}`, !!this.worldId);
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
    this.view.setSaveStatus('Saved factory resumed on this device');
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
    this.view.setSaveStatus('Saving locally...');
    try {
      await this.queueWrite(save);
      if (this.closed || this.worldId !== worldId) return;
      this.savedFactory = save;
      this.savedRevision = revision;
      this.view.setSaveStatus(this.savedRevision === this.revision ? 'Saved on this device' : 'Autosave active · new changes pending');
    } catch (error) {
      if (this.closed || this.worldId !== worldId) return;
      if (error instanceof SaveConflictError) this.conflicted = true;
      const message = error instanceof Error ? error.message : String(error);
      this.view.setSaveStatus(`Not saved: ${message}`, true, !this.conflicted);
    }
  }

  close(): void {
    this.closed = true;
    this.store.close();
  }
}
