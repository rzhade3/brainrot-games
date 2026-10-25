import test from "node:test";
import assert from "node:assert/strict";
import { Camera, MAP, onMap } from "./camera";
import { W, H } from "./engine";
test("camera projection and touch inverse agree at every heading and field edge", () => {
  for (const x of [22, 300, 578])
    for (const y of [22, 380, 738])
      for (let n = 0; n < 32; n++) {
        const camera = new Camera();
        camera.update({ x, y, angle: (n * Math.PI) / 16 }, 0, false, false);
        for (const screen of [
          { x: 0, y: 0 },
          { x: W, y: H },
          { x: 300, y: 180 },
        ]) {
          const actual = camera.toScreen(camera.toWorld(screen));
          assert.ok(
            Math.hypot(actual.x - screen.x, actual.y - screen.y) < 1e-8,
          );
        }
        const tractor = camera.toScreen({ x, y });
        assert.deepEqual(tractor, { x: W / 2, y: H * 0.68 });
      }
});
test("heading wraps along shortest arc and reduced motion stays north-up", () => {
  const camera = new Camera();
  camera.update({ x: 0, y: 0, angle: Math.PI - 0.01 }, 0, false, false);
  const previous = camera.heading;
  camera.update({ x: 0, y: 0, angle: -Math.PI + 0.01 }, 1 / 60, false, false);
  assert.ok(Math.abs(camera.heading - previous) < 0.02);
  camera.update({ x: 0, y: 0, angle: 2 }, 1 / 60, false, true);
  assert.ok(Math.abs(Math.sin(camera.rotation)) < 1e-8);
});
test("overview is identity and map hitbox is isolated from driving", () => {
  const camera = new Camera();
  const point = { x: 123, y: 456 };
  assert.deepEqual(camera.toWorld(point), point);
  assert.deepEqual(camera.toScreen(point), point);
  assert.ok(onMap({ x: MAP.x + 30, y: MAP.y + 30 }));
  assert.ok(!onMap({ x: 300, y: 400 }));
});
test("holding ahead follows heading and the plough stays below the tractor", () => {
  const camera = new Camera();
  camera.update({ x: 300, y: 400, angle: 0 }, 0, false, false);
  const aim = camera.toWorld({ x: W / 2, y: H * 0.68 - 100 });
  assert.ok(aim.x > 300);
  assert.ok(Math.abs(aim.y - 400) < 1e-8);
  const blade = camera.toScreen({ x: 278, y: 400 });
  assert.ok(blade.y > H * 0.68);
  camera.update({ x: 320, y: 400, angle: 0 }, 0, false, false);
  assert.ok(camera.toWorld({ x: W / 2, y: H * 0.68 - 100 }).x > aim.x);
});
