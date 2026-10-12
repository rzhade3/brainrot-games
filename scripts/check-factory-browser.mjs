import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const url = process.env.FACTORY_URL ?? 'http://localhost:5174/games/factory/';
const operation = process.argv[2];
const directory = process.argv[3];
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined),
  headless: true,
});
const results = [];
try {
  for (const layout of [
    { name: 'desktop', viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
    { name: 'touch', viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  ]) {
    const context = await browser.newContext({ ...layout, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    const start = page.locator('[data-command="new-settlement"]');
    await start.waitFor();
    await page.waitForFunction(() => !document.querySelector('[data-command="new-settlement"]').disabled);
    await page.locator('#factory-world-seed').fill('north-bank');
    await start.click();
    await page.waitForFunction(() => !document.querySelector('.factory-settlement-dialog').open);
    await page.getByRole('button', { name: 'Pause factory', exact: true }).click();
    await page.evaluate(async () => {
      const { game } = await import(document.querySelector('script[src*="/src/games/factory/main.ts"]').src);
      game.loop.stop();
      const scene = game.scene.getScene('FactoryScene');
      const { FactorySimulation } = await import('/src/games/factory/game/simulation.ts');
      scene.startSettlement(FactorySimulation.create());
      scene.paused = true;
      for (let tick = 0; tick < 200; tick++) scene.simulation.step();
      scene.refreshSimulationHud();
      scene.hud.setPaused(true);
      for (let frame = 0; frame < 30; frame++) game.step(frame * 16.666, 16.666);
    });
    const result = await page.evaluate(async () => {
      const { game } = await import(document.querySelector('script[src*="/src/games/factory/main.ts"]').src);
      const scene = game.scene.getScene('FactoryScene');
      const samples = [];
      for (let trial = 0; trial < 7; trial++) {
        const start = performance.now();
        for (let frame = 0; frame < 240; frame++) game.step(frame * 16.666, 16.666);
        samples.push((performance.now() - start) / 240);
      }
      scene.act('focus-home');
      game.step(10000, 16.666);
      const pixels = game.canvas.getContext('2d').getImageData(0, 0, game.canvas.width, game.canvas.height).data;
      const digest = await crypto.subtle.digest('SHA-256', pixels);
      return {
        samples: samples.sort((a, b) => a - b),
        pixelHash: Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join(''),
        stats: { ...scene.terrain.stats },
        save: scene.simulation.serialize(),
        canvas: { width: game.canvas.width, height: game.canvas.height },
      };
    });
    assert.equal(await page.locator('.factory-resident-list button').count(), 4);
    assert.equal(result.stats.chunks <= 24, true);
    assert.equal(result.canvas.width, Math.floor(layout.viewport.width * layout.deviceScaleFactor));
    if (directory) {
      await mkdir(directory, { recursive: true });
      await page.screenshot({ path: `${directory}/${layout.name}${operation === '--compare' ? '-current' : ''}.png` });
    }
    const farmer = result.save.settlement.residents.find(resident => resident.job?.kind === 'farm');
    assert.ok(farmer);
    await page.locator(`.factory-resident-list [data-resident="${farmer.id}"]`).click();
    assert.match(await page.locator('#factory-resident-destination').innerText(), /Food plot/);
    await page.getByRole('button', { name: 'Close inspector', exact: true }).click();
    await page.getByRole('button', { name: 'Build', exact: true }).click();
    await page.getByRole('button', { name: 'Food plot', exact: true }).first().click();
    assert.equal(await page.locator('.factory-placement').isVisible(), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.factory-placement').isVisible(), false);
    const renderer = await page.evaluate(async () => {
      const { game } = await import(document.querySelector('script[src*="/src/games/factory/main.ts"]').src);
      const scene = game.scene.getScene('FactoryScene');
      const { FactorySimulation } = await import('/src/games/factory/game/simulation.ts');
      const { project } = await import('/src/games/factory/game/model.ts');
      const before = JSON.stringify(scene.simulation.serialize());
      let peakChunks = 0;
      let peakTextures = 0;
      let peakTextureBytes = 0;
      const panSamples = [];
      for (let index = 0; index < 32; index++) {
        const position = project(24 + index % 8 * 28, 24 + Math.floor(index / 8) * 56);
        scene.zoom = index % 3 === 0 ? scene.minimumZoom() : 1;
        scene.cameras.main.setZoom(scene.zoom * scene.dpr).centerOn(position.x, position.y);
        const start = performance.now();
        for (let frame = 0; frame < 24; frame++) game.step(12000 + frame * 16.666, 16.666);
        panSamples.push((performance.now() - start) / 24);
        peakChunks = Math.max(peakChunks, scene.terrain.stats.chunks);
        peakTextures = Math.max(peakTextures, Object.keys(game.textures.list).length);
        peakTextureBytes = Math.max(peakTextureBytes, scene.terrain.stats.textureBytes);
      }
      if (JSON.stringify(scene.simulation.serialize()) !== before) throw new Error('Panning changed the simulation');
      const dense = FactorySimulation.create();
      for (let c = 5; c < 22; c++) for (let r = 5; r < 22; r++) {
        if (!dense.placementError({ c, r }, 'food-plot')) dense.place({ c, r, kind: 'food-plot', direction: 0 });
      }
      for (let tick = 0; tick < 200; tick++) dense.step();
      scene.startSettlement(dense);
      scene.paused = true;
      scene.zoom = 0.45;
      const position = project(13, 13);
      scene.cameras.main.setZoom(scene.zoom * scene.dpr).centerOn(position.x, position.y);
      for (let frame = 0; frame < 60; frame++) game.step(15000 + frame * 16.666, 16.666);
      const samples = [];
      for (let trial = 0; trial < 7; trial++) {
        const start = performance.now();
        for (let frame = 0; frame < 120; frame++) game.step(16000 + frame * 16.666, 16.666);
        samples.push((performance.now() - start) / 120);
      }
      const pixels = game.canvas.getContext('2d').getImageData(0, 0, game.canvas.width, game.canvas.height).data;
      const digest = await crypto.subtle.digest('SHA-256', pixels);
      return {
        peakChunks, peakTextures, peakTextureBytes,
        panMedianMs: panSamples.sort((a, b) => a - b)[16],
        denseMedianMs: samples.sort((a, b) => a - b)[3],
        densePixelHash: Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join(''),
        denseMachines: dense.buildings.size,
        residentMachines: scene.machineArt.size,
        finalTextures: Object.keys(game.textures.list).length,
      };
    });
    assert.ok(renderer.peakChunks <= 24);
    assert.ok(renderer.peakTextures <= 47, 'Pan caches must not accumulate textures');
    assert.ok(renderer.finalTextures < renderer.peakTextures, 'Offscreen chunk textures must be released');
    assert.ok(renderer.residentMachines <= renderer.denseMachines);
    assert.deepEqual(errors, []);
    results.push({ name: layout.name, ...result, renderer });
    await context.close();
  }
  if (operation === '--record' && directory) await writeFile(`${directory}/browser.json`, JSON.stringify(results, null, 2));
  if (operation === '--compare' && directory) {
    const baseline = JSON.parse(await readFile(`${directory}/browser.json`, 'utf8'));
    for (let i = 0; i < results.length; i++) {
      assert.deepEqual(results[i].save, baseline[i].save, 'Browser simulation state must be unchanged');
      assert.deepEqual(results[i].canvas, baseline[i].canvas);
      if (baseline[i].pixelHash) assert.equal(results[i].pixelHash, baseline[i].pixelHash, 'Original paused canvas must remain pixel-identical');
      for (const key of ['chunks', 'props', 'textureBytes', 'landscapeBytes']) {
        assert.equal(results[i].stats[key], baseline[i].stats[key], `Renderer ${key} must be unchanged`);
      }
      console.log(results[i].name, 'baseline/current median frame CPU ms:', baseline[i].samples[3], results[i].samples[3]);
      assert.ok(results[i].samples[3] <= baseline[i].samples[3] * 1.15, 'Steady rendering must stay within the 15% timing tolerance');
      if (baseline[i].renderer) {
        for (const key of ['peakChunks', 'peakTextures', 'peakTextureBytes', 'denseMachines', 'residentMachines', 'finalTextures', 'densePixelHash']) {
          assert.equal(results[i].renderer[key], baseline[i].renderer[key], `Renderer ${key} must be preserved`);
        }
        console.log(results[i].name, 'baseline/current dense and pan CPU ms:',
          baseline[i].renderer.denseMedianMs, results[i].renderer.denseMedianMs,
          baseline[i].renderer.panMedianMs, results[i].renderer.panMedianMs);
        assert.ok(results[i].renderer.denseMedianMs <= baseline[i].renderer.denseMedianMs * 1.15,
          'Dense rendering must stay within the 15% timing tolerance');
        assert.ok(results[i].renderer.panMedianMs <= baseline[i].renderer.panMedianMs * 1.15,
          'Panning must stay within the 15% timing tolerance');
      }
    }
  }
  console.log('Factory browser checks passed:', results.map(result => ({
    layout: result.name, medianFrameMs: result.samples[3], stats: result.stats, renderer: result.renderer,
  })));
} finally {
  await browser.close();
}
