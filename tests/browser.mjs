// End-to-end checks in a real browser, for what the unit tests cannot see: how the board is
// layered, and that the pages work when clicked through. Run with `bun run test:browser`.
//
// It drives Chrome directly over its debugging protocol, so there is nothing to install
// beyond a Chrome or Chromium. Set CHROME_PATH if it is not in one of the usual places.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 4188;
const DEBUG_PORT = 9388;
const BASE = `http://localhost:${PORT}`;

const chromePath = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].find((path) => path && existsSync(path));
if (!chromePath) {
  console.error("No Chrome found. Set CHROME_PATH to a Chrome or Chromium binary.");
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const profile = mkdtempSync(join(tmpdir(), "catan-browser-test-"));
const server = spawn("bun", ["x", "vite", "preview", "--port", String(PORT), "--strictPort"], { stdio: "ignore" });
const chrome = spawn(
  chromePath,
  ["--headless=new", `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${profile}`, "--window-size=1100,1300", "about:blank"],
  { stdio: "ignore" }
);
const shutDown = () => {
  server.kill();
  chrome.kill();
  rmSync(profile, { recursive: true, force: true });
};

async function connect() {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      await fetch(BASE);
      const targets = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`)).json();
      const socket = new WebSocket(targets.find((target) => target.type === "page").webSocketDebuggerUrl);
      await new Promise((resolve, reject) => {
        socket.onopen = resolve;
        socket.onerror = reject;
      });
      return socket;
    } catch {
      await sleep(200);
    }
  }
  throw new Error("The preview server or Chrome did not start.");
}

const failures = [];
const pageErrors = [];
let passed = 0;

function check(name, ok, detail = "") {
  if (ok) passed++;
  else failures.push(detail ? `${name}: ${detail}` : name);
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok || !detail ? "" : ` (${detail})`}`);
}

try {
  const socket = await connect();
  let nextId = 0;
  const pending = new Map();
  socket.onmessage = (message) => {
    const data = JSON.parse(message.data);
    if (data.id) pending.get(data.id)?.(data);
    if (data.method === "Runtime.exceptionThrown") {
      const details = data.params.exceptionDetails;
      pageErrors.push(details.exception?.description ?? details.text);
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      pending.set(++nextId, resolve);
      socket.send(JSON.stringify({ id: nextId, method, params }));
    });
  const js = async (expression) => {
    const reply = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (reply.result.exceptionDetails) {
      throw new Error(reply.result.exceptionDetails.exception?.description ?? "evaluation failed");
    }
    return reply.result.result.value;
  };
  const open = async (path, wait = 900) => {
    // a hash-only change does not reload, so leave the page first
    await send("Page.navigate", { url: "about:blank" });
    await sleep(80);
    await send("Page.navigate", { url: `${BASE}/${path}` });
    await sleep(wait);
  };
  const tap = (selector) => js(`document.querySelector(${JSON.stringify(selector)}).click()`);

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1100, height: 1300, deviceScaleFactor: 1, mobile: false });

  // --- every map: nothing on the board hidden under a tile or another piece ---
  await open("map-generator.html", 1200);
  const boards = await js(`[...document.querySelectorAll("#board-select option")].map((option) => option.value)`);
  const covered = [];
  for (const board of boards) {
    await open(`map-generator.html#board=${board}&seed=5`);
    const found = await js(`(() => {
      // pointer-events are switched on everywhere so elementFromPoint sees what is painted on top
      const style = document.createElement("style");
      style.textContent = "* { pointer-events: auto !important }";
      document.head.appendChild(style);
      const pieces = [...document.querySelectorAll(".hex-chit, .hex-robber, .hex-unknown, .hex-port__label, .hex-edge-item__badge")];
      const problems = [];
      for (const piece of pieces) {
        const box = piece.getBoundingClientRect();
        const hidden = [[.5, .5], [.12, .5], [.88, .5], [.5, .15], [.5, .85]].some(([x, y]) =>
          document.elementFromPoint(box.x + box.width * x, box.y + box.height * y)?.classList.contains("hex"));
        if (hidden) problems.push(piece.textContent.trim() + " is under a tile");
      }
      style.remove();
      const boxes = pieces.filter((piece) => !piece.classList.contains("hex-robber")).map((piece) => [piece, piece.getBoundingClientRect()]);
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const [a, b] = [boxes[i][1], boxes[j][1]];
        const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (width > 0 && height > 0 && width * height > 0.08 * Math.min(a.width * a.height, b.width * b.height)) {
          problems.push(boxes[i][0].textContent.trim() + " overlaps " + boxes[j][0].textContent.trim());
        }
      }
      return { tiles: document.querySelectorAll(".hex").length, problems };
    })()`);
    if (found.tiles === 0) covered.push(`${board}: no board drawn`);
    covered.push(...found.problems.map((problem) => `${board}: ${problem}`));
  }
  check(`board pieces are clear on all ${boards.length} maps`, covered.length === 0, covered.slice(0, 4).join("; "));

  // --- generator: the page must not jump while reshuffling ---
  await open("map-generator.html#board=catan-3-4&seed=7", 1200);
  const footer = await js(`new Promise((resolve) => {
    const tops = [];
    (function watch() { tops.push(Math.round(document.querySelector(".site-footer").getBoundingClientRect().top + scrollY)); requestAnimationFrame(watch); })();
    const button = document.querySelector("#map-controls button[type=submit]");
    let shuffles = 0;
    const timer = setInterval(() => { button.disabled = false; button.click(); if (++shuffles === 12) { clearInterval(timer); setTimeout(() => resolve([Math.min(...tops), Math.max(...tops)]), 500); } }, 40);
  })`);
  check("the footer stays put through rapid shuffles", footer[0] === footer[1], `moved between ${footer[0]} and ${footer[1]}`);
  check("the balance panel lists resources and spots", await js(`document.querySelectorAll(".board-balance__row").length >= 5 && document.querySelectorAll(".board-balance__spots li").length === 5`));

  // --- rules: search and section links ---
  await open("rules.html");
  await js(`(() => { const box = document.getElementById("rules-search"); box.value = "robber"; box.dispatchEvent(new Event("input")); })()`);
  check("rules search finds and marks sections", await js(`document.querySelectorAll(".rule-section").length > 0 && document.querySelectorAll(".rule-section mark").length > 0`));
  const link = await js(`document.querySelector(".rule-section__link").getAttribute("href")`);
  await open(`rules.html${link}`);
  check("a section link opens its rule set", await js(`!!document.getElementById(${JSON.stringify(link.slice(1).replace("/", "-"))}) && !!document.querySelector("#rules-tabs button.active")`));

  // --- play: a game from setup to a recorded result ---
  const startGame = async (board, citiesKnights) => {
    await open(`map-generator.html#board=${board}&seed=7`, 1200);
    await js(`localStorage.clear()`);
    await tap("#start-game");
    await sleep(900);
    await js(`(() => { document.querySelector("input[name=shuffle]").checked = false; document.querySelector("input[name=citiesKnights]").checked = ${citiesKnights}; document.querySelector("#play-setup button[type=submit]").click(); })()`);
    await sleep(200);
    // the opening placements: always take an offered corner, then an offered side
    await js(`(() => { for (let guard = 0; guard < 80 && document.querySelector("#play-turn h2").innerText.includes("places"); guard++) {
      const corners = document.querySelectorAll(".vertex--open");
      if (corners.length) corners[(guard * 13 + 5) % corners.length].click();
      else document.querySelector(".edge:not(.edge--road):not(.edge--ship)").click(); } })()`);
  };
  const game = `JSON.parse(localStorage.getItem("catan-comp-game"))`;

  await startGame("catan-3-4", false);
  check("setup ends with the dice pad showing", await js(`!!document.querySelector(".play-pad") && ${game}.setup.length === ${game}.players.length * 4`));
  await tap('[data-action=roll][data-value="8"]');
  check("the pad hides after a roll and Next player appears", await js(`!document.querySelector(".play-pad") && !!document.querySelector("[data-action=next]")`));
  check("a roll lights the hexes it pays out on", await js(`document.querySelectorAll(".hex.is-rolled").length > 0 && document.querySelectorAll(".hex.is-rolled").length === document.querySelectorAll(".hex-top.is-rolled").length`));
  await tap("[data-action=undo]");
  check("undo brings the pad back", await js(`!!document.querySelector(".play-pad") && ${game}.rolls.length === 0`));
  await tap('[data-action=roll][data-value="6"]');
  await tap("[data-action='buy-card']");
  await tap("[data-action=knight]");
  await js(`[...document.querySelectorAll(".hex")].find((hex) => hex.title === "Forest").click()`);
  check("a knight moves the robber and uses up the turn's card", await js(`${game}.hexes[${game}.robber].type === "forest" && document.querySelector("[data-action=knight]").disabled`));
  check("the history shows the purchase with its cost", await js(`document.querySelector(".play-history").innerText.includes("buys a development card") && document.querySelector(".play-history").innerText.includes("Ore")`));
  const width = await js(`document.querySelector("#play-board").getBoundingClientRect().width`);
  await tap("[data-action=zoom]");
  check("zoom enlarges the board", await js(`document.querySelector("#play-board").getBoundingClientRect().width > ${width} * 1.4`));
  await tap("[data-action=next]");
  check("Next player passes the turn", await js(`${game}.turn === 1`));
  await js(`window.confirm = () => true`);
  await tap("[data-action=end]");
  await sleep(700);
  check("ending a game shows its result and keeps nothing", await js(`!!document.querySelector("#play-share-picture") && localStorage.length === 0`));

  // the sample game, from a page with nothing saved
  await js(`localStorage.clear()`);
  await open("play.html");
  await tap("#play-sample");
  await sleep(900);
  check("the sample game opens mid-game, ready to roll", await js(`!!document.querySelector(".play-pad") && ${game}.turn > 5 && document.querySelectorAll(".vertex--settlement, .vertex--city").length === 6`));
  await tap("[data-action=virtual]");
  check("a roll made by the app shows its two dice", await js(`(() => { const faces = [...document.querySelectorAll(".die")].map((die) => die.querySelectorAll("[data-pip]").length); return faces.length === 2 && faces[0] + faces[1] === ${game}.rolls.at(-1).total; })()`));
  await tap('[data-action=mode][data-value=road]');
  await js(`document.querySelector(".edge:not(.edge--road)").click()`);
  check("only the piece just placed drops in", await js(`document.querySelectorAll(".is-new").length === 1 && document.querySelector(".is-new").classList.contains("edge--road")`));
  check("the dice table shows how long each player's turns take", await js(`[...document.querySelectorAll("#play-stats tbody td:last-child")].every((cell) => cell.innerText === "1:30") && document.querySelector("#play-stats h2").innerText.toLowerCase().includes("1:30 a turn")`));
  await tap("[data-action=nudge]");
  await js(`(() => { const game = JSON.parse(localStorage.getItem("catan-comp-game")); game.turnStartedAt -= 61000; localStorage.setItem("catan-comp-game", JSON.stringify(game)); })()`);
  await open("play.html");
  await sleep(1200);
  check("a turn past the nudge marks its clock, and the choice survives a reload", await js(`document.querySelector("#play-timer").classList.contains("is-late") && document.querySelector("[data-action=nudge]").innerText === "Nudge at 1 min"`));
  // sound is made on the spot, so count what a cue asks the browser to play
  await js(`(() => { window.played = { notes: 0, rattles: 0 };
    const note = AudioContext.prototype.createOscillator, rattle = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createOscillator = function () { window.played.notes++; return note.call(this); };
    AudioContext.prototype.createBufferSource = function () { window.played.rattles++; return rattle.call(this); }; })()`);
  await tap("[data-action=next]");
  await tap('[data-action=roll][data-value="5"]');
  check("the game is silent until sound is switched on", await js(`window.played.notes + window.played.rattles === 0`));
  await tap("[data-action=sound]");
  await tap("[data-action=next]");
  await tap('[data-action=roll][data-value="7"]');
  // switching sound on knocks once, which is one note and one rattle of those counted
  check("with sound on, a seven rattles the dice and plays its two notes", await js(`window.played.notes === 3 && window.played.rattles === 4 && document.querySelector("[data-action=sound]").innerText === "Sound on"`), JSON.stringify(await js(`window.played`)));
  await js(`window.confirm = () => true`);
  // if the card cannot be drawn there is no result to show, and the game must survive that
  await js(`(() => { window.alert = (said) => (window.alerted = said);
    window.realContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = () => null; })()`);
  await tap("[data-action=end]");
  await sleep(300);
  check("a result that cannot be drawn leaves the game as it was", await js(`!!window.alerted && !!document.querySelector("[data-action=next]") && ${game}.rolls.length > 0`));
  await js(`HTMLCanvasElement.prototype.getContext = window.realContext`);
  // the picture is on show only until the replay takes its place, so note it as it is made
  await js(`(() => { const toBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (...given) { window.drawn = [this.width, this.height].join(); toBlob.apply(this, given); }; })()`);
  await tap("[data-action=end]");
  await sleep(700);
  const card = `document.querySelector("#play-card")`;
  check("a finished game is drawn as a result picture", (await js(`window.drawn`)) === "1080,1350");
  for (let wait = 0; wait < 40 && (await js(`document.querySelector("#play-share-replay").disabled`)); wait++) await sleep(100);
  const film = await js(`fetch(${card}.src).then((reply) => reply.blob()).then(async (blob) => [blob.type, new TextDecoder().decode(await blob.slice(0, 6).arrayBuffer())].join())`);
  check("and as a replay of how its board was built", film === "image/gif,GIF89a", film);
  check("the footer links to the issue tracker", await js(`document.querySelector(".site-footer a").href.endsWith("/issues/new")`));

  await startGame("ck-3-4", true);
  check("Cities & Knights shows improvements and no knight card", await js(`!document.querySelector("#play-city").hidden && !document.querySelector("[data-action=knight]")`));
  await js(`for (let level = 0; level < 4; level++) document.querySelector('[data-action=improve][data-value="0:trade:1"]').click()`);
  check("the fourth level takes the metropolis", await js(`${game}.metropolis.trade === 0 && document.querySelector('#play-city .play-award[data-held=true]').innerText === "4"`));
  await tap('[data-action=mode][data-value=knight]');
  await tap(".vertex--open");
  await tap(".vertex--knight");
  await tap('[data-action="knight-do"][data-value=activate]');
  await tap(".vertex--knight");
  await tap('[data-action="knight-do"][data-value=promote]');
  check("a knight can be recruited, activated and promoted", await js(`(() => { const [knight] = Object.values(${game}.knights); return knight.level === 2 && knight.active; })()`));

  // On maps whose land and sea are shuffled, the coast is wherever this deal put it.
  await open("map-generator.html#board=sf-new-world&seed=7", 1200);
  await js(`localStorage.clear()`);
  await tap("#start-game");
  await sleep(900);
  await tap("#play-setup button[type=submit]");
  await sleep(200);
  const short = await js(`(() => {
    const markers = [...document.querySelectorAll(".vertex--open")].map((marker) => marker.getBoundingClientRect())
      .map((box) => [box.x + box.width / 2, box.y + box.height / 2]);
    return [...document.querySelectorAll(".hex")].filter((tile) => tile.title !== "Sea").filter((tile) => {
      const box = tile.getBoundingClientRect();
      const [x, y, reach] = [box.x + box.width / 2, box.y + box.height / 2, Math.max(box.width, box.height) * 0.55];
      return markers.filter(([mx, my]) => Math.hypot(mx - x, my - y) < reach).length !== 6;
    }).length;
  })()`);
  check("every land hex on a shuffled map offers all six corners", short === 0, `${short} land hexes are missing corners`);

  await open("rules.html");
  const lastSection = await js(`[...document.querySelectorAll(".rules-contents a")].at(-1).getAttribute("href")`);
  await open(`rules.html${lastSection}`);
  await js(`window.scrollTo(0, 0)`);
  await tap(`.rules-contents a[href="${lastSection}"]`);
  check("a link to the section already open still jumps to it", await js(`scrollY > 100`));

  await startGame("sf-cloth-for-catan", false);
  check("Seafarers offers ships and the pirate", await js(`!!document.querySelector('[data-action=mode][data-value=ship]') && !!document.querySelector('[data-action=mode][data-value=pirate]')`));
  await tap('[data-action=mode][data-value=pirate]');
  await js(`[...document.querySelectorAll(".hex")].find((hex) => hex.title === "Sea").click()`);
  check("the pirate can be placed on a sea hex", await js(`${game}.pirate !== null && !!document.querySelector(".hex-robber--pirate")`));

  check("no page raised an error", pageErrors.length === 0, pageErrors.slice(0, 3).join("; "));
  socket.close();
} catch (error) {
  failures.push(`the run stopped early: ${error.message}`);
  console.log(`FAIL ${error.message}`);
} finally {
  shutDown();
}

console.log(`\n${passed} passed, ${failures.length} failed`);
process.exit(failures.length === 0 ? 0 : 1);
