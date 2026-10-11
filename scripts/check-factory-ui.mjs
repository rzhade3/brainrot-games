import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const url = process.env.FACTORY_URL ?? 'http://localhost:5174/games/factory/';
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined),
  headless: true,
});
async function gameState(page) {
  return page.evaluate(async () => {
    const { game } = await import(document.querySelector('script[src*="/src/games/factory/main.ts"]').src);
    const scene = game.scene.getScene('FactoryScene');
    return scene.simulation.serialize();
  });
}
async function coordinates(page, mode, tile) {
  return page.evaluate(async ({ mode, tile }) => {
    const { game } = await import(document.querySelector('script[src*="/src/games/factory/main.ts"]').src);
    const scene = game.scene.getScene('FactoryScene');
    const { project } = await import('/src/games/factory/game/domain.ts');
    const { pickBuilding } = await import('/src/games/factory/assets/picking.ts');
    const { planRoute } = await import('/src/games/factory/game/beltRoute.ts');
    const camera = scene.cameras.main;
    camera.preRender();
    const rect = game.canvas.getBoundingClientRect();
    const point = tile => {
      const world = project(tile.c, tile.r);
      const screen = camera.matrix.transformPoint(world.x - camera.scrollX, world.y - camera.scrollY);
      return {
        x: rect.left + screen.x * rect.width / game.canvas.width,
        y: rect.top + screen.y * rect.height / game.canvas.height,
      };
    };
    const exposed = point => document.elementFromPoint(point.x, point.y) === game.canvas;
    if (tile) {
      const screen = point(tile);
      if (!exposed(screen)) throw new Error(`Target tile is covered: ${JSON.stringify({ tile, screen })}`);
      return screen;
    }
    const candidates = [];
    for (let c = 2; c < 24; c++) for (let r = 2; r < 24; r++) {
      const tile = { c, r };
      if (scene.simulation.placementError(tile, mode === 'route' ? 'belt' : 'storage')) continue;
      if (mode === 'route' && pickBuilding(project(tile.c, tile.r), scene.simulation.buildings)) continue;
      const first = point(tile);
      if (!exposed(first)) continue;
      if (mode !== 'route') return { tile, first };
      const end = { c: c + 2, r };
      if ([1, 2].some(offset => scene.simulation.placementError({ c: c + offset, r }, 'belt'))) continue;
      if (pickBuilding(project(end.c, end.r), scene.simulation.buildings) ||
          planRoute(scene.simulation, tile, end).blocked) continue;
      const last = point(end);
      if (exposed(last)) candidates.push({ tile, end, first, last });
    }
    candidates.sort((a, b) => Math.hypot(a.first.x - window.innerWidth / 2, a.first.y - window.innerHeight / 2) -
      Math.hypot(b.first.x - window.innerWidth / 2, b.first.y - window.innerHeight / 2));
    if (candidates.length) return candidates[0];
    throw new Error('No unobscured buildable tile found');
  }, { mode, tile });
}
try {
  for (const touch of [false, true]) {
    const context = await browser.newContext({
      viewport: touch ? { width: 390, height: 844 } : { width: 1280, height: 800 },
      deviceScaleFactor: touch ? 3 : 1, isMobile: touch, hasTouch: touch, reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    await page.waitForFunction(() => !document.querySelector('[data-scenario="settlement"]')?.disabled);
    await page.locator('#factory-world-seed').fill('north-bank');
    await page.locator('[data-scenario="settlement"]').click();
    await page.waitForFunction(() => !document.querySelector('.factory-scenario-dialog').open);
    await page.getByRole('button', { name: 'Pause factory', exact: true }).click();
    const tap = point => touch ? page.touchscreen.tap(point.x, point.y) : page.mouse.click(point.x, point.y);
    await page.getByRole('button', { name: 'Build', exact: true }).click();
    await page.getByRole('button', { name: 'Depot', exact: true }).first().click();
    const placement = await coordinates(page, 'storage');
    const before = await gameState(page);
    await tap(placement.first);
    const placed = await gameState(page);
    assert.equal(placed.machines.length, before.machines.length + 1);
    assert.ok(placed.machines.some(machine => machine.building.kind === 'storage' &&
      machine.building.c === placement.tile.c && machine.building.r === placement.tile.r));
    await page.keyboard.press('Escape');
    await tap(await coordinates(page, 'inspect', placement.tile));
    await page.getByRole('button', { name: 'Remove selected building', exact: true }).click();
    assert.equal((await gameState(page)).machines.length, before.machines.length);
    await page.getByRole('button', { name: 'Build', exact: true }).click();
    await page.getByRole('button', { name: 'Conveyor', exact: true }).first().click();
    const route = await coordinates(page, 'route');
    await tap(route.first);
    if (touch) {
      const cdp = await context.newCDPSession(page);
      const first = { x: route.first.x - 18, y: route.first.y + 25 };
      const second = { x: route.first.x + 18, y: route.first.y + 25 };
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [first, second] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [
        { x: first.x - 3, y: first.y }, { x: second.x + 3, y: second.y },
      ] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await cdp.detach();
    } else {
      await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    }
    await tap(await coordinates(page, 'route', route.end));
    if (touch) await page.locator('[data-action="build-route"]').click();
    const built = await gameState(page);
    const routeState = await page.evaluate(async () => {
      const { game } = await import(document.querySelector('script[src*="/src/games/factory/main.ts"]').src);
      const scene = game.scene.getScene('FactoryScene');
      return { route: scene.routePreview, start: scene.routeStart, tool: scene.tool };
    });
    assert.equal(built.machines.length, before.machines.length + 3, JSON.stringify(routeState));
    await page.getByRole('button', { name: /^Undo last conveyor route/ }).click();
    assert.equal((await gameState(page)).machines.length, before.machines.length);
    await page.waitForFunction(() => document.querySelector('#factory-save-state')?.textContent.includes('Saved on this device'));
    const saved = await gameState(page);
    await page.reload();
    await page.locator('[data-command="resume-save"]').click();
    await page.getByRole('button', { name: 'Resume factory', exact: true }).waitFor();
    assert.deepEqual(await gameState(page), saved, 'Native interactions must persist and resume exactly');
    for (const reducedMotion of ['reduce', 'no-preference']) {
      await page.emulateMedia({ reducedMotion });
      await page.waitForFunction(async reduced => {
        const { game } = await import(document.querySelector('script[src*="/src/games/factory/main.ts"]').src);
        return game.scene.getScene('FactoryScene').motionPaused === reduced;
      }, reducedMotion === 'reduce');
      for (const paused of [false, true]) {
        const resident = await page.evaluate(async ({ paused, reduced }) => {
          const { game } = await import(document.querySelector('script[src*="/src/games/factory/main.ts"]').src);
          const { FactorySimulation } = await import('/src/games/factory/game/simulation.ts');
          const { project, WALK_TICKS } = await import('/src/games/factory/game/domain.ts');
          game.loop.stop();
          const scene = game.scene.getScene('FactoryScene');
          scene.startScenario(FactorySimulation.forScenario('settlement'));
          scene.simulation.step();
          scene.simulation.advance(90);
          scene.paused = paused;
          scene.hud.setPaused(paused);
          scene.refreshSimulationHud();
          game.step(20000, 0);
          const resident = scene.simulation.residents.find(value => value.id === 1);
          if (!resident?.job?.path.length) throw new Error('Resident picking fixture must be moving');
          const next = resident.job.path[0];
          const fraction = (resident.travel + (paused || reduced ? 0 : scene.simulation.interpolation)) / WALK_TICKS;
          const drawn = project(resident.tile.c + (next.c - resident.tile.c) * fraction,
            resident.tile.r + (next.r - resident.tile.r) * fraction);
          const camera = scene.cameras.main;
          camera.preRender();
          const screen = camera.matrix.transformPoint(drawn.x - camera.scrollX, drawn.y - 14 - camera.scrollY);
          const rect = game.canvas.getBoundingClientRect();
          const point = {
            x: rect.left + screen.x * rect.width / game.canvas.width,
            y: rect.top + screen.y * rect.height / game.canvas.height,
          };
          if (document.elementFromPoint(point.x, point.y) !== game.canvas) throw new Error('Resident fixture is covered by UI');
          return { id: resident.id, point, interpolation: scene.simulation.interpolation };
        }, { paused, reduced: reducedMotion === 'reduce' });
        if (!paused) assert.equal(resident.interpolation, 0.9, 'Picking must exercise a fractional moving position');
        await tap(resident.point);
        const selected = await page.evaluate(async () => {
          const { game } = await import(document.querySelector('script[src*="/src/games/factory/main.ts"]').src);
          return game.scene.getScene('FactoryScene').selectedResident;
        });
        assert.equal(selected, resident.id, `Visible resident must be selectable (${reducedMotion}, paused=${paused})`);
      }
    }
    assert.deepEqual(errors, []);
    console.log('Native factory interaction passed:', touch ? 'touch/pinch' : 'desktop/zoom', 'placement, picking, route, undo, save, reload and resident motion policies');
    await context.close();
  }
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    await page.waitForFunction(() => !document.querySelector('[data-scenario="free-play"]')?.disabled);
    const before = await page.evaluate(async () => {
      const { game } = await import(document.querySelector('script[src*="/src/games/factory/main.ts"]').src);
      const { project } = await import('/src/games/factory/game/domain.ts');
      game.loop.stop();
      const scene = game.scene.getScene('FactoryScene');
      scene.paused = true;
      scene.zoomAt(0.01, { x: 640, y: 400 });
      const center = project(128, 128);
      scene.cameras.main.centerOn(center.x, center.y);
      game.step(20000, 0);
      return { center, zoom: scene.zoom, save: scene.simulation.serialize() };
    });
    assert.equal(before.zoom, 0.4);
    for (const viewport of [{ width: 3840, height: 2160 }, { width: 1280, height: 800 }]) {
      await page.setViewportSize(viewport);
      await page.waitForFunction(async ({ width, height }) => {
        const { game } = await import(document.querySelector('script[src*="/src/games/factory/main.ts"]').src);
        const camera = game.scene.getScene('FactoryScene').cameras.main;
        return camera.width === width && camera.height === height;
      }, viewport);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
      const after = await page.evaluate(async () => {
        const { game } = await import(document.querySelector('script[src*="/src/games/factory/main.ts"]').src);
        const scene = game.scene.getScene('FactoryScene');
        game.step(20001, 0);
        const view = scene.view();
        return {
          center: { x: view.x + view.width / 2, y: view.y + view.height / 2 },
          zoom: scene.zoom, minimum: scene.minimumZoom(), chunks: scene.terrain.stats.chunks,
          label: document.querySelector('#factory-zoom').textContent, save: scene.simulation.serialize(),
        };
      });
      assert.equal(after.zoom, 0.8, 'Resize must raise unsafe zoom, then preserve it when shrinking');
      assert.ok(after.zoom >= after.minimum);
      assert.ok(after.chunks <= 24, 'Resizing must respect the terrain residency budget');
      assert.deepEqual(after.center, before.center, 'Resizing must preserve the viewed world center');
      assert.equal(after.label, '80%');
      assert.deepEqual(after.save, before.save, 'Resizing must not change the factory');
    }
    assert.deepEqual(errors, []);
    console.log('Factory resize regression passed: zoom limits, center, HUD, chunk budget and unchanged simulation');
    await context.close();
  }
  for (const preview of [false, true]) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto(preview ? new URL('../../src/games/factory/assets/preview.html', url).href : url);
    if (!preview) {
      await page.waitForFunction(() => !document.querySelector('[data-scenario="settlement"]')?.disabled);
      await page.locator('[data-scenario="settlement"]').click();
      await page.waitForFunction(() => !document.querySelector('.factory-scenario-dialog').open);
      await page.getByRole('button', { name: 'Pause factory', exact: true }).click();
    }
    await page.locator('canvas').waitFor();
    const proof = await page.evaluate(async preview => {
      const source = document.querySelector(`script[src*="${preview ? 'preview.ts' : '/src/games/factory/main.ts'}"]`).src;
      const { game } = await import(source);
      const loaded = path => performance.getEntriesByType('resource').find(entry => new URL(entry.name).pathname === path)?.name ?? path;
      const { PALETTE } = await import(loaded('/src/games/factory/assets/art.ts'));
      const { BUILDING_SHAPES, pickBuilding } = await import(loaded('/src/games/factory/assets/picking.ts'));
      const { project } = await import('/src/games/factory/game/domain.ts');
      game.loop.stop();
      const scene = preview ? game.scene.scenes[0] : game.scene.getScene('FactoryScene');
      let building;
      if (!preview) {
        for (let c = 8; c < 20 && !building; c++) for (let r = 8; r < 20 && !building; r++) {
          if (!scene.simulation.placementError({ c, r }, 'furnace')) {
            building = { c, r, kind: 'furnace', direction: 0 };
            scene.simulation.place(building);
          }
        }
        if (!building) throw new Error('No furnace fixture location');
        const origin = project(building.c, building.r);
        scene.cameras.main.centerOn(origin.x, origin.y - 15);
      }
      const originalRoof = PALETTE.roof;
      const originalShape = BUILDING_SHAPES.furnace;
      const snapshot = preview ? null : JSON.stringify(scene.simulation.serialize());
      const redraw = async () => {
        if (!preview) scene.redrawMachines();
        game.step(10000, 16.666);
        const pixels = game.canvas.getContext('2d').getImageData(0, 0, game.canvas.width, game.canvas.height).data;
        const digest = await crypto.subtle.digest('SHA-256', pixels);
        return Array.from(new Uint8Array(digest)).join(',');
      };
      const before = await redraw();
      let after;
      let picks = true;
      try {
        PALETTE.roof = 0xff00ff;
        BUILDING_SHAPES.furnace = {
          bounds: { left: -80, right: 80, top: -80, bottom: 80 },
          selection: [[{ x: -80, y: -80 }, { x: 80, y: -80 }, { x: 80, y: 80 }, { x: -80, y: 80 }]],
        };
        after = await redraw();
        if (!preview) {
          const origin = project(building.c, building.r);
          picks = pickBuilding({ x: origin.x + 70, y: origin.y }, new Map([['fixture', building]])) === building;
          if (JSON.stringify(scene.simulation.serialize()) !== snapshot) throw new Error('Art edit changed simulation save');
        }
      } finally {
        PALETTE.roof = originalRoof;
        BUILDING_SHAPES.furnace = originalShape;
      }
      const restored = await redraw();
      return { before, after, restored, picks };
    }, preview);
    assert.notEqual(proof.after, proof.before, 'Asset-only roof/outline edits must visibly change the shared drawing');
    assert.equal(proof.restored, proof.before, 'Restoring assets must restore exact canvas pixels');
    assert.equal(proof.picks, true);
    console.log('Asset-only redesign proof passed:', preview ? 'preview' : 'live game', 'drawing, outline and unchanged simulation');
    await context.close();
  }
} finally {
  await browser.close();
}
