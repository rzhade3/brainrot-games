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
    await page.waitForFunction(() => !document.querySelector('[data-scenario="settlement"]')?.disabled);
    await page.locator('[data-scenario="settlement"]').click();
    await page.waitForFunction(() => !document.querySelector('.factory-scenario-dialog').open);
    const hashes = await page.evaluate(async () => {
      const { game } = await import(document.querySelector('script[src*="/src/games/factory/main.ts"]').src);
      const { FactorySimulation } = await import('/src/games/factory/game/simulation.ts');
      const { createDemo, project } = await import('/src/games/factory/game/model.ts');
      game.loop.stop();
      const scene = game.scene.getScene('FactoryScene');
      const sim = new FactorySimulation(createDemo(), 'free-play');
      for (let tick = 0; tick < 60; tick++) sim.step();
      scene.startScenario(sim);
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
  console.log('Factory motion checks passed: desktop/DPR-3 cargo, rotating extractors, active smelters, pause and reduced motion.');
} finally { await browser.close(); }
