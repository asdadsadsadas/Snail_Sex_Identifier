#!/usr/bin/env node
/**
 * Organize the SECOND Label Studio pass (sex/pregnancy classification) into
 * YOLO classification training folders.
 *
 * After scripts/crop_snail_boxes.py produced dataset_labeling/ (snail crops
 * with the detector's train/val split baked into the folder structure), you
 * label those crops in Label Studio and export as JSON. This script routes
 * each labeled crop to:
 *
 *   dataset_sex/          train|val / {male, female} /
 *   dataset_pregnancy/    train|val / {pregnant, not_pregnant} /
 *
 * The split is NOT re-rolled here — it's inherited from the folder the crop
 * lives in (dataset_labeling/train|val/), so the classifier validation set is
 * the exact same photos the detector was validated on.
 *
 * Label Studio export shapes supported:
 *   - a bare array of tasks:   [ {id, data: {image}, annotations: [{result}]} ]
 *   - a wrapped object:        {annotations: [...]}  (or {tasks: [...]})
 *   - each result:             {from_name, value: {choices: ["Female"]}}
 *   - choices may be "Male"/"Female"/"Pregnant"/"Not Pregnant" (any case).
 *   - from_name may be "sex"/"pregnancy"/"preg" — used as a hint; if absent,
 *     the choice value itself decides the route.
 *
 * Usage:
 *   # Two exports (sex project + pregnancy project):
 *   node scripts/organize_classification_dataset.mjs \
 *     --sex-export export_sex.json --preg-export export_preg.json
 *
 *   # Or one combined export (results carry from_name):
 *   node scripts/organize_classification_dataset.mjs --export combined.json
 *
 *   # Custom crop folder:
 *   node scripts/organize_classification_dataset.mjs --images dataset_labeling --export out.json
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ── Configuration ─────────────────────────────────────────────────────────
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_IMAGES = path.join(ROOT, "dataset_labeling");
const OUT_SEX = path.join(ROOT, "dataset_sex"); // train|val / male|female
const OUT_PREG = path.join(ROOT, "dataset_pregnancy"); // train|val / pregnant|not_pregnant

// ── CLI args ──────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
function argValue(flag, fallback) {
  const i = argv.indexOf(flag);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
}
const IMAGES_DIR = argValue("--images", DEFAULT_IMAGES);
const SEX_EXPORT = argValue("--sex-export", "");
const PREG_EXPORT = argValue("--preg-export", "");
const COMBINED_EXPORT = argValue("--export", "");
// Overridable output root (useful for dry-run tests or scratch builds).
const OUT_ROOT = argValue("--out-root", ROOT);
const rebase = (p) => (OUT_ROOT === ROOT ? p : path.join(OUT_ROOT, path.relative(ROOT, p)));
const outSex = rebase(OUT_SEX);
const outPreg = rebase(OUT_PREG);

if (!SEX_EXPORT && !PREG_EXPORT && !COMBINED_EXPORT) {
  console.error(
    "✗ Nothing to organize — pass --sex-export, --preg-export and/or --export <label-studio.json>"
  );
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────
function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function loadExport(file) {
  if (!file) return [];
  if (!fs.existsSync(file)) {
    console.error(`✗ export file not found: ${file}`);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  // Bare array of tasks, or wrapped {annotations: [...]} / {tasks: [...]}
  if (Array.isArray(data)) return data;
  for (const key of ["annotations", "tasks"]) {
    if (Array.isArray(data[key])) return data[key];
  }
  console.error(`✗ unrecognized export shape in ${file} — expected array or {annotations: [...]}`);
  process.exit(1);
}

/** "Not Pregnant"/"not_pregnant" → "not_pregnant"; "Female" → "female" */
function normalizeChoice(raw) {
  return String(raw ?? "")
    .toLowerCase()
    .replace(/[^a-z]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Route a choice value (plus optional from_name hint) → {kind, cls} | null */
function route(choice, fromName) {
  const c = normalizeChoice(choice);
  const f = normalizeChoice(fromName ?? "");
  if (!c) return null;

  const isSex = f.includes("sex") || (f.includes("gender") && !f.includes("preg"));
  const isPreg = f.includes("preg");

  // Pregnancy: "pregnant" / "not_pregnant" (order matters — not_pregnant first)
  if (isPreg || /^not_preg/.test(c) || /^notpreg/.test(c)) {
    if (/^not/.test(c)) return { kind: "preg", cls: "not_pregnant" };
    if (/preg/.test(c)) return { kind: "preg", cls: "pregnant" };
    return null;
  }
  if (isSex || /male|female/.test(c)) {
    if (c.includes("female")) return { kind: "sex", cls: "female" };
    if (c.includes("male")) return { kind: "sex", cls: "male" };
    return null;
  }
  // No hint — infer from the value alone
  if (/^not/.test(c) && /preg/.test(c)) return { kind: "preg", cls: "not_pregnant" };
  if (/preg/.test(c)) return { kind: "preg", cls: "pregnant" };
  if (c.includes("female")) return { kind: "sex", cls: "female" };
  if (c.includes("male")) return { kind: "sex", cls: "male" };
  return null;
}

/** Find the crop file by basename inside {IMAGES_DIR}/{train|val}/. */
function findCrop(basename) {
  for (const split of ["train", "val"]) {
    const p = path.join(IMAGES_DIR, split, basename);
    if (fs.existsSync(p)) return { split, src: p };
  }
  return null;
}

// ── Load everything ───────────────────────────────────────────────────────
const tasks = [...loadExport(SEX_EXPORT), ...loadExport(PREG_EXPORT), ...loadExport(COMBINED_EXPORT)];
console.log(`✓ ${tasks.length} tasks loaded from export(s)`);

// ── Route each labeled crop ───────────────────────────────────────────────
const pairs = []; // { split, src, cls, base }
const skipped = [];
const seen = new Set(); // de-dup (same crop labeled in two exports)

for (const task of tasks) {
  const data = task?.data ?? {};
  const imageRef = data.image ?? data.photo ?? "";
  const basename = path.basename(String(imageRef));
  if (!basename) {
    skipped.push("task without data.image");
    continue;
  }
  const results = task?.annotations?.[0]?.result ?? [];
  const routes = [];
  for (const r of results) {
    const choices = r?.value?.choices ?? [];
    const first = Array.isArray(choices) ? choices[0] : choices;
    const hit = route(first, r?.from_name);
    if (hit) routes.push(hit);
  }
  if (routes.length === 0) {
    skipped.push(`${basename} (no recognizable sex/pregnancy choice)`);
    continue;
  }
  const found = findCrop(basename);
  if (!found) {
    skipped.push(`${basename} (no crop found in ${IMAGES_DIR}/) — is it from this pass?`);
    continue;
  }
  for (const r of routes) {
    const key = `${found.split}/${r.cls}/${basename}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push({ kind: r.kind, split: found.split, src: found.src, cls: r.cls, base: path.parse(basename).name });
  }
}

// ── Write datasets ─────────────────────────────────────────────────────────
function buildClassifier(root, kindPairs, label) {
  const dirs = new Set(kindPairs.map((p) => path.join(root, p.split, p.cls)));
  for (const dir of dirs) {
    fs.rmSync(dir, { recursive: true, force: true });
    ensureDir(dir);
  }
  for (const p of kindPairs) {
    fs.copyFileSync(p.src, path.join(root, p.split, p.cls, `${p.base}.jpg`));
  }
  const counts = {};
  for (const p of kindPairs) {
    counts[p.cls] = (counts[p.cls] || 0) + 1;
  }
  return counts;
}

const sexPairs = pairs.filter((p) => p.kind === "sex");
const pregPairs = pairs.filter((p) => p.kind === "preg");
console.log("Classification datasets:");
const sexCounts = buildClassifier(outSex, sexPairs, "dataset_sex/");
const pregCounts = buildClassifier(outPreg, pregPairs, "dataset_pregnancy/");

// ── Summary ───────────────────────────────────────────────────────────────
console.log(`\n✅ Organized:`, sexPairs.length ? `\n  Sex (dataset_sex/):` : `\n  Sex (dataset_sex/):  none — no male/female choices found`);
for (const [cls, n] of Object.entries(sexCounts).sort()) console.log(`    ${cls}: ${n}`);
console.log(pregPairs.length ? `  Pregnancy (dataset_pregnancy/):` : `  Pregnancy (dataset_pregnancy/):  none — no pregnancy choices found`);
for (const [cls, n] of Object.entries(pregCounts).sort()) console.log(`    ${cls}: ${n}`);

if (skipped.length) {
  console.log(`\n⚠ ${skipped.length} task(s) skipped:`);
  for (const s of skipped.slice(0, 10)) console.log(`   - ${s}`);
  if (skipped.length > 10) console.log(`   … and ${skipped.length - 10} more`);
}

const warn = (msg) => console.log(`\n⚠ ${msg}`);
if (!sexCounts.male) warn('no "male" photos yet — sex model will only know one class.');
if (!sexCounts.female) warn('no "female" photos yet — sex model will only know one class.');
if (!pregCounts.not_pregnant) warn('no "not_pregnant" photos yet — pregnancy model will only know one class.');
if (!pregCounts.pregnant) warn('no "pregnant" photos yet — pregnancy model will only know one class.');

console.log(`\n  Next: zip dataset_sex/ and dataset_pregnancy/, upload to Drive, and run\n  colab/train_snail_pipeline.py in Colab (cells 4 & 5 train the classifiers).`);
