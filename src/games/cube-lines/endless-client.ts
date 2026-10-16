import type { GeneratedPuzzle, GenerationRequest, GenerationResponse } from './endless';

export class EndlessGenerator {
  private worker: Worker | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;

  cancel(): void {
    this.worker?.terminate();
    this.worker = null;
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  generate(request: GenerationRequest, done: (puzzle: GeneratedPuzzle) => void, fail: (message: string) => void): void {
    this.cancel();
    const reject = (message: string) => {
      this.cancel();
      fail(message);
    };
    try {
      const worker = new Worker(new URL('./endless.worker.ts', import.meta.url), { type: 'module' });
      this.worker = worker;
      worker.onmessage = ({ data }: MessageEvent<GenerationResponse>) => {
        if (this.worker !== worker) return;
        this.cancel();
        if (data.ok) done(data.puzzle);
        else fail(data.error);
      };
      worker.onerror = event => {
        if (this.worker !== worker) return;
        event.preventDefault();
        reject(event.message || 'The puzzle worker could not start.');
      };
      worker.onmessageerror = () => {
        if (this.worker === worker) reject('The puzzle worker returned unreadable data.');
      };
      this.timer = setTimeout(() => reject('Puzzle generation took too long. Please retry.'), 15000);
      worker.postMessage(request);
    } catch (error) {
      reject(error instanceof Error ? error.message : 'Puzzle generation is unavailable.');
    }
  }
}
