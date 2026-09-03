// The source uses extensionless relative imports (Vite resolves them); Node's ESM loader does
// not, so bundle the test files with esbuild first and hand the bundles to `node --test`.
import { build } from "esbuild";
import { readdir, rm } from "node:fs/promises";
import { basename, join } from "node:path";
import { spawn } from "node:child_process";

async function walkFiles(dir, predicate) {
  const matches = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      matches.push(...(await walkFiles(fullPath, predicate)));
      continue;
    }

    if (entry.isFile() && predicate(fullPath)) {
      matches.push(fullPath);
    }
  }

  return matches;
}

// not under node_modules: `node --test` skips that directory when scanning for test files
const OUT_DIR = ".test-build";
const entryPoints = await walkFiles("src", (file) => file.endsWith(".test.ts"));

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
const built = await walkFiles(OUT_DIR, (file) => file.endsWith(".test.js"));

const child = spawn("node", ["--test", ...built], { stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 1));
