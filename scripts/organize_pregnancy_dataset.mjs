#!/usr/bin/env node
/**
 * Organize the Label Studio pregnancy export into YOLO-ready datasets.
 *
 * Inputs (current project state):
 *   - images : dataset_sex/drive-download-20260805T144802Z-1-001/fem_preg (N).JPG
 *   - labels : dataset_pregnancy/Female_preg_labels/labels/{uuid}-fem_preg_N.txt
 *              (YOLO detection format: <class> <cx> <cy> <w> <h>, class 0 = "preg")
 *
 * Outputs:
 *   - dataset_detection/            YOLO DETECTION dataset (class 0 = "snail")
 *       images/train|val/*.jpg      renamed copies of the source photos
 *       labels/train|val/*.txt      matching YOLO boxes (class rewritten to 0/snail)
 *       data.yaml                   dataset config for ultralytics training
 *   - dataset_pregnancy/            YOLO CLASSIFICATION folders (train|val/pregnant)
 *       train/pregnant/*.jpg        the same photos (not_pregnant stays empty for now)
 *       val/pregnant/*.jpg
 *
 * Split is 80/20 train/val with a fixed seed — reproducible.
 * Run:  node scripts/organize_pregnancy_dataset.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ── Configuration ─────────────────────────────────────────────────────────
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC_IMG_DIR = path.join(ROOT, "dataset_sex", "drive-download-20260805T144802Z-1-001");
const SRC_LABEL_DIR = path.join(ROOT, "dataset_pregnancy", "Female_preg_labels", "labels");
const OUT_DET = path.join(ROOT, "dataset_detection"); // detection: images + labels + data.yaml
const OUT_CLS = path.join(ROOT, "dataset_pregnancy"); // classification: train|val/pregnant
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

/** Parse "fem_preg (12).JPG" → 12 */
function numFromImageName(name) {
  const m = name.match(/^fem_preg\s*\((\d+)\)/i);
  return m ? Number(m[1]) : null;
}

/** Parse "0077996e-fem_preg_9.txt" → 9 */
function numFromLabelName(name) {
  const m = name.match(/-fem_preg_(\d+)\.txt$/i);
  return m ? Number(m[1]) : null;
}

function pad(n) {
  return String(n).padStart(2, "0");
}

// ── Step 1: inventory images and labels ──────────────────────────────────
const imageFiles = fs.readdirSync(SRC_IMG_DIR).filter((f) => /\.jpe?g$/i.test(f));
const labelFiles = fs.readdirSync(SRC_LABEL_DIR).filter((f) => /\.txt$/i.test(f));

const imageByNum = new Map();
for (const f of imageFiles) {
  const n = numFromImageName(f);
  if (n != null) imageByNum.set(n, f);
}

const labelByNum = new Map();
for (const f of labelFiles) {
  const n = numFromLabelName(f);
  if (n != null) labelByNum.set(n, f);
}

const allNums = new Set([...imageByNum.keys(), ...labelByNum.keys()]);

const missingImage = [...labelByNum.keys()].filter((n) => !imageByNum.has(n));
const missingLabel = [...imageByNum.keys()].filter((n) => !labelByNum.has(n));

if (missingImage.length || missingLabel.length) {
  console.warn("⚠ Unpaired files will be SKIPPED:");
  if (missingImage.length) console.warn("  labels with no image :", missingImage.join(", "));
  if (missingLabel.length) console.warn("  images with no label:", missingLabel.join(", "));
}

// Only numbers with BOTH image and label make it into the dataset
const pairedNums = [...allNums].filter((n) => imageByNum.has(n) && labelByNum.has(n));
console.log(`✓ ${pairedNums.length} paired image+label pairs (${imageByNum.size} images, ${labelByNum.size} labels)`);

if (pairedNums.length === 0) {
  console.error("✗ Nothing to organize — no paired files.");
  process.exit(1);
}

// ── Step 2: deterministic 80/20 split ────────────────────────────────────
const nums = [...pairedNums].sort((a, b) => a - b);
const rand = mulberry32(SEED);
for (let i = nums.length - 1; i > 0; i--) {
  const j = Math.floor(rand() * (i + 1));
  [nums[i], nums[j]] = [nums[j], nums[i]];
}
const valCount = Math.max(1, Math.round(nums.length * VAL_RATIO));
const valNums = new Set(nums.slice(0, valCount));
const trainNums = nums.slice(valCount);

// ── Step 3: build detection dataset ──────────────────────────────────────
// Clean stale outputs first so re-runs are idempotent
const detDirs = [
  path.join(OUT_DET, "images", "train"),
  path.join(OUT_DET, "images", "val"),
  path.join(OUT_DET, "labels", "train"),
  path.join(OUT_DET, "labels", "val"),
];
for (const dir of detDirs) {
  fs.rmSync(dir, { recursive: true, force: true });
  ensureDir(dir);
}

let badBoxes = 0;
for (const n of nums) {
  const split = valNums.has(n) ? "val" : "train";
  const base = `fem_preg_${pad(n)}`;
  const srcImg = path.join(SRC_IMG_DIR, imageByNum.get(n));
  const dstImg = path.join(OUT_DET, "images", split, `${base}.jpg`);
  const srcLbl = path.join(SRC_LABEL_DIR, labelByNum.get(n));
  const dstLbl = path.join(OUT_DET, "labels", split, `${base}.txt`);

  fs.copyFileSync(srcImg, dstImg);

  // Rewrite each box: class token → 0 (snail), validate 0..1 coords
  const raw = fs.readFileSync(srcLbl, "utf8").trim();
  const lines = raw.split(/\r?\n/).filter((l) => l.trim() !== "");
  const outLines = lines.map((line) => {
    const parts = line.trim().split(/\s+/).map(Number);
    if (parts.length !== 5 || parts.some((p) => !Number.isFinite(p))) {
      badBoxes++;
      return null;
    }
    const [, cx, cy, w, h] = parts;
    if (cx < 0 || cx > 1 || cy < 0 || cy > 1 || w < 0 || w > 1 || h < 0 || h > 1) {
      badBoxes++;
      return null;
    }
    return `0 ${cx} ${cy} ${w} ${h}`;
  });
  fs.writeFileSync(dstLbl, outLines.filter(Boolean).join("\n") + "\n");
}
if (badBoxes) console.warn(`⚠ ${badBoxes} malformed box(es) skipped`);
else console.log("✓ all boxes valid, class rewritten to 0 (snail)");

fs.writeFileSync(
  path.join(OUT_DET, "data.yaml"),
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

// ── Step 4: populate classification folders ──────────────────────────────
const clsDirs = [
  path.join(OUT_CLS, "train", "pregnant"),
  path.join(OUT_CLS, "val", "pregnant"),
  path.join(OUT_CLS, "train", "not_pregnant"),
  path.join(OUT_CLS, "val", "not_pregnant"),
];
for (const dir of clsDirs) ensureDir(dir);
// Only clean the pregnant folders (not_pregnant may already hold photos)
for (const dir of [clsDirs[0], clsDirs[1]]) {
  fs.rmSync(dir, { recursive: true, force: true });
  ensureDir(dir);
}

for (const n of nums) {
  const split = valNums.has(n) ? "val" : "train";
  const base = `fem_preg_${pad(n)}`;
  const srcImg = path.join(SRC_IMG_DIR, imageByNum.get(n));
  const dstImg = path.join(OUT_CLS, split, "pregnant", `${base}.jpg`);
  fs.copyFileSync(srcImg, dstImg);
}

// ── Summary ──────────────────────────────────────────────────────────────
console.log(`\n✅ Dataset organized:`);
console.log(`  Detection  (dataset_detection/)  train=${trainNums.length}  val=${valCount}  class=${DET_CLASS_NAME}`);
console.log(`  Classifier (dataset_pregnancy/)  train/pregnant=${trainNums.length}  val/pregnant=${valCount}`);
console.log(`  not_pregnant folders left empty — collect those photos next.`);
console.log(`  \n  Next: upload dataset_detection/ (and dataset_sex/, dataset_pregnancy/ when ready) to Google Drive\n  and run colab/train_snail_pipeline.py in Colab.`);
