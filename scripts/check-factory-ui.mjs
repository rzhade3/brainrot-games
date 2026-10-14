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
/** Discovers every building, for checks that exercise machines rather than discovery. */
async function unlockAll(page) {
  await page.evaluate(async () => {
    const { game } = await import(document.querySelector('script[src*="/src/games/factory/main.ts"]').src);
    const { CATALOG } = await import('/src/games/factory/game/domain.ts');
    const { FactorySimulation } = await import('/src/games/factory/game/simulation.ts');
    const scene = game.scene.getScene('FactoryScene');
    const save = scene.simulation.serialize();
    save.discovered = CATALOG.map(entry => entry.kind);
    scene.startSettlement(FactorySimulation.restore(save));
  });
}
async function storedSave(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('brainrot-pocket-factory', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction('worlds', 'readonly');
      const read = transaction.objectStore('worlds').get('active');
      transaction.oncomplete = () => { db.close(); resolve(read.result); };
      transaction.onabort = () => { db.close(); reject(transaction.error); };
    };
  }));
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
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }, { width: 320, height: 568 }]) {
    const touch = viewport.width < 700;
    const context = await browser.newContext({ viewport, isMobile: touch, hasTouch: touch, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    await page.locator('[data-command="new-settlement"]:not(:disabled)').waitFor();
    await page.locator('[data-command="new-settlement"]').click();
    await page.waitForFunction(() => !document.querySelector('.factory-settlement-dialog').open);
    await page.getByRole('button', { name: 'Pause factory', exact: true }).click();
    const resourceBefore = await gameState(page);
    assert.equal(await page.getByRole('button', { name: 'People', exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Resources', exact: true }).click();
    assert.equal(await page.locator('.factory-resources-dialog').evaluate(dialog => dialog.open), true);
    assert.equal(await page.locator('.factory-resources-dialog [data-resource]').count(), 2,
      'A new settlement lists only food and wood');
    assert.match(await page.locator('[data-resource="food-unit"]').innerText(), /Food units · 8/);
    assert.match(await page.locator('[data-resource="wood"]').innerText(), /Wood · 0/);
    assert.match(await page.locator('[data-resource="food-unit"]').innerText(), /Measuring/);
    assert.match(await page.locator('#factory-resources-summary').innerText(), /Measuring flow/);
    await page.locator('[data-resource="food-unit"]').click();
    assert.equal(await page.locator('#factory-resources-title').innerText(), 'Food units');
    assert.match(await page.locator('#factory-resource-stock').innerText(), /Buildings: 8.*In transit: 0.*Recovery: 0.*1 producer · 1 consumer/);
    assert.match(await page.locator('[data-location="14,12"]').innerText(), /Kitchen stocked/);
    assert.match(await page.locator('[data-location="14,12"]').innerText(), /Paused/);
    assert.match(await page.locator('[data-location="10,9"]').innerText(), /Produces/);
    await page.keyboard.press('9');
    await page.keyboard.press('r');
    await page.evaluate(async () => {
      const { game } = await import(document.querySelector('script[src*="/src/games/factory/main.ts"]').src);
      game.scene.getScene('FactoryScene').refreshSimulationHud();
    });
    assert.equal(await page.evaluate(() => document.activeElement.dataset.command), 'resource-back',
      'Live updates must preserve keyboard focus');
    const resourceBounds = await page.locator('.factory-resources-dialog').evaluate(dialog => {
      const rect = dialog.getBoundingClientRect();
      return {
        left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
        width: dialog.clientWidth, scrollWidth: dialog.scrollWidth,
        targets: [...dialog.querySelectorAll('button')].every(button => button.getBoundingClientRect().height >= 44),
      };
    });
    assert.ok(resourceBounds.left >= 0 && resourceBounds.right <= viewport.width &&
      resourceBounds.top >= 0 && resourceBounds.bottom <= viewport.height);
    assert.ok(resourceBounds.scrollWidth <= resourceBounds.width + 1);
    assert.ok(resourceBounds.targets);
    await page.locator('[data-command="resource-back"]').click();
    assert.equal(await page.evaluate(() => document.activeElement.dataset.resource), 'food-unit');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.factory-resources-dialog').evaluate(dialog => dialog.open), false);
    assert.equal(await page.evaluate(() => document.activeElement.dataset.command), 'resources');
    assert.deepEqual(await gameState(page), resourceBefore, 'Browsing resources must not change the settlement');
    await page.getByRole('button', { name: 'Resources', exact: true }).click();
    await page.locator('[data-resource="food-unit"]').click();
    await page.locator('[data-location="14,12"]').click();
    assert.equal(await page.locator('.factory-resources-dialog').evaluate(dialog => dialog.open), false);
    assert.equal(await page.locator('.factory-inspector h2').innerText(), 'Communal kitchen');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.action), 'close');
    await page.keyboard.press('Escape');
    await page.evaluate(async () => {
      const { game } = await import(document.querySelector('script[src*="/src/games/factory/main.ts"]').src);
      const scene = game.scene.getScene('FactoryScene');
      for (let tick = 0; tick < 700; tick++) scene.simulation.step();
      scene.refreshSimulationHud();
    });
    await page.getByRole('button', { name: 'Resources', exact: true }).click();
    assert.match(await page.locator('[data-resource="food-unit"]').innerText(), /Made [\d.]+\/min · Used [\d.]+\/min/);
    assert.equal(await page.locator('[data-resource="iron-ore"]').count(), 0, 'Ore stays hidden until mining is discovered');
    assert.match(await page.locator('#factory-resources-summary').innerText(), /keeping up|Needs attention/);
    await page.locator('[data-resource="food-unit"]').click();
    assert.match(await page.locator('#factory-resource-flow').innerText(), /Made .*Used .*Residents need 24\/min/);
    await page.keyboard.press('Escape');
    console.log('Resources overview passed:', `${viewport.width}x${viewport.height}`,
      'inventory, measured flow, verdicts, locations, navigation, keyboard focus and unchanged simulation');
    await page.getByRole('button', { name: 'Build', exact: true }).click();
    const catalog = await page.locator('#factory-category-all').evaluate(grid => ({
      cards: [...grid.querySelectorAll('[data-action]:not([hidden])')].map(card => card.dataset.action),
      locked: [...grid.querySelectorAll('[data-locked]:not([hidden])')].map(card => [card.dataset.locked, card.innerText, card.disabled]),
      logistics: document.querySelector('#factory-tab-logistics').hidden,
    }));
    assert.deepEqual(catalog.cards, ['food-plot', 'woodcutting-site', 'kitchen', 'house', 'storage']);
    assert.equal(catalog.locked.length, 1, 'Only the next discovery is shown');
    assert.equal(catalog.locked[0][0], 'mining-site');
    assert.match(catalog.locked[0][1], /Mining site\s+Finish a house · 0\/1/);
    assert.equal(catalog.locked[0][2], true);
    assert.equal(catalog.logistics, true, 'Empty categories are hidden');
    await page.keyboard.press('2');
    assert.equal(await page.locator('#factory-catalog').isHidden(), false, 'Locked shortcuts do nothing');
    await page.getByRole('button', { name: 'Woodcutting site', exact: true }).first().click();
    const site = await page.evaluate(async () => {
      const { game } = await import(document.querySelector('script[src*="/src/games/factory/main.ts"]').src);
      const { project } = await import('/src/games/factory/game/domain.ts');
      const scene = game.scene.getScene('FactoryScene');
      const candidates = [];
      for (let c = 2; c < 32; c++) for (let r = 2; r < 32; r++) {
        if (!scene.simulation.placementError({ c, r }, 'woodcutting-site')) candidates.push({ c, r });
      }
      candidates.sort((a, b) => Math.abs(a.c - 12) + Math.abs(a.r - 12) -
        Math.abs(b.c - 12) - Math.abs(b.r - 12) || a.c - b.c || a.r - b.r);
      if (!candidates.length) throw new Error('No reachable grove fixture');
      const tile = candidates[0];
      const origin = project(tile.c, tile.r);
      scene.cameras.main.centerOn(origin.x, origin.y - 30);
      game.step(30000, 0);
      return tile;
    });
    const tap = point => touch ? page.touchscreen.tap(point.x, point.y) : page.mouse.click(point.x, point.y);
    await tap(await coordinates(page, 'inspect', site));
    assert.ok((await gameState(page)).machines.some(machine => machine.building.kind === 'woodcutting-site'));
    await page.keyboard.press('Escape');
    await tap(await coordinates(page, 'inspect', site));
    assert.equal(await page.locator('[data-command="choose-worker"]').count(), 0);
    assert.equal(await page.locator('[data-priority="normal"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('.factory-labor-card small').innerText(),
      'One resident works here. Higher priority is staffed first; Off frees the worker.');
    assert.equal(await page.locator('[data-command="work-priority"]').count(), 4);
    assert.equal(await page.locator('#factory-machine-pace').innerText(), '2s');
    await page.locator('.factory-machine-help summary').click();
    assert.match(await page.locator('.factory-machine-help').innerText(), /Trees remain in place/);
    await page.locator('[data-priority="high"]').click();
    assert.equal(await page.locator('[data-priority="high"]').getAttribute('aria-pressed'), 'true');
    assert.equal((await gameState(page)).machines.find(machine => machine.building.kind === 'woodcutting-site').building.workPriority, 'high');
    const priorityBounds = await page.locator('.factory-work-priorities').evaluate(element => ({
      width: element.clientWidth, scroll: element.scrollWidth,
      targets: [...element.querySelectorAll('button')].map(button => button.getBoundingClientRect().height),
    }));
    assert.ok(priorityBounds.scroll <= priorityBounds.width && priorityBounds.targets.every(height => height >= 44));
    assert.match(await page.locator('#factory-machine-state').innerText(), /Paused/);
    const carrying = await page.evaluate(async () => {
      const { game } = await import(document.querySelector('script[src*="/src/games/factory/main.ts"]').src);
      const scene = game.scene.getScene('FactoryScene');
      for (let i = 0; i < 2000 && !scene.simulation.residents.some(resident => resident.cargo === 'wood'); i++) scene.simulation.step();
      if (!scene.simulation.residents.some(resident => resident.cargo === 'wood')) throw new Error('Automatic gathering did not start');
      scene.refreshSimulationHud();
      scene.session.changed(false);
      await scene.session.save();
      return scene.simulation.serialize();
    });
    const carrier = carrying.settlement.residents.find(resident => resident.cargo === 'wood');
    assert.equal(carrier.job.kind, 'return-wood');
    assert.match(await page.locator('#factory-staffing').innerText(), /^Worker: /);
    await page.locator('[data-priority="low"]').click();
    const reprioritized = await gameState(page);
    assert.deepEqual(reprioritized.settlement, carrying.settlement, 'Priority controls must not cancel work or reset cargo');
    await page.locator('[data-priority="high"]').click();
    await page.evaluate(async () => {
      const { game } = await import(document.querySelector('script[src*="/src/games/factory/main.ts"]').src);
      await game.scene.getScene('FactoryScene').session.save();
    });
    assert.deepEqual((await storedSave(page)).simulation, carrying);
    await page.reload();
    await page.locator('[data-command="resume-save"]').click();
    await page.getByRole('button', { name: 'Resume factory', exact: true }).waitFor();
    assert.deepEqual(await gameState(page), carrying, 'Priority and cargo resume exactly during a return trip');
    await page.evaluate(async site => {
      const { game } = await import(document.querySelector('script[src*="/src/games/factory/main.ts"]').src);
      const { project } = await import('/src/games/factory/game/domain.ts');
      const scene = game.scene.getScene('FactoryScene');
      const origin = project(site.c, site.r);
      scene.cameras.main.centerOn(origin.x, origin.y - 30);
      game.step(30001, 0);
    }, site);
    await tap(await coordinates(page, 'inspect', site));
    assert.equal(await page.locator('[data-priority="high"]').getAttribute('aria-pressed'), 'true');
    if (process.env.FACTORY_SCREENSHOT_DIR) await page.screenshot({
      path: `${process.env.FACTORY_SCREENSHOT_DIR}/automatic-labor-${viewport.width}.png`,
    });
    await page.getByRole('button', { name: 'Resources', exact: true }).click();
    await page.locator('[data-resource="wood"]').click();
    assert.match(await page.locator('#factory-resource-stock').innerText(), /In transit: 1/);
    await page.locator(`[data-location="resident:${carrier.id}"]`).click();
    assert.match(await page.locator('#factory-resident-destination').innerText(), /^Woodcutting site/);
    assert.equal(await page.locator('#factory-resident-cargo').innerText(), '1 wood');
    assert.equal(await page.locator('[data-action="unassign-worker"]').count(), 0);
    assert.deepEqual(errors, []);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
    console.log('Native wood gathering interaction passed:', `${viewport.width}x${viewport.height}`,
      'catalog, placement, automatic staffing, priority controls, uninterrupted cargo, exact resume and resource carrier inspection');
    await context.close();
  }
  for (const viewport of [{ width: 1280, height: 800 }, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
    const touch = viewport.width < 700 || viewport.height < 560;
    const context = await browser.newContext({ viewport, isMobile: touch, hasTouch: touch, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    await page.locator('[data-command="new-settlement"]:not(:disabled)').click();
    await page.waitForFunction(() => !document.querySelector('.factory-settlement-dialog').open);
    await page.getByRole('button', { name: 'Pause factory', exact: true }).click();
    await page.getByRole('button', { name: 'Build', exact: true }).click();
    assert.match(await page.getByRole('button', { name: 'House', exact: true }).first().innerText(), /Construction: 8 wood/);
    await page.getByRole('button', { name: 'House', exact: true }).first().click();
    await page.evaluate(async () => {
      const { game } = await import(document.querySelector('script[src*="/src/games/factory/main.ts"]').src);
      const { project } = await import('/src/games/factory/game/domain.ts');
      const scene = game.scene.getScene('FactoryScene');
      const point = project(16, 12);
      scene.cameras.main.centerOn(point.x, point.y - 30);
      game.step(10000, 0);
    });
    const point = await coordinates(page, 'inspect', { c: 16, r: 12 });
    if (touch) await page.touchscreen.tap(point.x, point.y);
    else await page.mouse.click(point.x, point.y);
    await page.keyboard.press('Escape');
    const setup = await page.evaluate(async () => {
      const { game } = await import(document.querySelector('script[src*="/src/games/factory/main.ts"]').src);
      const scene = game.scene.getScene('FactoryScene');
      const simulation = scene.simulation;
      if (simulation.getState({ c: 16, r: 12 })?.building.kind !== 'house') throw new Error('House placement failed');
      for (const [kind, c, r] of [['kitchen', 16, 10], ['food-plot', 13, 10], ['food-plot', 15, 10]]) {
        const error = simulation.place({ kind, c, r, direction: 0 });
        if (error) throw new Error(error);
      }
      const error = simulation.setHaulTarget({ c: 15, r: 10 }, { c: 16, r: 10 });
      if (error) throw new Error(error);
      const sites = [];
      for (let c = 2; c < 32; c++) for (let r = 2; r < 32; r++) {
        if (!simulation.placementError({ c, r }, 'woodcutting-site')) sites.push({ c, r });
      }
      sites.sort((a, b) => Math.abs(a.c - 16) + Math.abs(a.r - 12) - Math.abs(b.c - 16) - Math.abs(b.r - 12) || a.c - b.c || a.r - b.r);
      const site = sites[0];
      if (!site) throw new Error('No accessible grove');
      const placement = simulation.place({ ...site, kind: 'woodcutting-site', direction: 0 });
      if (placement) throw new Error(placement);
      scene.redrawMachines();
      scene.hud.onBuilding({ c: 16, r: 12 });
      return { site };
    });
    assert.match(await page.locator('#factory-machine-input').innerText(), /0\/8 wood delivered/);
    assert.equal(await page.locator('[data-command="invite-resident"]').isDisabled(), true);
    assert.match(await page.locator('#factory-house-reason').innerText(), /Waiting for wood/);
    await page.evaluate(async site => {
      const { game } = await import(document.querySelector('script[src*="/src/games/factory/main.ts"]').src);
      game.scene.getScene('FactoryScene').hud.onBuilding(site);
    }, setup.site);
    await page.locator('[data-command="choose-delivery"]').click();
    await page.locator('[data-delivery-target="16,12"]').click();
    await page.locator('[data-command="confirm-delivery"]').click();
    const readyAt = await page.evaluate(async () => {
      const { game } = await import(document.querySelector('script[src*="/src/games/factory/main.ts"]').src);
      const scene = game.scene.getScene('FactoryScene');
      game.loop.stop();
      for (let tick = 0; tick < 4000; tick++) {
        scene.simulation.step();
        if (!scene.simulation.inspectMachine({ c: 16, r: 12 }).housing.reason) break;
      }
      scene.refreshSimulationHud();
      const announced = document.querySelector('#factory-status').textContent;
      const mining = document.querySelector('#factory-category-all [data-action="mining-site"]').hidden;
      scene.hud.onBuilding({ c: 16, r: 12 });
      game.step(10001, 0);
      return { ticks: scene.simulation.ticks, announced, mining };
    });
    assert.equal(readyAt.announced, 'Mining site discovered. Find it in Build.');
    assert.equal(readyAt.mining, false, 'The first finished house reveals the mining site');
    assert.ok(readyAt.ticks <= 1200, 'Four founders should be able to prepare the first arrival without material grants');
    assert.match(await page.locator('#factory-machine-input').innerText(), /8\/8 wood.*Installed/);
    assert.equal(await page.locator('[data-command="invite-resident"]').isDisabled(), false);
    assert.match(await page.locator('#factory-house-demand').innerText(), /5 residents.*5 food units \/ 10s/);
    assert.equal(await page.evaluate(async () => {
      const { game } = await import(document.querySelector('script[src*="/src/games/factory/main.ts"]').src);
      return game.scene.getScene('FactoryScene').machineArt.get('16,12').getData('completed');
    }), true, 'House completion refreshes its cached artwork');
    await page.locator('[data-command="invite-resident"]').click();
    assert.equal((await gameState(page)).settlement.residents.length, 5);
    assert.equal(await page.locator('[data-command="invite-resident"]').isDisabled(), true);
    assert.equal(await page.locator('[data-action="remove"]').isDisabled(), true);
    assert.equal(await page.locator('.factory-resident-list [data-resident="4"]').count(), 1);
    await page.locator('[data-resident="4"]').click();
    assert.equal(await page.locator('.factory-inspector h2').innerText(), 'Ada 2');
    await page.getByRole('button', { name: 'Resources', exact: true }).click();
    await page.locator('[data-resource="wood"]').click();
    assert.match(await page.locator('[data-location="16,12"]').innerText(), /Installed.*Not available for delivery/);
    await page.locator('[data-location="16,12"]').click();
    await page.evaluate(async () => {
      const { game } = await import(document.querySelector('script[src*="/src/games/factory/main.ts"]').src);
      game.scene.getScene('FactoryScene').act('remove');
    });
    assert.equal((await gameState(page)).settlement.residents.length, 5);
    assert.match(await page.locator('#factory-status').innerText(), /occupied/);
    await page.evaluate(async () => {
      const { game } = await import(document.querySelector('script[src*="/src/games/factory/main.ts"]').src);
      const scene = game.scene.getScene('FactoryScene');
      scene.hud.onBuilding({ c: 14, r: 12 });
      await scene.session.save();
    });
    assert.match(await page.locator('#factory-machine-pace').innerText(), /5 residents.*5 food units \/ 10s/);
    const saved = await gameState(page);
    await page.reload();
    await page.locator('[data-command="resume-save"]').click();
    await page.getByRole('button', { name: 'Resume factory', exact: true }).waitFor();
    assert.deepEqual(await gameState(page), saved, 'The expanded household and installed materials resume exactly');
    assert.deepEqual(errors, []);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    console.log('Native housing progression passed:', `${viewport.width}x${viewport.height}`,
      'placement, wood routing, real readiness, cached art, invitation, Resources, protected home, scaled kitchen and exact resume');
    await context.close();
  }
  {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    await page.locator('[data-command="new-settlement"]:not(:disabled)').click();
    await page.waitForFunction(() => !document.querySelector('.factory-settlement-dialog').open);
    await page.getByRole('button', { name: 'Resources', exact: true }).click();
    await page.locator('[data-resource="food-unit"]').click();
    await page.waitForFunction(async () => {
      const { game } = await import(document.querySelector('script[src*="/src/games/factory/main.ts"]').src);
      const resource = game.scene.getScene('FactoryScene').simulation.inspectResources()
        .find(resource => resource.item === 'food-unit');
      return resource.total !== 8 && document.querySelector('#factory-resource-stock').textContent.startsWith(`Total: ${resource.total} ·`);
    });
    assert.equal(await page.evaluate(() => document.activeElement.dataset.command), 'resource-back');
    const bounds = await page.locator('.factory-resources-dialog').evaluate(dialog => {
      const rect = dialog.getBoundingClientRect();
      const body = dialog.querySelector('.factory-picker-body');
      const results = dialog.querySelector('.factory-picker-results');
      return rect.top >= 0 && rect.bottom <= innerHeight && dialog.scrollWidth <= dialog.clientWidth + 1 &&
        body.clientHeight > 0 && (body.scrollHeight > body.clientHeight || results.scrollHeight > results.clientHeight);
    });
    assert.ok(bounds, 'Landscape Resources must fit the viewport with scrollable contents');
    await page.getByRole('button', { name: 'Close resources', exact: true }).click();
    assert.deepEqual(errors, []);
    await context.close();
    console.log('Live Resources passed: landscape touch, changing stock, stable focus and scrollable bounds');
  }
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto(url);
    await page.locator('[data-command="new-settlement"]:not(:disabled)').click();
    await page.waitForFunction(() => !document.querySelector('.factory-settlement-dialog').open);
    const result = await page.evaluate(async () => {
      const { game } = await import(document.querySelector('script[src*="/src/games/factory/main.ts"]').src);
      const { FactorySimulation } = await import('/src/games/factory/game/simulation.ts');
      const { CATALOG, STEP_MS } = await import('/src/games/factory/game/domain.ts');
      const { ASSEMBLER_RECIPE } = await import('/src/games/factory/game/machines.ts');
      game.loop.stop();
      const hud = game.scene.getScene('FactoryScene').hud;
      const save = FactorySimulation.create().serialize();
      save.discovered = CATALOG.map(entry => entry.kind);
      const sim = FactorySimulation.restore(save);
      for (const { kind } of CATALOG) {
        if ([...sim.buildings.values()].some(building => building.kind === kind)) continue;
        const tiles = [];
        for (let c = 0; c < 32; c++) for (let r = 0; r < 32; r++) {
          if (!sim.placementError({ c, r }, kind)) tiles.push({ c, r });
        }
        const tile = tiles[0];
        if (!tile) throw new Error(`No inspector fixture for ${kind}`);
        const error = sim.place({ ...tile, kind, direction: 0 });
        if (error) throw new Error(error);
      }
      hud.setBuildings(sim.buildings);
      hud.setSummary(sim.summary());
      const before = sim.serialize();
      const rows = [];
      const visible = id => getComputedStyle(document.getElementById(id)).display !== 'none';
      for (const building of sim.buildings.values()) {
        const inspection = sim.inspectMachine(building);
        hud.inspect(building);
        hud.setMachine(inspection, false);
        rows.push({
          kind: building.kind,
          output: visible('factory-machine-output-row'),
          expectedOutput: inspection.outputCapacity > 0,
          recipe: visible('factory-machine-recipe-row'),
          expectedRecipe: inspection.recipe !== null,
          status: document.getElementById('factory-machine-state')?.textContent ?? null,
          expectedStatus: building.kind === 'home' ? null : inspection.status,
          progress: document.getElementById('factory-progress-label')?.textContent ?? null,
          expectedProgress: building.kind === 'home' ? null
            : building.kind === 'house' ? 'Construction' : ['storage', 'kitchen'].includes(building.kind) ? 'Capacity used' : 'Progress',
          progressName: document.querySelector('.factory-progress')?.getAttribute('aria-label') ?? null,
          cycle: document.getElementById('factory-machine-pace')?.textContent ?? null,
          expectedCycle: building.kind === 'home' || building.kind === 'house' ? null
            : building.kind === 'kitchen' ? `${inspection.population} residents · ${inspection.population} food units / ${inspection.cycleTicks * STEP_MS / 1000}s`
              : `${inspection.cycleTicks * STEP_MS / 1000}s`,
          work: document.getElementById('factory-home-work')?.textContent ?? null,
          expectedWork: inspection.labor && `${inspection.labor.posted} at sites · ${inspection.labor.hauling} carrying · ${inspection.labor.free} free` +
            (inspection.labor.openPosts ? ` · ${inspection.labor.openPosts} unstaffed` : ''),
        });
      }
      const plot = [...sim.buildings.values()].find(building => building.kind === 'food-plot');
      const inspection = sim.inspectMachine(plot);
      hud.inspect(plot);
      hud.setMachine(inspection, false);
      const outputRow = document.getElementById('factory-machine-output-row');
      hud.setMachine({ ...inspection, outputCapacity: 0, recipe: ASSEMBLER_RECIPE }, false);
      const overridden = {
        output: visible('factory-machine-output-row'), recipe: visible('factory-machine-recipe-row'),
        recipeText: document.getElementById('factory-machine-recipe').textContent,
      };
      hud.setMachine(inspection, false);
      const restored = {
        output: visible('factory-machine-output-row'), recipe: visible('factory-machine-recipe-row'),
        recipeText: document.getElementById('factory-machine-recipe').textContent,
        sameNode: outputRow === document.getElementById('factory-machine-output-row'),
      };
      const raw = sim.serialize();
      const kitchen = raw.machines.find(machine => machine.building.kind === 'kitchen');
      raw.recovered['food-unit'] += kitchen.input['food-unit'];
      raw.settlement.kitchenRemoved += kitchen.input['food-unit'];
      kitchen.input['food-unit'] = 0;
      const hungry = FactorySimulation.restore(raw);
      const shortage = hungry.inspectMachine(kitchen.building);
      hud.inspect(kitchen.building);
      hud.setMachine(shortage, false);
      const status = document.getElementById('factory-machine-state');
      const empty = { text: status.textContent, expected: shortage.status,
        highlighted: status.classList.contains('factory-machine-blocked') };
      hud.setMachine(shortage, true);
      const paused = { text: status.textContent, highlighted: status.classList.contains('factory-machine-blocked') };
      hud.setMachine(sim.inspectMachine(kitchen.building), false);
      const stocked = { text: status.textContent, highlighted: status.classList.contains('factory-machine-blocked') };
      return { rows, overridden, restored, empty, paused, stocked, before, after: sim.serialize() };
    });
    for (const row of result.rows) {
      assert.equal(row.output, row.expectedOutput, `${row.kind} output visibility follows capacity`);
      assert.equal(row.recipe, row.expectedRecipe, `${row.kind} recipe visibility follows inspection`);
      assert.equal(row.status, row.expectedStatus, `${row.kind} activity follows simulation status`);
      assert.equal(row.progress, row.expectedProgress);
      assert.equal(row.progressName, row.expectedProgress, 'Visible and accessible progress labels agree');
      assert.equal(row.cycle, row.expectedCycle);
      assert.equal(row.work, row.expectedWork, `${row.kind} work summary follows the labor pool`);
    }
    assert.deepEqual(result.overridden, {
      output: false, recipe: true, recipeText: '2 iron plates + 1 copper plate → 1 defense supply',
    }, 'Live inspection capabilities override building-kind assumptions');
    assert.deepEqual(result.restored, { output: true, recipe: false, recipeText: '', sameNode: true });
    assert.equal(result.empty.text, result.empty.expected);
    assert.match(result.empty.text, /Food shortage/);
    assert.equal(result.empty.highlighted, true);
    assert.deepEqual(result.paused, { text: 'Paused', highlighted: true });
    assert.deepEqual(result.stocked, { text: 'Kitchen stocked', highlighted: false });
    assert.deepEqual(result.after, result.before, 'Inspector rendering does not change simulation state');
    console.log('Shared inspector presentation passed:', `${viewport.width}x${viewport.height}`,
      'all building kinds, generic progress/cycles, live capability-based fields, simulation status and pause/shortage');
    await context.close();
  }
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 },
    { width: 320, height: 568 }, { width: 844, height: 390 }]) {
    const touch = viewport.width < 700 || viewport.height < 560;
    const context = await browser.newContext({ viewport, isMobile: touch, hasTouch: touch, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    await page.locator('[data-command="new-settlement"]:not(:disabled)').click();
    await page.waitForFunction(() => !document.querySelector('.factory-settlement-dialog').open);
    await unlockAll(page);
    await page.getByRole('button', { name: 'Pause factory', exact: true }).click();
    await page.evaluate(async () => {
      const { game } = await import(document.querySelector('script[src*="/src/games/factory/main.ts"]').src);
      const { FactorySimulation } = await import('/src/games/factory/game/simulation.ts');
      const scene = game.scene.getScene('FactoryScene');
      for (const building of [
        { kind: 'furnace', c: 16, r: 16, direction: 0 }, { kind: 'assembler', c: 18, r: 16, direction: 0 },
        { kind: 'storage', c: 15, r: 10, direction: 0 },
      ]) {
        const error = scene.simulation.place(building);
        if (error) throw new Error(error);
      }
      let woodsite = null;
      for (let c = 2; c < 32 && !woodsite; c++) for (let r = 2; r < 32 && !woodsite; r++) {
        const tile = { c, r };
        if (!scene.simulation.placementError(tile, 'woodcutting-site')) {
          const error = scene.simulation.place({ ...tile, kind: 'woodcutting-site', direction: 0 });
          if (error) throw new Error(error);
          woodsite = tile;
        }
      }
      if (!woodsite) throw new Error('No woodcutting fixture site');
      for (let c = 20, added = 0; c < 40 && added < 30; c++) for (let r = 16; r < 40 && added < 30; r++) {
        if (!scene.simulation.placementError({ c, r }, 'storage')) {
          const error = scene.simulation.place({ kind: 'storage', c, r, direction: 0 });
          if (error) throw new Error(error);
          added++;
        }
      }
      const save = scene.simulation.serialize();
      save.machines.find(machine => machine.building.kind === 'kitchen').input['food-unit'] += 8;
      save.settlement.producedFood += 8;
      save.settlement.kitchenDelivered += 8;
      scene.simulation = FactorySimulation.restore(save);
      scene.selected = scene.simulation.buildings.get('10,9');
      scene.hud.inspect(scene.selected);
      scene.redrawMachines();
      scene.refreshSimulationHud();
      window.factoryDeliveryScene = scene;
    });
    assert.equal(await page.locator('#factory-haul-target').count(), 0);
    assert.match(await page.locator('#factory-delivery-name').innerText(), /Communal kitchen/);
    assert.match(await page.locator('#factory-delivery-state').innerText(), /Full/);
    await page.getByRole('button', { name: 'Resume factory', exact: true }).click();
    await page.locator('[data-command="choose-delivery"]').click();
    assert.equal(await page.evaluate(() => document.activeElement.id === 'factory-delivery-search'), !touch);
    assert.equal(await page.locator('[data-delivery-target="16,16"]').count(), 0);
    assert.equal(await page.locator('[data-delivery-target="18,16"]').count(), 0);
    assert.equal(await page.locator('[data-delivery-target="14,12"]').isDisabled(), false,
      'Full compatible destinations must stay selectable');
    assert.match(await page.locator('[data-delivery-target="14,12"]').innerText(), /Full/);
    assert.ok(await page.locator('[data-delivery-target]').count() >= 31);
    const scroll = await page.locator('.factory-delivery-dialog .factory-picker-results').evaluate(element => ({
      height: element.clientHeight, content: element.scrollHeight,
    }));
    assert.ok(scroll.height >= 72 && scroll.content > scroll.height, JSON.stringify({ viewport, scroll }));
    await page.keyboard.press('r');
    assert.equal((await gameState(page)).machines.find(machine => machine.building.kind === 'food-plot').building.direction, 0,
      'Picker keyboard input must not rotate the source');
    await page.locator('#factory-delivery-search').fill('15, 10');
    assert.equal(await page.locator('[data-delivery-target]:visible').count(), 1);
    await page.locator('[data-delivery-target="15,10"]').click();
    assert.match(await page.locator('#factory-delivery-preview').innerText(), /food unit.*Depot · 15, 10/);
    assert.deepEqual((await gameState(page)).machines.find(machine => machine.building.kind === 'food-plot').building.haulTo, { c: 14, r: 12 });
    await page.evaluate(() => {
      window.factoryDeliveryRows = [...document.querySelectorAll('[data-delivery-target]')];
      window.factoryDeliveryCommit = document.querySelector('[data-command="confirm-delivery"]');
      window.factoryDeliveryTick = window.factoryDeliveryScene.simulation.ticks;
    });
    await page.waitForFunction(() => window.factoryDeliveryScene.simulation.ticks >= window.factoryDeliveryTick + 12);
    assert.equal(await page.evaluate(() => window.factoryDeliveryRows.every((row, index) =>
      row === document.querySelectorAll('[data-delivery-target]')[index]) &&
      window.factoryDeliveryCommit === document.querySelector('[data-command="confirm-delivery"]')), true);
    assert.equal(await page.locator('[data-delivery-target="15,10"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#factory-delivery-search').inputValue(), '15, 10');
    await page.evaluate(() => {
      window.factoryDeliveryCallback = window.factoryDeliveryScene.hud.onHaulTarget;
      window.factoryDeliveryScene.hud.onHaulTarget = () => 'Destination changed. Choose another destination.';
    });
    await page.locator('[data-command="confirm-delivery"]').click();
    assert.equal(await page.locator('.factory-delivery-dialog').evaluate(dialog => dialog.open), true);
    assert.match(await page.locator('#factory-delivery-error').innerText(), /Destination changed/);
    await page.evaluate(() => { window.factoryDeliveryScene.hud.onHaulTarget = window.factoryDeliveryCallback; });
    await page.locator('#factory-delivery-search').fill('nothing matches');
    assert.equal(await page.locator('.factory-delivery-dialog .factory-picker-empty').isVisible(), true);
    assert.equal(await page.locator('[data-command="confirm-delivery"]').isDisabled(), false, 'Search must preserve a draft destination');
    const bounds = await page.locator('.factory-delivery-dialog').evaluate(dialog => {
      const rect = dialog.getBoundingClientRect();
      const footer = dialog.querySelector('.factory-picker-footer').getBoundingClientRect();
      return {
        x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, footerBottom: footer.bottom,
        width: dialog.clientWidth, scrollWidth: dialog.scrollWidth,
        targets: [...dialog.querySelectorAll('.factory-picker-header button, .factory-picker-footer button')]
          .map(button => button.getBoundingClientRect().height),
      };
    });
    assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.right <= viewport.width && bounds.bottom <= viewport.height &&
      bounds.footerBottom <= bounds.bottom && bounds.scrollWidth <= bounds.width, JSON.stringify({ viewport, bounds }));
    assert.ok(bounds.targets.every(height => height >= 44));
    if (viewport.width < 700) {
      await page.evaluate(() => {
        const root = document.querySelector('.factory-ui');
        root.classList.add('factory-picker-compact');
        root.style.setProperty('--factory-picker-viewport', '260px');
        root.style.setProperty('--factory-keyboard-inset', `${innerHeight - 260}px`);
      });
      assert.ok(await page.locator('.factory-delivery-dialog').evaluate(dialog => {
        const body = dialog.querySelector('.factory-picker-body');
        body.scrollTop = body.scrollHeight;
        return dialog.querySelector('.factory-picker-footer').getBoundingClientRect().bottom <= 260 &&
          body.clientHeight >= 44 && body.scrollTop > 0;
      }), 'Software keyboard must not cover delivery controls or prevent scrolling');
      await page.evaluate(() => {
        const root = document.querySelector('.factory-ui');
        root.classList.remove('factory-picker-compact');
        root.style.setProperty('--factory-picker-viewport', `${innerHeight}px`);
        root.style.setProperty('--factory-keyboard-inset', '0px');
      });
    }
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('[data-command="choose-delivery"]').evaluate(button => button === document.activeElement), true);
    assert.deepEqual((await gameState(page)).machines.find(machine => machine.building.kind === 'food-plot').building.haulTo, { c: 14, r: 12 });
    await page.locator('[data-command="choose-delivery"]').click();
    assert.equal(await page.locator('#factory-delivery-search').inputValue(), '');
    assert.equal(await page.locator('[data-command="confirm-delivery"]').isDisabled(), true);
    await page.locator('#factory-delivery-search').fill('15,10');
    await page.locator('[data-delivery-target="15,10"]').click();
    await page.locator('[data-command="confirm-delivery"]').click();
    await page.getByRole('button', { name: 'Pause factory', exact: true }).click();
    assert.match(await page.locator('#factory-delivery-name').innerText(), /Depot · 15, 10/);
    const saved = await gameState(page);
    assert.deepEqual(saved.machines.find(machine => machine.building.kind === 'food-plot').building.haulTo, { c: 15, r: 10 });
    await page.evaluate(() => window.factoryDeliveryScene.session.save());
    assert.deepEqual((await storedSave(page)).simulation, saved);
    await page.reload();
    await page.locator('[data-command="resume-save"]').click();
    await page.getByRole('button', { name: 'Resume factory', exact: true }).waitFor();
    assert.deepEqual(await gameState(page), saved);
    await page.evaluate(async () => {
      const { game } = await import(document.querySelector('script[src*="/src/games/factory/main.ts"]').src);
      const scene = game.scene.getScene('FactoryScene');
      scene.selected = scene.simulation.buildings.get('10,9');
      scene.hud.inspect(scene.selected);
      scene.refreshSimulationHud();
      window.factoryDeliveryScene = scene;
    });
    await page.locator('[data-command="clear-delivery"]').click();
    assert.equal(Object.hasOwn((await gameState(page)).machines.find(machine => machine.building.kind === 'food-plot').building, 'haulTo'), false);
    assert.equal(await page.locator('#factory-delivery-name').innerText(), 'No destination chosen');
    await page.evaluate(() => {
      const scene = window.factoryDeliveryScene;
      scene.selected = [...scene.simulation.buildings.values()].find(building => building.kind === 'woodcutting-site');
      scene.hud.inspect(scene.selected);
      scene.refreshSimulationHud();
    });
    await page.locator('[data-command="choose-delivery"]').click();
    assert.equal(await page.locator('[data-delivery-target="14,12"]').count(), 0, 'Wood must never offer the kitchen');
    assert.ok((await page.locator('[data-delivery-target] strong').allTextContents()).every(label => label.startsWith('Depot')));
    await page.locator('.factory-delivery-dialog .factory-picker-footer [data-command="close-delivery-picker"]').click();
    await page.evaluate(async () => {
      const { FactorySimulation } = await import('/src/games/factory/game/simulation.ts');
      const scene = window.factoryDeliveryScene;
      for (const building of [...scene.simulation.buildings.values()]) if (building.kind === 'storage') scene.simulation.remove(building);
      const save = scene.simulation.serialize();
      save.machines.find(machine => machine.building.kind === 'woodcutting-site').building.haulTo = { c: 14, r: 12 };
      scene.simulation = FactorySimulation.restore(save);
      scene.selected = [...scene.simulation.buildings.values()].find(building => building.kind === 'woodcutting-site');
      scene.hud.inspect(scene.selected);
      scene.redrawMachines();
      scene.refreshSimulationHud();
    });
    assert.match(await page.locator('#factory-delivery-state').innerText(), /cannot accept/);
    await page.locator('[data-command="choose-delivery"]').click();
    assert.equal(await page.locator('[data-delivery-target]').count(), 0);
    assert.equal(await page.locator('.factory-delivery-dialog .factory-picker-empty').innerText(),
      'No building can receive these goods. Build a suitable destination.');
    assert.equal(await page.locator('[data-command="confirm-delivery"]').isDisabled(), true);
    await page.locator('.factory-delivery-dialog .factory-picker-footer [data-command="close-delivery-picker"]').click();
    await page.locator('[data-command="clear-delivery"]').click();
    assert.equal(await page.locator('#factory-delivery-state').innerText(), 'Choose where residents carry goods.');
    assert.deepEqual(errors, []);
    console.log('Native delivery picker passed:', `${viewport.width}x${viewport.height}`,
      'compatibility, full targets, search, stable live draft, errors, bounds, cancel/commit/clear, exact save and repairable routes');
    await context.close();
  }
  for (const touch of [false, true]) {
    const context = await browser.newContext({
      viewport: touch ? { width: 390, height: 844 } : { width: 1280, height: 800 },
      deviceScaleFactor: touch ? 3 : 1, isMobile: touch, hasTouch: touch, reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    await page.waitForFunction(() => !document.querySelector('[data-command="new-settlement"]')?.disabled);
    await page.locator('#factory-world-seed').fill('north-bank');
    await page.locator('[data-command="new-settlement"]').click();
    await page.waitForFunction(() => !document.querySelector('.factory-settlement-dialog').open);
    await unlockAll(page);
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
    assert.equal(await page.locator('.factory-inspector [data-action="machine-option"]').count(), 0,
      'Depots must not expose an output toggle');
    assert.equal(Object.hasOwn((await gameState(page)).machines.find(machine =>
      machine.building.c === placement.tile.c && machine.building.r === placement.tile.r).building, 'outputEnabled'), false);
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
      await page.evaluate(async () => {
        const { game } = await import(document.querySelector('script[src*="/src/games/factory/main.ts"]').src);
        window.factoryMotionScene = game.scene.getScene('FactoryScene');
      });
      await page.waitForFunction(reduced => window.factoryMotionScene.motionPaused === reduced, reducedMotion === 'reduce');
      for (const paused of [false, true]) {
        const resident = await page.evaluate(async ({ paused, reduced }) => {
          const { game } = await import(document.querySelector('script[src*="/src/games/factory/main.ts"]').src);
          const { FactorySimulation } = await import('/src/games/factory/game/simulation.ts');
          const { project, WALK_TICKS } = await import('/src/games/factory/game/domain.ts');
          game.loop.stop();
          const scene = game.scene.getScene('FactoryScene');
          scene.startSettlement(FactorySimulation.create());
          scene.simulation.step();
          scene.simulation.advance(90);
          scene.paused = paused;
          scene.hud.setPaused(paused);
          scene.refreshSimulationHud();
          game.step(20000, 0);
          const resident = scene.simulation.residents.find(value => value.job?.path.length);
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
  for (const { touch, format } of ['envelope', 'ruleset', 'damaged'].flatMap(format =>
    [false, true].map(touch => ({ touch, format })))) {
    const context = await browser.newContext({
      viewport: touch ? { width: 390, height: 844 } : { width: 1280, height: 800 },
      isMobile: touch, hasTouch: touch, reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    await page.locator('[data-command="new-settlement"]:not(:disabled)').waitFor();
    const legacy = await page.evaluate(async format => {
      const { game } = await import(document.querySelector('script[src*="/src/games/factory/main.ts"]').src);
      const { createSave } = await import('/src/games/factory/session/persistence.ts');
      const save = createSave(game.scene.getScene('FactoryScene').simulation, true, 'legacy-do-not-overwrite');
      if (format === 'envelope') {
        save.version = 2;
        save.simulation.ruleset = 'settlement-v1';
        save.simulation.scenario = 'settlement';
      } else if (format === 'ruleset') save.simulation.ruleset = 'settlement-v5';
      else save.simulation.recovered['food-unit']++;
      await new Promise((resolve, reject) => {
        const request = indexedDB.open('brainrot-pocket-factory', 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction('worlds', 'readwrite');
          transaction.objectStore('worlds').put(save, 'active');
          transaction.oncomplete = () => { db.close(); resolve(); };
          transaction.onabort = () => { db.close(); reject(transaction.error); };
        };
      });
      return save;
    }, format);
    await page.reload();
    await page.locator('[data-command="new-settlement"]:not(:disabled)').waitFor();
    assert.equal(await page.locator('.factory-load-message').innerText(), `${format === 'damaged'
      ? 'This save is damaged and cannot be resumed.'
      : 'This save cannot be resumed in this version of Pocket Factory.'} You can replace it with a new settlement. No save was replaced.`);
    await page.locator('.factory-save-details summary').click();
    const dialogCopy = await page.locator('.factory-settlement-dialog').innerText();
    assert.doesNotMatch(dialogCopy, /Corrupt|unsupported|ruleset|prototype|Load failed/i);
    assert.equal((dialogCopy.match(/replace it with a new settlement/g) ?? []).length, 1);
    assert.equal(await page.locator('[data-command="resume-save"]').count(), 0);
    assert.equal(await page.locator('[data-scenario], [data-command="projects"], .factory-objective').count(), 0);
    assert.deepEqual(await storedSave(page), legacy, 'Loading an incompatible save must not write');
    await page.locator('#factory-world-seed').fill('replacement-seed');
    await page.locator('[data-command="new-settlement"]').click();
    assert.equal(await page.locator('.factory-save-details').count(), 0, 'Confirmation should not repeat save diagnostics');
    assert.equal(await page.locator('.factory-load-message').isVisible(), false);
    await page.locator('[data-command="cancel-settlement"]').click();
    assert.deepEqual(await storedSave(page), legacy, 'Cancelling replacement must not write');
    await page.locator('[data-command="new-settlement"]').click();
    await page.evaluate(async () => {
      const { game } = await import(document.querySelector('script[src*="/src/games/factory/main.ts"]').src);
      const store = game.scene.getScene('FactoryScene').session.store;
      store.originalWrite = store.write;
      store.write = async () => { throw new DOMException('Replacement quota test', 'QuotaExceededError'); };
    });
    await page.locator('[data-command="confirm-settlement"]').click();
    await page.waitForFunction(() => document.querySelector('.factory-load-message').textContent.includes('Not enough space to save.'));
    assert.equal(await page.locator('.factory-load-message').innerText(),
      'Not enough space to save. Free some space on this device, then retry. No save was replaced.');
    assert.doesNotMatch(await page.locator('.factory-settlement-dialog').innerText(), /Replacement quota test/);
    assert.deepEqual(await storedSave(page), legacy, 'Failed replacement must preserve the old save');
    assert.equal(await page.evaluate(async () => {
      const { game } = await import(document.querySelector('script[src*="/src/games/factory/main.ts"]').src);
      return game.scene.getScene('FactoryScene').session.worldId;
    }), null, 'Failed replacement must not activate a new world');
    await page.evaluate(async () => {
      const { game } = await import(document.querySelector('script[src*="/src/games/factory/main.ts"]').src);
      const store = game.scene.getScene('FactoryScene').session.store;
      store.write = store.originalWrite;
      delete store.originalWrite;
    });
    await page.locator('[data-command="confirm-settlement"]').click();
    await page.waitForFunction(() => !document.querySelector('.factory-settlement-dialog').open);
    const saved = await storedSave(page);
    assert.equal(saved.version, 4);
    assert.equal(saved.simulation.ruleset, 'settlement-v8');
    assert.equal(saved.simulation.world.seed, 'replacement-seed');
    assert.notEqual(saved.worldId, legacy.worldId);
    assert.deepEqual(errors, []);
    console.log('Save recovery copy and protection passed:', format, touch ? 'touch' : 'desktop', 'clean messages, cancellation, failed write and confirmed replacement');
    await context.close();
  }
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    await page.waitForFunction(() => !document.querySelector('[data-command="new-settlement"]')?.disabled);
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
      await page.waitForFunction(() => !document.querySelector('[data-command="new-settlement"]')?.disabled);
      await page.locator('[data-command="new-settlement"]').click();
      await page.waitForFunction(() => !document.querySelector('.factory-settlement-dialog').open);
      await unlockAll(page);
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
