/**
 * Generates the hex terrain artwork as SVG.
 *
 * The art is drawn here rather than by hand so it stays consistent: every tile shares one
 * hexagon geometry, one palette structure and one lighting direction, and the scatter of
 * trees, rocks and dunes comes from a seeded RNG so regenerating produces identical files.
 *
 * Run with `npm run art`.
 */
import { mkdir, writeFile } from "node:fs/promises";

const OUT_DIR = "src/assets/hexes";

/** Pointy-top hexagon: flat left and right edges, vertices top and bottom. */
const W = 200;
const H = (W * 2) / Math.sqrt(3);
const HEX = `M${W / 2} 0 L${W} ${H / 4} L${W} ${(H * 3) / 4} L${W / 2} ${H} L0 ${(H * 3) / 4} L0 ${H / 4} Z`;

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const n = (value) => Number(value.toFixed(2));

/**
 * Points scattered inside the hexagon, kept clear of the edges and roughly evenly spread.
 *
 * `keepOut` holds them off the middle of the tile, because a number chit sits there on the
 * board and would hide anything drawn underneath it.
 */
function scatter(random, count, { inset = 26, minGap = 30, keepOut = 46 } = {}) {
  const points = [];
  for (let tries = 0; tries < count * 400 && points.length < count; tries++) {
    const x = inset + random() * (W - inset * 2);
    const y = inset + random() * (H - inset * 2);
    // stay inside the slanted caps
    const dy = Math.abs(y - H / 2);
    const halfWidth = (W / 2) * (1 - Math.max(0, dy - H / 4) / (H / 4));
    if (Math.abs(x - W / 2) > halfWidth - inset) continue;
    if (Math.hypot(x - W / 2, y - H / 2) < keepOut) continue;
    if (points.some((p) => Math.hypot(p.x - x, p.y - y) < minGap)) continue;
    points.push({ x, y });
  }
  return points;
}

const PALETTES = {
  fields: { base: "#e8b53c", dark: "#c08d1c", light: "#f7d97e", ink: "#8a5f10" },
  forest: { base: "#3f7038", dark: "#26461f", light: "#5f9a4c", ink: "#33281a" },
  pasture: { base: "#94b02e", dark: "#6d8a18", light: "#b4d049", ink: "#f7f2e6" },
  hills: { base: "#c3552f", dark: "#8f3819", light: "#e0855a", ink: "#6a2712" },
  mountains: { base: "#767b83", dark: "#484d55", light: "#a3a9b2", ink: "#eef1f5" },
  gold: { base: "#e2ab3e", dark: "#ac7a19", light: "#ffdd85", ink: "#3f7cae" },
  desert: { base: "#e0bd7c", dark: "#bd9350", light: "#f5dfae", ink: "#9c7740" },
  sea: { base: "#3a6ea5", dark: "#27507b", light: "#5f93cb", ink: "#b6d6f0" },
  fog: { base: "#a9a08d", dark: "#82796a", light: "#cbc4b4", ink: "#eae5da" },
  village: { base: "#8b6f9e", dark: "#65507a", light: "#b295c4", ink: "#f3ecf7" },
};

/** A soft top-left light and bottom-right shade, shared by every tile. */
function shading(id) {
  return `
  <linearGradient id="sheen-${id}" x1="0.15" y1="0" x2="0.85" y2="1">
    <stop offset="0" stop-color="#fff" stop-opacity="0.18"/>
    <stop offset="0.5" stop-color="#fff" stop-opacity="0"/>
    <stop offset="1" stop-color="#000" stop-opacity="0.16"/>
  </linearGradient>`;
}

function tree(x, y, s, p) {
  return (
    `<path d="M${n(x - 1.6 * s)} ${n(y)} h${n(3.2 * s)} v${n(3.4 * s)} h${n(-3.2 * s)} Z" fill="${p.ink}"/>` +
    `<path d="M${n(x)} ${n(y - 11 * s)} L${n(x + 6.4 * s)} ${n(y + 0.6 * s)} L${n(x - 6.4 * s)} ${n(y + 0.6 * s)} Z" fill="${p.dark}"/>` +
    `<path d="M${n(x)} ${n(y - 11 * s)} L${n(x + 6.4 * s)} ${n(y + 0.6 * s)} L${n(x)} ${n(y + 0.6 * s)} Z" fill="${p.light}" opacity="0.55"/>`
  );
}

const DRAW = {
  fields(random, p) {
    // a ploughed wheat field: alternating furrows with stalk ticks along the crests, which
    // reads better at board size than any discrete icon does
    let out = "";
    for (let i = 0; i < 8; i++) {
      const y = 14 + i * 25;
      const dip = 12 + (i % 2) * 4;
      const crest = `M-8 ${n(y)} Q${n(W / 2)} ${n(y - dip)} ${n(W + 8)} ${n(y)}`;
      out += `<path d="${crest}" stroke="${p.dark}" stroke-width="11" fill="none" opacity="0.32"/>`;
      out += `<path d="${crest}" stroke="${p.light}" stroke-width="4" fill="none" opacity="0.5" transform="translate(0 7)"/>`;
      for (let k = 0; k < 9; k++) {
        const x = 12 + k * 22 + (i % 2) * 11;
        const t = x / W;
        const ty = y - dip * 4 * t * (1 - t);
        out += `<path d="M${n(x)} ${n(ty - 3)} v-9" stroke="${p.ink}" stroke-width="2.6" opacity="0.55" stroke-linecap="round"/>`;
      }
    }
    return out;
  },

  forest(random, p) {
    let out = `<path d="M-6 ${n(H * 0.66)} Q${n(W * 0.5)} ${n(H * 0.55)} ${n(W + 6)} ${n(H * 0.7)} V${n(H)} H-6 Z" fill="${p.dark}" opacity="0.5"/>`;
    const trees = scatter(random, 7, { inset: 42, minGap: 46 }).sort((a, b) => a.y - b.y);
    for (const { x, y } of trees) {
      const s = 1.5 + random() * 0.9;
      out += `<g transform="translate(${n(x)} ${n(y)}) scale(${n(s)})">
        <rect x="-3" y="4" width="6" height="12" rx="1.5" fill="${p.ink}"/>
        <path d="M0 -22 L13 2 H-13 Z" fill="${p.dark}"/>
        <path d="M0 -22 L13 2 H0 Z" fill="${p.light}" opacity="0.5"/>
        <path d="M0 -13 L15 8 H-15 Z" fill="${p.dark}"/>
        <path d="M0 -13 L15 8 H0 Z" fill="${p.light}" opacity="0.42"/>
      </g>`;
    }
    return out;
  },

  pasture(random, p) {
    let out = "";
    for (let i = 0; i < 3; i++) {
      const y = H * (0.36 + i * 0.2);
      out += `<path d="M-6 ${n(y)} Q${n(W * 0.32)} ${n(y - 26)} ${n(W * 0.66)} ${n(y - 4)} T${n(W + 6)} ${n(y - 14)} V${n(H)} H-6 Z" fill="${p.dark}" opacity="0.24"/>`;
    }
    for (const { x, y } of scatter(random, 3, { inset: 52, minGap: 62 })) {
      const s = 1.5 + random() * 0.3;
      out += `<g transform="translate(${n(x)} ${n(y)}) scale(${n(s)})">
        <path d="M-7 9 v6 M2 9 v6" stroke="${p.dark}" stroke-width="3.4" stroke-linecap="round"/>
        <ellipse cx="-1" cy="0" rx="13" ry="9.5" fill="${p.ink}"/>
        <circle cx="11" cy="-4" r="5.6" fill="${p.dark}"/>
        <circle cx="12.6" cy="-5.6" r="1.5" fill="${p.ink}"/>
      </g>`;
    }
    return out;
  },

  hills(random, p) {
    // terraced clay pit with courses of brick stacked around the tile
    let out = "";
    for (let i = 0; i < 4; i++) {
      const y = H * (0.22 + i * 0.19);
      out += `<path d="M-6 ${n(y)} Q${n(W * 0.5)} ${n(y - 24)} ${n(W + 6)} ${n(y)} V${n(H)} H-6 Z" fill="${p.dark}" opacity="0.3"/>`;
    }
    const bw = 26, bh = 12;
    for (const { x, y } of scatter(random, 5, { inset: 40, minGap: 46, keepOut: 52 })) {
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 2; col++) {
          const bx = x - bw + col * (bw + 3) + (row % 2 ? bw / 2 : 0);
          const by = y - bh + row * (bh + 3);
          out += `<rect x="${n(bx)}" y="${n(by)}" width="${bw}" height="${bh}" rx="2" fill="${p.ink}"/>
            <rect x="${n(bx)}" y="${n(by)}" width="${bw}" height="${n(bh * 0.42)}" rx="2" fill="${p.light}" opacity="0.45"/>`;
        }
      }
    }
    return out;
  },

  mountains(random, p) {
    let out = "";
    const peaks = [
      { x: W * 0.26, y: H * 0.34, w: 78 },
      { x: W * 0.74, y: H * 0.3, w: 84 },
      { x: W * 0.5, y: H * 0.16, w: 104 },
    ];
    for (const { x, y, w } of peaks) {
      const base = y + w * 1.15;
      const cap = w * 0.3;
      out += `<path d="M${n(x)} ${n(y)} L${n(x + w / 2)} ${n(base)} H${n(x - w / 2)} Z" fill="${p.dark}"/>
        <path d="M${n(x)} ${n(y)} L${n(x + w / 2)} ${n(base)} H${n(x)} Z" fill="${p.light}" opacity="0.45"/>
        <path d="M${n(x)} ${n(y)} L${n(x + cap * 0.55)} ${n(y + cap)} q${n(-cap * 0.2)} ${n(-cap * 0.22)} ${n(-cap * 0.36)} 0 q${n(-cap * 0.19)} ${n(cap * 0.2)} ${n(-cap * 0.38)} 0 Z" fill="${p.ink}"/>`;
    }
    return out;
  },

  gold(random, p) {
    let out =
      `<path d="M${n(W * 0.08)} -4 Q${n(W * 0.66)} ${n(H * 0.34)} ${n(W * 0.3)} ${n(H + 4)} L${n(W * 0.74)} ${n(H + 4)} Q${n(W * 1.02)} ${n(H * 0.4)} ${n(W * 0.5)} -4 Z" fill="${p.ink}"/>` +
      `<path d="M${n(W * 0.2)} -4 Q${n(W * 0.74)} ${n(H * 0.36)} ${n(W * 0.42)} ${n(H + 4)}" stroke="#d8ecfb" stroke-width="5" fill="none" opacity="0.45"/>`;
    for (const { x, y } of scatter(random, 9, { inset: 34, minGap: 34 })) {
      const s = 5 + random() * 4;
      out += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(s)}" fill="${p.light}" stroke="${p.dark}" stroke-width="2"/>`;
    }
    return out;
  },

  desert(random, p) {
    let out = "";
    for (let i = 0; i < 4; i++) {
      const y = H * (0.28 + i * 0.18);
      out += `<path d="M-6 ${n(y)} Q${n(W * 0.34)} ${n(y - 30)} ${n(W * 0.68)} ${n(y - 4)} T${n(W + 6)} ${n(y - 16)} V${n(H)} H-6 Z" fill="${p.dark}" opacity="0.3"/>`;
      out += `<path d="M-6 ${n(y)} Q${n(W * 0.34)} ${n(y - 30)} ${n(W * 0.68)} ${n(y - 4)} T${n(W + 6)} ${n(y - 16)}" stroke="${p.light}" stroke-width="4" fill="none" opacity="0.5"/>`;
    }
    for (const { x, y } of scatter(random, 5, { inset: 44, minGap: 40 })) {
      out += `<path d="M${n(x - 14)} ${n(y)} q14 ${n(-8 - random() * 5)} 28 0" stroke="${p.ink}" stroke-width="3.4" fill="none" opacity="0.5" stroke-linecap="round"/>`;
    }
    return out;
  },

  sea(random, p) {
    let out = "";
    for (const { x, y } of scatter(random, 9, { inset: 32, minGap: 42 })) {
      const w = 18 + random() * 12;
      out += `<path d="M${n(x - w)} ${n(y)} q${n(w / 2)} -9 ${n(w)} 0 q${n(w / 2)} 9 ${n(w)} 0" stroke="${p.ink}" stroke-width="4" fill="none" opacity="0.42" stroke-linecap="round"/>`;
    }
    return out;
  },

  village(random, p) {
    // a weaving hamlet: huts round a green, with bolts of cloth on the drying line
    let out = `<ellipse cx="${n(W / 2)}" cy="${n(H * 0.56)}" rx="${n(W * 0.44)}" ry="${n(H * 0.3)}" fill="${p.dark}" opacity="0.35"/>`;
    const huts = [
      { x: W * 0.3, y: H * 0.34, s: 1.15 },
      { x: W * 0.7, y: H * 0.36, s: 1 },
      { x: W * 0.5, y: H * 0.74, s: 1.25 },
    ];
    for (const { x, y, s } of huts) {
      out += `<g transform="translate(${n(x)} ${n(y)}) scale(${n(s)})">
        <rect x="-15" y="-2" width="30" height="22" rx="2" fill="${p.ink}"/>
        <path d="M-20 -2 L0 -20 L20 -2 Z" fill="${p.dark}"/>
        <path d="M0 -20 L20 -2 H0 Z" fill="${p.light}" opacity="0.55"/>
        <rect x="-5" y="8" width="10" height="12" rx="1.5" fill="${p.dark}"/>
      </g>`;
    }
    for (const { x, y } of scatter(random, 3, { inset: 40, minGap: 44, keepOut: 58 })) {
      out += `<rect x="${n(x - 9)}" y="${n(y - 6)}" width="18" height="12" rx="2" fill="${p.light}" stroke="${p.dark}" stroke-width="2"/>`;
    }
    return out;
  },

  fog(random, p) {
    let out = "";
    for (let i = 0; i < 4; i++) {
      const y = H * (0.24 + i * 0.18);
      out += `<path d="M-14 ${n(y)} q${n(W * 0.3)} -18 ${n(W * 0.55)} 0 t${n(W * 0.62)} 0" stroke="${p.ink}" stroke-width="${n(12 + i * 3)}" fill="none" opacity="0.28" stroke-linecap="round"/>`;
    }
    // no "?" here: it is drawn by hexBoard.ts so it can stay upright on rotated boards
    return out;
  },
};

function tile(type) {
  const p = PALETTES[type];
  const random = rng([...type].reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(W)} ${n(H)}" width="${n(W)}" height="${n(H)}">
  <defs>
    <clipPath id="clip-${type}"><path d="${HEX}"/></clipPath>${shading(type)}
  </defs>
  <g clip-path="url(#clip-${type})">
    <rect width="${n(W)}" height="${n(H)}" fill="${p.base}"/>
    ${DRAW[type](random, p)}
    <rect width="${n(W)}" height="${n(H)}" fill="url(#sheen-${type})"/>
  </g>
</svg>
`;
}

await mkdir(OUT_DIR, { recursive: true });
const written = [];
for (const type of Object.keys(PALETTES)) {
  const file = `${OUT_DIR}/${type}.svg`;
  await writeFile(file, tile(type));
  written.push(file);
}
console.log(`wrote ${written.length} tiles:\n  ${written.join("\n  ")}`);

// ---------------------------------------------------------------------------
// Resource and commodity tokens, drawn in the same language as the terrain
// ---------------------------------------------------------------------------

const ICON_OUT_DIR = "src/assets/icons";
const R = 50;

const ICON_PALETTES = {
  brick: { base: "#c3552f", dark: "#8f3819", light: "#e0855a", ink: "#5e220f" },
  wood: { base: "#3f7038", dark: "#26461f", light: "#5f9a4c", ink: "#2a2116" },
  wool: { base: "#94b02e", dark: "#6d8a18", light: "#b4d049", ink: "#f7f2e6" },
  wheat: { base: "#e8b53c", dark: "#b8871a", light: "#f7d97e", ink: "#7c530c" },
  ore: { base: "#767b83", dark: "#484d55", light: "#a3a9b2", ink: "#eef1f5" },
  paper: { base: "#c9b79a", dark: "#9c8a6e", light: "#eadfc9", ink: "#5b4a34" },
  cloth: { base: "#8b6f9e", dark: "#65507a", light: "#b295c4", ink: "#f3ecf7" },
  coin: { base: "#d4a017", dark: "#a3760a", light: "#f2cf62", ink: "#6b4a05" },
};

const ICON_SYMBOL = {
  brick: (p) =>
    [0, 1, 2]
      .map((row) => {
        const y = 32 + row * 14;
        const offset = row % 2 ? 7 : 0;
        return [-1, 0]
          .map((col) => {
            const x = 22 + col * 27 + offset;
            return `<rect x="${x}" y="${y}" width="24" height="11" rx="2" fill="${p.ink}"/>
              <rect x="${x}" y="${y}" width="24" height="5" rx="2" fill="${p.light}" opacity="0.5"/>`;
          })
          .join("");
      })
      .join(""),

  wood: (p) =>
    `<g transform="rotate(-24 50 50)">
       <rect x="16" y="36" width="68" height="17" rx="8" fill="${p.ink}"/>
       <ellipse cx="80" cy="44.5" rx="7" ry="8.5" fill="${p.light}"/>
       <ellipse cx="80" cy="44.5" rx="3" ry="4" fill="${p.dark}"/>
       <rect x="16" y="55" width="56" height="15" rx="7" fill="${p.dark}"/>
       <ellipse cx="68" cy="62.5" rx="6" ry="7.5" fill="${p.light}" opacity="0.8"/>
     </g>`,

  wool: (p) =>
    `<path d="M32 66 v9 M62 66 v9" stroke="${p.dark}" stroke-width="6" stroke-linecap="round"/>
     <ellipse cx="46" cy="54" rx="27" ry="20" fill="${p.ink}"/>
     <circle cx="70" cy="45" r="12" fill="${p.dark}"/>
     <circle cx="74" cy="42" r="3" fill="${p.ink}"/>`,

  wheat: (p) =>
    [-14, 0, 14]
      .map((dx) => {
        const lean = dx * 0.35;
        return `<path d="M${50 + dx} 82 q${lean} -16 ${lean * 1.5} -30" stroke="${p.ink}"
                  stroke-width="5" fill="none" stroke-linecap="round"/>
                ${[0, 1, 2]
                  .map(
                    (k) =>
                      `<ellipse cx="${50 + dx + lean * 1.5}" cy="${48 - k * 11}" rx="7" ry="5.5"
                         fill="${p.light}" stroke="${p.ink}" stroke-width="2.5"/>`
                  )
                  .join("")}`;
      })
      .join(""),

  ore: (p) =>
    `<path d="M50 20 L78 40 L68 74 H32 L22 40 Z" fill="${p.dark}"/>
     <path d="M50 20 L78 40 L68 74 H50 Z" fill="${p.light}" opacity="0.55"/>
     <path d="M50 20 L58 44 L50 52 L42 44 Z" fill="${p.ink}" opacity="0.85"/>`,

  paper: (p) =>
    `<rect x="26" y="22" width="48" height="56" rx="4" fill="${p.light}" stroke="${p.ink}" stroke-width="3"/>
     ${[0, 1, 2, 3]
       .map((i) => `<path d="M36 ${36 + i * 11} h28" stroke="${p.ink}" stroke-width="3.5" stroke-linecap="round" opacity="0.6"/>`)
       .join("")}`,

  cloth: (p) =>
    `<rect x="20" y="34" width="60" height="32" rx="5" fill="${p.ink}" stroke="${p.dark}" stroke-width="3"/>
     <path d="M20 44 q15 8 30 0 t30 0" stroke="${p.dark}" stroke-width="4" fill="none"/>
     <path d="M20 56 q15 8 30 0 t30 0" stroke="${p.dark}" stroke-width="4" fill="none"/>`,

  coin: (p) =>
    `<circle cx="50" cy="50" r="27" fill="${p.light}" stroke="${p.ink}" stroke-width="4"/>
     <circle cx="50" cy="50" r="17" fill="none" stroke="${p.ink}" stroke-width="3" opacity="0.65"/>
     <path d="M50 36 v28 M43 43 h14 M43 57 h14" stroke="${p.ink}" stroke-width="4" stroke-linecap="round"/>`,
};

function icon(name) {
  const p = ICON_PALETTES[name];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <circle cx="${R}" cy="${R}" r="${R - 2}" fill="${p.base}" stroke="${p.dark}" stroke-width="4"/>
  <circle cx="${R}" cy="${R}" r="${R - 2}" fill="url(#g-${name})"/>
  <defs>
    <radialGradient id="g-${name}" cx="0.32" cy="0.26" r="0.85">
      <stop offset="0" stop-color="#fff" stop-opacity="0.22"/>
      <stop offset="0.6" stop-color="#fff" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.2"/>
    </radialGradient>
  </defs>
  ${ICON_SYMBOL[name](p)}
</svg>
`;
}

await mkdir(ICON_OUT_DIR, { recursive: true });
for (const name of Object.keys(ICON_PALETTES)) {
  await writeFile(`${ICON_OUT_DIR}/${name}.svg`, icon(name));
}
console.log(`wrote ${Object.keys(ICON_PALETTES).length} icons to ${ICON_OUT_DIR}`);
