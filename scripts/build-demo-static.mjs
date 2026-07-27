#!/usr/bin/env node
/**
 * Builds the static demo bundle into out/.
 *
 * Next.js refuses to run `output: "export"` while route handlers or proxy
 * middleware exist, because neither can be represented as a static file. The
 * demo never calls them — mockApi.ts answers every /api/* request in the
 * browser — so they are moved aside for the duration of the build and restored
 * afterwards, including on failure or Ctrl-C.
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const stash = join(root, ".demo-static-stash");

/** Paths that block static export, relative to the project root. */
const BLOCKING = [
  join("src", "app", "api"),
  join("src", "proxy.ts"),
];

const moved = [];

function stashPaths() {
  mkdirSync(stash, { recursive: true });
  for (const rel of BLOCKING) {
    const from = join(root, rel);
    if (!existsSync(from)) continue;
    const to = join(stash, rel.replace(/[\\/]/g, "__"));
    renameSync(from, to);
    moved.push({ from, to });
    console.log(`  stashed ${rel}`);
  }
}

function restorePaths() {
  for (const { from, to } of moved.reverse()) {
    if (!existsSync(to)) continue;
    mkdirSync(dirname(from), { recursive: true });
    renameSync(to, from);
    console.log(`  restored ${from.replace(root + "\\", "").replace(root + "/", "")}`);
  }
  moved.length = 0;
  rmSync(stash, { recursive: true, force: true });
}

// Restore even if the build is interrupted.
let cleanedUp = false;
const cleanup = () => {
  if (cleanedUp) return;
  cleanedUp = true;
  restorePaths();
};
process.on("SIGINT", () => { cleanup(); process.exit(130); });
process.on("SIGTERM", () => { cleanup(); process.exit(143); });

if (existsSync(stash)) {
  console.error(
    `\n${stash} already exists — a previous build was interrupted.\n` +
    `Move its contents back into src/ manually before rebuilding.\n`
  );
  process.exit(1);
}

console.log("Building static demo bundle…");
try {
  stashPaths();
  rmSync(join(root, "out"), { recursive: true, force: true });
  // .next/types holds generated route validators pointing at the stashed API
  // routes; a stale cache fails the build before it starts.
  rmSync(join(root, ".next"), { recursive: true, force: true });
  execSync("npx next build", {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, NEXT_PUBLIC_DEMO_MODE: "1", DEMO_STATIC: "1" },
  });
} finally {
  cleanup();
}

console.log("\nStatic demo written to out/");
