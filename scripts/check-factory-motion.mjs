import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const url = process.env.FACTORY_URL ?? 'http://localhost:5174/games/factory/';
const operation = process.argv[2];
const path = process.argv[3];
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined),
  headless: true,
});
const results = [];
try {
  for (const touch of [false, true]) {
    const context = await browser.newContext({
      viewport: touch ? { width: 390, height: 844 } : { width: 1280, height: 800 },
      deviceScaleFactor: touch ? 3 : 1, reducedMotion: 'no-preference',
    });
    const page = await context.newPage();
    await page.goto(url);
    await page.waitForFunction(() => !document.querySelector('[data-command="new-settlement"]')?.disabled);
    await page.locator('[data-command="new-settlement"]').click();
    await page.waitForFunction(() => !document.querySelector('.factory-settlement-dialog').open);
    const hashes = await page.evaluate(async () => {
      const { game } = await import(document.querySelector('script[src*="/src/games/factory/main.ts"]').src);
      const { FactorySimulation } = await import('/src/games/factory/game/simulation.ts');
      const { project } = await import('/src/games/factory/game/model.ts');
      const { drawResident } = await import('/src/games/factory/assets/art.ts');
      game.loop.stop();
      const scene = game.scene.getScene('FactoryScene');
      const drawing = scene.add.graphics();
      const lines = [];
      const lineBetween = drawing.lineBetween.bind(drawing);
      drawing.lineBetween = (...coordinates) => {
        lines.push(coordinates);
        return lineBetween(...coordinates);
      };
      const frame = (stride, working, facing) => {
        lines.length = 0;
        drawing.clear();
        drawResident(drawing, 0, 0, 0, stride, null, working, facing);
        return structuredClone(lines);
      };
      const feet = frame => frame.filter(([, startY]) => startY === -7);
      for (const facing of [{ x: 0, y: 1 }, { x: 38, y: 19 }, { x: -38, y: -19 },
        { x: 38, y: -19 }, { x: -38, y: 19 }]) {
        const a = frame(0, true, facing);
        const b = frame(0.75, true, facing);
        if (feet(a).length !== 2 || JSON.stringify(feet(a)) !== JSON.stringify(feet(b)) ||
            JSON.stringify(a) === JSON.stringify(b)) {
          throw new Error('Shared work animation must plant both feet while arms/tool move');
        }
        if (JSON.stringify(feet(frame(0, false, facing))) ===
            JSON.stringify(feet(frame(0.75, false, facing)))) {
          throw new Error('Walking animation must retain its leg motion');
        }
      }
      drawing.destroy();
      const sim = FactorySimulation.create();
      for (const building of [
        { kind: 'miner', c: 7, r: 10, direction: 0 },
        { kind: 'belt', c: 8, r: 10, direction: 0 },
        { kind: 'furnace', c: 9, r: 10, direction: 0 },
        { kind: 'belt', c: 10, r: 10, direction: 0 },
        { kind: 'storage', c: 11, r: 10, direction: 0 },
      ]) {
        const error = sim.place(building);
        if (error) throw new Error(`Motion fixture: ${error}`);
      }
      for (let tick = 0; tick < 60; tick++) sim.step();
      const snapshot = sim.serialize();
      if (!snapshot.machines.some(machine => machine.item) ||
          !snapshot.machines.some(machine => machine.building.kind === 'furnace' && machine.running)) {
        throw new Error('Motion fixture must include real conveyor cargo and an active smelter');
      }
      scene.startSettlement(sim);
      const center = project(12, 12);
      scene.zoom = 0.8;
      scene.cameras.main.setZoom(scene.zoom * scene.dpr).centerOn(center.x, center.y);
      // Freeze authoritative stepping while exercising interpolation and motion policy.
      sim.advance = () => 0;
      scene.resetElapsed = false;
      const hashes = [];
      for (const mode of ['normal', 'paused', 'reduced']) {
        scene.paused = mode === 'paused';
        scene.motionPaused = mode === 'reduced';
        for (const fraction of [0, 0.25, 0.5, 0.75]) {
          sim.accumulator = fraction * 100;
          for (let frame = 0; frame < 20; frame++) game.step(10000, 0);
          const pixels = game.canvas.getContext('2d').getImageData(0, 0, game.canvas.width, game.canvas.height).data;
          const digest = await crypto.subtle.digest('SHA-256', pixels);
          hashes.push(Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join(''));
        }
      }
      return hashes;
    });
    assert.notEqual(hashes[0], hashes[3], 'Normal motion must interpolate real cargo and machinery');
    assert.equal(hashes[4], hashes[7], 'Paused motion must not interpolate');
    assert.equal(hashes[8], hashes[11], 'Reduced motion must not interpolate');
    results.push(hashes);
    await context.close();
  }
  if (operation === '--record' && path) await writeFile(path, JSON.stringify(results));
  else if (operation === '--compare' && path) assert.deepEqual(results, JSON.parse(await readFile(path, 'utf8')),
    'Normal, paused and reduced-motion cargo/machinery frames must remain pixel-identical');
  else assert.equal(operation, undefined);
  console.log('Factory motion checks passed: planted working feet, animated arms/tools, walking legs, desktop/DPR-3 cargo, rotating extractors, active smelters, pause and reduced motion.');
} finally { await browser.close(); }
