// The source uses extensionless relative imports (Vite resolves them); Node's ESM loader does
// not, so bundle the test files with esbuild first and hand the bundles to `node --test`.
import { build } from "esbuild";
import { glob } from "node:fs/promises";
import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";

// not under node_modules: `node --test` skips that directory when scanning for test files
const OUT_DIR = ".test-build";

const entryPoints = [];
for await (const file of glob("src/**/*.test.ts")) entryPoints.push(file);

if (entryPoints.length === 0) {
  console.error("no test files found");
  process.exit(1);
}

await rm(OUT_DIR, { recursive: true, force: true });
await build({
  entryPoints,
  bundle: true,
  platform: "node",
  format: "esm",
  outdir: OUT_DIR,
  outbase: "src",
  packages: "external",
});

// pass the bundles explicitly: `node --test <dir>` skips dot-directories when scanning
const built = [];
for await (const file of glob(`${OUT_DIR}/**/*.test.js`)) built.push(file);

const child = spawn("node", ["--test", ...built], { stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 1));
