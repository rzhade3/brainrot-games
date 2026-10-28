import test from "node:test";
import assert from "node:assert/strict";
import { Camera, MAP, onMap } from "./camera";
import { W, H } from "./engine";
test("overview is independent of tractor movement", () => {
  const camera = new Camera(),
    point = { x: 123, y: 456 };
  assert.ok(camera.overview);
  camera.update({ x: 22, y: 738, angle: 2 }, true);
  assert.deepEqual(camera.toScreen(point), point);
  assert.deepEqual(camera.toWorld(point), point);
});
test("follow projection and touch inverse agree at every field edge", () => {
  for (const x of [22, 300, 578])
    for (const y of [22, 380, 738]) {
      const camera = new Camera();
      camera.update({ x, y, angle: 0 }, false);
      for (const screen of [
        { x: 0, y: 0 },
        { x: W, y: H },
        { x: 300, y: 180 },
      ]) {
        const actual = camera.toScreen(camera.toWorld(screen));
        assert.ok(Math.hypot(actual.x - screen.x, actual.y - screen.y) < 1e-8);
      }
      assert.deepEqual(camera.toScreen({ x, y }), { x: W / 2, y: H / 2 });
    }
});
test("turning never rotates or tilts the world in follow mode", () => {
  const camera = new Camera();
  for (let n = 0; n < 32; n++) {
    camera.update({ x: 300, y: 400, angle: (n * Math.PI) / 16 }, false);
    assert.deepEqual(camera.toScreen({ x: 310, y: 400 }), {
      x: W / 2 + 15.5,
      y: H / 2,
    });
    assert.deepEqual(camera.toScreen({ x: 300, y: 410 }), {
      x: W / 2,
      y: H / 2 + 15.5,
    });
  }
});
test("held-pointer aim follows translation; minimap does not accept driving gestures", () => {
  const camera = new Camera();
  camera.update({ x: 300, y: 400, angle: 0 }, false);
  const point = { x: W / 2, y: H / 2 - 100 },
    old = camera.toWorld(point);
  camera.update({ x: 320, y: 400, angle: Math.PI }, false);
  const next = camera.toWorld(point);
  assert.equal(next.x - old.x, 20);
  assert.equal(next.y, old.y);
  assert.ok(onMap({ x: MAP.x + 30, y: MAP.y + 30 }));
  assert.ok(!onMap({ x: 300, y: 400 }));
});
