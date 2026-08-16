#!/usr/bin/env node
/**
 * Organize a Label Studio YOLO export into YOLO-ready training datasets.
 *
 * Inputs (defaults point at the current all_snail + labels_snail export):
 *   - images  : folder of photos (Label Studio shows these; you labeled them)
 *   - labels  : folder of .txt boxes in YOLO format: <class_id> <cx> <cy> <w> <h>
 *   - classes : classes.txt mapping class_id -> name (from the Label Studio export)
 *
 * Labels and images are matched by filename — the export names each label
 * "<uuid>-<image_stem>.txt" (e.g. image "fem_preg (12).JPG" -> label
 * "0077996e-fem_preg_12.txt", or "snail (5).JPG" -> "0c3ab12d-snail_5.txt"),
 * so any image naming works. Images without a matching label are skipped.
 *
 * Outputs (built from every labeled image, one deterministic 80/20 split):
 *   - dataset_detection/     YOLO DETECTION dataset — class 0 = "snail".
 *       Every box becomes a snail box (the detector just finds snails).
 *       images/train|val/*.jpg, labels/train|val/*.txt, data.yaml
 *   - dataset_pregnancy/     YOLO CLASSIFICATION folders — only for images
 *       whose box class is a pregnancy label ("preg" -> pregnant,
 *       "not_preg"/"not preg"/"notpreg" -> not_pregnant). train|val/<class>/
 *   - dataset_sex/           YOLO CLASSIFICATION folders — only for images
 *       whose box class is a sex label ("male"/"female"). train|val/<class>/
 *
 * Run:
 *   # Defaults (all_snail photos + labels_snail export):
 *   node scripts/organize_pregnancy_dataset.mjs
 *
 *   # Or point at any other photos/labels:
 *   node scripts/organize_pregnancy_dataset.mjs \
 *     --images some/photos \
 *     --labels some/export/labels \
 *     --classes some/export/classes.txt
 *
 * Note: run scripts/exif_fix_dataset.py --max-size 1280 on the photos BEFORE
 * labeling (--src-dir mode) so Label Studio's boxes match the training pixels.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ── Configuration ─────────────────────────────────────────────────────────
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULTS = {
  images: path.join(ROOT, "all_snail", "ทั้งหมดด"),
  labels: path.join(ROOT, "labels_snail", "labels"),
  classes: path.join(ROOT, "labels_snail", "classes.txt"),
};
const OUT_DET = path.join(ROOT, "dataset_detection"); // detection: images + labels + data.yaml
const OUT_CLS = path.join(ROOT, "dataset_pregnancy"); // classification: train|val/pregnant|not_pregnant
const OUT_SEX = path.join(ROOT, "dataset_sex"); // classification: train|val/male|female
// Overridable output root (useful for dry-run tests or scratch builds).
const VAL_RATIO = 0.2; // 20% of images go to validation
const SEED = 42; // fixed seed → reproducible split
const DET_CLASS_NAME = "snail"; // detector class — it just finds the snail

// ── Tiny deterministic PRNG (mulberry32) ─────────────────────────────────
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────
function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/** "fem_preg (12).JPG" / "snail (5).JPG" → canonical "fempreg12" / "snail5" */
function canonical(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** Label export names look like "0077996e-fem_preg_12.txt" — strip the uuid. */
function stripUuidPrefix(stem) {
  return stem.replace(/^[0-9a-f]{8,}-/i, "");
}

function numFromImageName(name) {
  const m = name.match(/\((\d+)\)/);
  return m ? Number(m[1]) : null;
}

function pad(n) {
  return String(n).padStart(2, "0");
}

// ── CLI args ──────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
function argValue(flag, fallback) {
  const i = argv.indexOf(flag);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
}
const SRC_IMG_DIR = argValue("--images", DEFAULTS.images);
const SRC_LABEL_DIR = argValue("--labels", DEFAULTS.labels);
const SRC_CLASSES = argValue("--classes", DEFAULTS.classes);
const OUT_ROOT = argValue("--out-root", ROOT); // test/scratch output root
// (OUT_DET/OUT_CLS/OUT_SEX are rebased under OUT_ROOT below)
const rebase = (p) => (OUT_ROOT === ROOT ? p : path.join(OUT_ROOT, path.relative(ROOT, p)));
const detRoot = rebase(OUT_DET), clsRoot = rebase(OUT_CLS), sexRoot = rebase(OUT_SEX);

// ── Step 0: class id → name from classes.txt ─────────────────────────────
const classNames = new Map(); // id -> name
if (fs.existsSync(SRC_CLASSES)) {
  fs.readFileSync(SRC_CLASSES, "utf8")
    .split(/\r?\n/)
    .forEach((line, i) => {
      const name = line.trim();
      if (name) classNames.set(i, name);
    });
}
if (classNames.size === 0) {
  console.warn("⚠ classes.txt not found/empty — assuming class 0 = 'snail'");
  classNames.set(0, "snail");
}
console.log("Class map:", [...classNames.entries()].map(([i, n]) => `${i}->${n}`).join(", "));

// ── Step 1: inventory images and labels ──────────────────────────────────
const imageFiles = fs.readdirSync(SRC_IMG_DIR).filter((f) => /\.(jpe?g|mpo|png)$/i.test(f));
const labelFiles = fs.readdirSync(SRC_LABEL_DIR).filter((f) => /\.txt$/i.test(f));

// Look up an image by canonical stem, and by its "base + (N)" number.
const imageByCanon = new Map();
const imageByNum = new Map(); // `${canonicalBase}:${N}` -> filename
for (const f of imageFiles) {
  const stem = path.basename(f, path.extname(f));
  imageByCanon.set(canonical(stem), f);
  const n = numFromImageName(stem);
  if (n != null) imageByNum.set(`${canonical(stem.replace(/\(\d+\)/, ""))}:${n}`, f);
}

// Match each label file to its image.
const labelMatches = []; // { image, labelFile, lines: [{cls, cx, cy, w, h, name}] }
const unmatchedLabels = [];
for (const f of labelFiles) {
  const stem = path.basename(f, path.extname(f));
  const cleaned = stripUuidPrefix(stem);
  let img = imageByCanon.get(canonical(cleaned));
  if (!img) {
    // fallback: label ends with "_N" (e.g. "…-snail_5" → image "snail (5)")
    const m = cleaned.match(/_(\d+)$/);
    if (m) img = imageByNum.get(`${canonical(cleaned.replace(/_\d+$/, ""))}:${Number(m[1])}`);
  }
  if (!img) {
    unmatchedLabels.push(f);
    continue;
  }
  const lines = fs
    .readFileSync(path.join(SRC_LABEL_DIR, f), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "")
    .map((line) => {
      const parts = line.trim().split(/\s+/).map(Number);
      if (parts.length !== 5 || parts.some((p) => !Number.isFinite(p))) return null;
      const [cls, cx, cy, w, h] = parts;
      if (cx < 0 || cx > 1 || cy < 0 || cy > 1 || w < 0 || w > 1 || h < 0 || h > 1) return null;
      return { cls, cx, cy, w, h, name: classNames.get(cls) ?? `class${cls}` };
    })
    .filter(Boolean);
  if (lines.length > 0) labelMatches.push({ image: img, labelFile: f, lines });
}

if (unmatchedLabels.length) {
  console.warn(`⚠ ${unmatchedLabels.length} label(s) had no matching image, skipped:`, unmatchedLabels.slice(0, 5).join(", "));
}
console.log(`✓ ${labelMatches.length} labeled images matched (${imageFiles.length} images in folder)`);

if (labelMatches.length === 0) {
  console.error("✗ Nothing to organize — no matched label/image pairs.");
  process.exit(1);
}

// ── Step 2: deterministic 80/20 split over the matched images ────────────
const names = labelMatches.map((m) => m.image).sort();
const rand = mulberry32(SEED);
for (let i = names.length - 1; i > 0; i--) {
  const j = Math.floor(rand() * (i + 1));
  [names[i], names[j]] = [names[j], names[i]];
}
const valCount = Math.max(1, Math.round(names.length * VAL_RATIO));
const valNames = new Set(names.slice(0, valCount));
const byName = new Map(labelMatches.map((m) => [m.image, m]));

// "snail (291).JPG" → "snail_291" (collapse separators, no leading/trailing _)
const cleanStem = (f) =>
  path
    .basename(f, path.extname(f))
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

// ── Step 3: build detection dataset (every box → class 0 "snail") ───────
const detDirs = [
  path.join(detRoot, "images", "train"),
  path.join(detRoot, "images", "val"),
  path.join(detRoot, "labels", "train"),
  path.join(detRoot, "labels", "val"),
];
for (const dir of detDirs) {
  fs.rmSync(dir, { recursive: true, force: true });
  ensureDir(dir);
}

let detTrain = 0;
let detVal = 0;
for (const f of names) {
  const split = valNames.has(f) ? "val" : "train";
  const base = cleanStem(f);
  fs.copyFileSync(
    path.join(SRC_IMG_DIR, f),
    path.join(detRoot, "images", split, `${base}.jpg`)
  );
  const lines = byName.get(f).lines.map((l) => `0 ${l.cx} ${l.cy} ${l.w} ${l.h}`);
  fs.writeFileSync(path.join(detRoot, "labels", split, `${base}.txt`), lines.join("\n") + "\n");
  split === "val" ? detVal++ : detTrain++;
}

fs.writeFileSync(
  path.join(detRoot, "data.yaml"),
  [
    `# Snail detector dataset — generated by scripts/organize_pregnancy_dataset.mjs`,
    `path: ../dataset_detection`,
    `train: images/train`,
    `val: images/val`,
    ``,
    `names:`,
    `  0: ${DET_CLASS_NAME}`,
    ``,
  ].join("\n")
);

// ── Step 4: classification datasets (routed by box class name) ──────────
function routeClass(name) {
  if (/not[\s_-]?preg/i.test(name)) return { kind: "preg", cls: "not_pregnant" };
  if (/preg/i.test(name)) return { kind: "preg", cls: "pregnant" };
  // Order matters: "female" contains "male" → check female first.
  if (/female/i.test(name)) return { kind: "sex", cls: "female" };
  if (/male/i.test(name)) return { kind: "sex", cls: "male" };
  return null;
}

function buildClassifier(root, pairs, label) {
  // pairs: [{ split: "train"|"val", src: path, cls: "pregnant"|... , base }]
  const used = new Set();
  const dirs = [...new Set(pairs.map((p) => path.join(root, p.split, p.cls)))];
  for (const dir of dirs) {
    fs.rmSync(dir, { recursive: true, force: true });
    ensureDir(dir);
  }
  for (const p of pairs) {
    const dst = path.join(root, p.split, p.cls, `${p.base}.jpg`);
    fs.copyFileSync(p.src, dst);
    used.add(p.cls);
  }
  return used;
  const counts = {};
  for (const p of pairs) counts[p.cls] = (counts[p.cls] || 0) + 1;
  const detail = Object.entries(counts).map(([c, n]) => `${c}=${n}`).join(", ");
  if (pairs.length > 0) console.log(`  ${label}: ${detail}  (${pairs.length} images)`);
  return used;
}

const clsPairs = [];
const sexPairs = [];
for (const f of names) {
  const split = valNames.has(f) ? "val" : "train";
  const src = path.join(SRC_IMG_DIR, f);
  const base = cleanStem(f);
  for (const line of byName.get(f).lines) {
    const route = routeClass(line.name);
    if (!route) continue;
    (route.kind === "preg" ? clsPairs : sexPairs).push({
      split,
      src,
      cls: route.cls,
      base,
    });
  }
}

console.log("Classification datasets:");
const clsUsed = buildClassifier(clsRoot, clsPairs, "dataset_pregnancy/");
const sexUsed = buildClassifier(sexRoot, sexPairs, "dataset_sex/");

// ── Summary ──────────────────────────────────────────────────────────────
console.log(`\n✅ Dataset organized:`);
console.log(`  Detection   (dataset_detection/)  train=${detTrain}  val=${detVal}  class=${DET_CLASS_NAME}`);
if (clsUsed.size) console.log(`  Pregnancy   (dataset_pregnancy/)  ${[...clsUsed].sort().join(" / ")}`);
else console.log(`  Pregnancy   (dataset_pregnancy/)  none — no pregnancy-class boxes found`);
if (sexUsed.size) console.log(`  Sex         (dataset_sex/)         ${[...sexUsed].sort().join(" / ")}`);
else console.log(`  Sex         (dataset_sex/)         none — no male/female boxes found`);
if (clsUsed.size && !clsUsed.has("not_pregnant")) {
  console.log(`\n  ⚠ no "not_pregnant" photos yet — pregnancy model will only know one class.`);
}
console.log(`  \n  Next: upload dataset_detection/ (and dataset_pregnancy/, dataset_sex/ when\n  ready) to Google Drive and run colab/train_snail_pipeline.py in Colab.`);
