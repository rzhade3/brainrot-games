import "./style.css";
import { Farm, H, makeField, TOOLS, W } from "./engine";
import { onMap, type Point } from "./camera";
import { Renderer } from "./render";
import { submitScore } from "../../core/scores";
const root = document.querySelector<HTMLDivElement>("#app")!;
root.innerHTML = `<main><header><a href="/" aria-label="Back to arcade">←</a><h1>Fieldwork<span>take the long way</span></h1><button id="view" aria-label="Show whole field" aria-pressed="true">Map</button><button id="pause" aria-label="Pause game">Ⅱ</button></header>
<div class="hud"><div><small id="field-label">Field 01</small><strong id="coverage">0.0%</strong></div><div id="fuel-readout"><small id="fuel-label">Fuel</small><strong id="fuel-value">100%</strong><meter id="fuel" min="0" max="100" low="20" high="100" optimum="100" value="100" aria-label="Fuel remaining"></meter></div></div>
<div class="stage"><canvas tabindex="0" aria-label="Tractor field. Arrow keys or WASD to drive. Hold and drag on the field to steer. P pauses. Follow enables the optional moving view."></canvas><div class="overlay" id="overlay"><section class="panel" id="panel" aria-labelledby="title"></section></div></div>
<div class="progress" role="progressbar" aria-label="Field coverage" aria-valuemin="0" aria-valuemax="98" aria-valuenow="0"><div id="bar"></div></div>
<div class="footer"><span id="feedback">Leave nothing but neat rows.</span><button id="reverse" aria-label="Hold to reverse">↶ Reverse</button><span class="desktop-hint">WASD / arrows</span><button id="help" aria-label="How to play">?</button></div><div class="sr" id="announcement" aria-live="polite"></div></main>
<dialog aria-labelledby="help-title"><h2 id="help-title">Make your mark.</h2><p>Work 98% of the field on one tank. Hold and drag toward where you want to drive; release to brake. On a keyboard, use ↑ / W to drive, ↓ / S to reverse and ← → / A D to steer. Hold Reverse on touch screens to back out. Reversing lifts the plough.</p><p>Worked soil turns dark. Fuel burns as you drive, with a little extra while ploughing. Stopping costs nothing; repeated passes waste fuel. Grass gives you turning room; trees, turbines and fences stop your tractor. Missed patches glow near the finish. The camera follows the tractor without rotating or tilting. Map shows the whole field; Follow returns to the closer view.</p><p>Finish for one star. Save 15% fuel for two stars, or 30% for three. Each plough gets a tank sized to its working width. Practice has unlimited fuel and does not unlock contracts.</p><button id="close-help">Back to the field</button></dialog>`;
const el = (id: string) => document.getElementById(id)!;
const canvas = root.querySelector("canvas")!,
  renderer = new Renderer(canvas),
  dialog = root.querySelector("dialog")!;
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
let records: Record<string, number> = {};
try {
  const stored = JSON.parse(localStorage.getItem("fieldwork-fuel-v2") ?? "{}");
  if (stored && typeof stored === "object")
    for (const [k, v] of Object.entries(stored))
      if (
        /^[1-6]$/.test(k) &&
        Number.isInteger(v) &&
        Number(v) >= 1 &&
        Number(v) <= 3
      )
        records[k] = Number(v);
} catch {
  /* Play remains available without storage. */
}
let level = 1,
  tool = 1,
  practice = false,
  game = new Farm(makeField(level)),
  mode: "menu" | "playing" | "paused" | "result" = "menu";
let target: { x: number; y: number } | undefined, pointer: number | undefined;
let reversing = false;
let follow = true;
let pointerScreen: Point | undefined;
let previous = 0,
  accumulator = 0,
  oldHits = 0,
  lastMilestone = 0;
let lowFuelWarned = false;
const keys = new Set<string>();
function announce(message: string) {
  el("announcement").textContent = message;
  el("feedback").textContent = message;
}
function clearInput() {
  keys.clear();
  reversing = false;
  target = undefined;
  pointerScreen = undefined;
  pointer = undefined;
}
function maxLevel() {
  let n = 1;
  while (n < 6 && records[n]) n++;
  return n;
}
function showMenu() {
  mode = "menu";
  clearInput();
  el("overlay").hidden = false;
  el("panel").innerHTML =
    `<div class="eyebrow">A small patch of peace</div><h2 id="title">One more row.</h2><p>Neat furrows. Tight turns. Work 98% on one tank.</p>
  <label class="field-select">Field<select id="field">${Array.from({ length: practice ? 6 : maxLevel() }, (_, i) => `<option value="${i + 1}" ${level === i + 1 ? "selected" : ""}>${i + 1}. ${makeField(i + 1).name}${records[i + 1] ? ` · ${"★".repeat(records[i + 1])}` : ""}</option>`).join("")}</select></label>
  <div class="choices" aria-label="Choose plough">${TOOLS.map((t, i) => `<button data-tool="${i}" aria-pressed="${tool === i}">${t.name}<small>${["Quick turns", "Balanced", "Slow turns"][i]}</small></button>`).join("")}</div>
  <label class="mode"><input id="practice" type="checkbox" ${practice ? "checked" : ""}/>Practice · unlimited fuel</label><button class="primary" id="start">Start engine</button>`;
  root.querySelectorAll<HTMLButtonElement>("[data-tool]").forEach(
    (b) =>
      (b.onclick = () => {
        tool = Number(b.dataset.tool);
        game = new Farm(makeField(level), tool, practice);
        showMenu();
      }),
  );
  (el("field") as HTMLSelectElement).onchange = (e) => {
    level = Number((e.target as HTMLSelectElement).value);
    game = new Farm(makeField(level), tool, practice);
  };
  (el("practice") as HTMLInputElement).onchange = (e) => {
    practice = (e.target as HTMLInputElement).checked;
    if (!practice) level = Math.min(level, maxLevel());
    game = new Farm(makeField(level), tool, practice);
    showMenu();
  };
  el("start").onclick = start;
}
function start() {
  game = new Farm(makeField(level), tool, practice);
  mode = "playing";
  accumulator = 0;
  oldHits = 0;
  lastMilestone = 0;
  lowFuelWarned = false;
  clearInput();
  el("overlay").hidden = true;
  announce("Wide turns. Clean rows.");
  canvas.focus({ preventScroll: true });
}
function pause() {
  if (mode !== "playing") return;
  mode = "paused";
  clearInput();
  el("overlay").hidden = false;
  el("panel").innerHTML =
    `<div class="eyebrow">Engine idling</div><h2 id="title">Take a breather.</h2><button id="resume" class="primary">Keep going</button><button id="quit" class="secondary">Choose a field</button>`;
  el("resume").onclick = resume;
  el("quit").onclick = showMenu;
  el("resume").focus();
}
function resume() {
  mode = "playing";
  accumulator = 0;
  el("overlay").hidden = true;
  canvas.focus({ preventScroll: true });
}
function finish() {
  mode = "result";
  clearInput();
  const won = game.status === "won";
  if (won && !practice) {
    records[level] = Math.max(records[level] ?? 0, game.stars);
    try {
      localStorage.setItem("fieldwork-fuel-v2", JSON.stringify(records));
    } catch {
      /* Session progress still works. */
    }
    submitScore("fieldwork-fuel", game.score);
  }
  announce(won ? "Field finished." : "Tank empty.");
  el("overlay").hidden = false;
  el("panel").innerHTML =
    `<div class="eyebrow">${practice ? "Practice" : `Contract ${String(level).padStart(2, "0")}`}</div><h2 id="title">${won ? "Beautifully done." : "Out of fuel."}</h2>${won && !practice ? `<div class="stars" aria-label="${game.stars} of 3 stars">${"★".repeat(game.stars)}${"☆".repeat(3 - game.stars)}</div>` : ""}<div class="stats"><div><b>${(Math.floor(game.coverage * 1000) / 10).toFixed(1)}%</b>worked</div><div><b>${practice ? "∞" : `${Math.ceil(game.fuelFraction * 100)}%`}</b>fuel left</div></div><p>${won ? (practice ? "A good day in the field." : level === 6 ? "All six fields are yours. Chase three stars with a different plough." : "The next field is ready.") : "Keep passes close and turns short, or finish this field in practice."}</p><button id="again" class="primary">${won && !practice && level < 6 ? "Next field →" : "Try again"}</button>${!won ? '<button id="continue" class="secondary">Finish in practice</button>' : ""}<button id="choose" class="secondary">Choose a field</button>`;
  el("again").onclick = () => {
    if (won && !practice && level < 6) level++;
    start();
  };
  if (!won)
    el("continue").onclick = () => {
      practice = true;
      game.practice = true;
      game.status = "playing";
      resume();
    };
  el("choose").onclick = showMenu;
  el("again").focus();
}
el("pause").onclick = () => (mode === "paused" ? resume() : pause());
el("help").onclick = () => {
  pause();
  dialog.showModal();
};
el("close-help").onclick = () => dialog.close();
window.addEventListener("keydown", (e) => {
  if (dialog.open || /INPUT|SELECT/.test((e.target as HTMLElement).tagName))
    return;
  if (
    (e.target as HTMLElement).tagName === "BUTTON" &&
    !["p", "escape"].includes(e.key.toLowerCase())
  )
    return;
  const key = e.key.toLowerCase();
  if (
    [
      "arrowup",
      "arrowdown",
      "arrowleft",
      "arrowright",
      "w",
      "a",
      "s",
      "d",
      "p",
      "escape",
    ].includes(key)
  ) {
    e.preventDefault();
    if (key === "p" || key === "escape") {
      if (!e.repeat) {
        if (mode === "playing") pause();
        else if (mode === "paused") resume();
      }
    } else if (mode === "playing") keys.add(key);
  }
});
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener("blur", pause);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pause();
});
function screenPoint(e: PointerEvent): Point {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) * W) / rect.width,
    y: ((e.clientY - rect.top) * H) / rect.height,
  };
}
function setTarget(e: PointerEvent) {
  pointerScreen = screenPoint(e);
  target = renderer.camera.toWorld(pointerScreen);
}
el("view").onclick = () => {
  follow = !follow;
  clearInput();
  renderer.camera.update(game, !follow || mode === "menu" || mode === "result");
  el("view").textContent = follow ? "Map" : "Follow";
  el("view").setAttribute("aria-pressed", String(follow));
  el("view").setAttribute(
    "aria-label",
    follow ? "Show whole field" : "Follow tractor",
  );
  canvas.focus({ preventScroll: true });
};
canvas.onpointerdown = (e) => {
  if (mode !== "playing" || pointer !== undefined) return;
  if (!renderer.camera.overview && onMap(screenPoint(e))) return;
  pointer = e.pointerId;
  canvas.setPointerCapture(pointer);
  setTarget(e);
  canvas.focus({ preventScroll: true });
};
canvas.onpointermove = (e) => {
  if (e.pointerId === pointer) setTarget(e);
};
const release = (e: PointerEvent) => {
  if (e.pointerId === pointer) {
    pointer = undefined;
    pointerScreen = undefined;
    target = undefined;
  }
};
canvas.onpointerup = release;
canvas.onpointercancel = release;
canvas.onlostpointercapture = release;
el("reverse").onpointerdown = (e) => {
  if (mode !== "playing") return;
  reversing = true;
  el("reverse").setPointerCapture(e.pointerId);
};
for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
  el("reverse").addEventListener(event, () => (reversing = false));
el("reverse").onkeydown = (e) => {
  if (e.key === " " || e.key === "Enter") {
    e.preventDefault();
    reversing = true;
  }
};
el("reverse").onkeyup = () => (reversing = false);
el("reverse").onblur = () => (reversing = false);
function frame(now: number) {
  const dt = previous ? Math.min((now - previous) / 1000, 0.1) : 0;
  previous = now;
  renderer.camera.update(game, !follow || mode === "menu" || mode === "result");
  if (mode === "playing") {
    accumulator += dt;
    while (accumulator >= 1 / 60 && mode === "playing") {
      const down = (...k: string[]) => (k.some((v) => keys.has(v)) ? 1 : 0);
      // Reproject a held finger through the moving camera, not a stale world target.
      target =
        pointerScreen &&
        (!renderer.camera.overview && onMap(pointerScreen)
          ? undefined
          : renderer.camera.toWorld(pointerScreen));
      game.step(1 / 60, {
        throttle: reversing
          ? -1
          : down("arrowup", "w") - down("arrowdown", "s"),
        steer: down("arrowright", "d") - down("arrowleft", "a"),
        target: reversing ? undefined : target,
      });
      accumulator -= 1 / 60;
      if (game.hits > oldHits) {
        oldHits = game.hits;
        announce("Blocked — reverse and turn.");
      }
      const milestone = Math.floor(game.coverage * 4);
      if (milestone > lastMilestone) {
        lastMilestone = milestone;
        announce(
          milestone === 3
            ? "Last quarter. Bring it home."
            : `${milestone * 25}% worked.`,
        );
      }
      if (!practice && !lowFuelWarned && game.fuelFraction <= 0.2) {
        lowFuelWarned = true;
        announce("Fuel low — make each pass count.");
      }
      if (game.status !== "playing") finish();
    }
  }
  renderer.camera.x = game.x;
  renderer.camera.y = game.y;
  target =
    pointerScreen &&
    (!renderer.camera.overview && onMap(pointerScreen)
      ? undefined
      : renderer.camera.toWorld(pointerScreen));
  renderer.draw(game, now, reduced.matches || mode !== "playing", target);
  el("coverage").textContent =
    `${(Math.floor(game.coverage * 1000) / 10).toFixed(1)}%`;
  const fuelPercent = Math.ceil(game.fuelFraction * 100);
  el("fuel-value").textContent = practice ? "∞" : `${fuelPercent}%`;
  el("fuel-label").textContent = practice ? "Unlimited fuel" : "Fuel";
  (el("fuel") as HTMLMeterElement).value = practice ? 100 : fuelPercent;
  el("fuel").setAttribute(
    "aria-valuetext",
    practice ? "Unlimited fuel" : `${fuelPercent}% remaining`,
  );
  el("fuel-readout").classList.toggle(
    "low",
    !practice && game.fuelFraction <= 0.2,
  );
  el("field-label").textContent = `Field ${String(level).padStart(2, "0")}`;
  el("bar").style.width = `${Math.min(100, (game.coverage / 0.98) * 100)}%`;
  root
    .querySelector(".progress")!
    .setAttribute(
      "aria-valuenow",
      String(Math.min(98, Math.round(game.coverage * 100))),
    );
  (el("pause") as HTMLButtonElement).disabled =
    mode === "menu" || mode === "result";
  el("pause").textContent = mode === "paused" ? "▶" : "Ⅱ";
  el("pause").setAttribute(
    "aria-label",
    mode === "paused" ? "Resume game" : "Pause game",
  );
  requestAnimationFrame(frame);
}
showMenu();
requestAnimationFrame(frame);
