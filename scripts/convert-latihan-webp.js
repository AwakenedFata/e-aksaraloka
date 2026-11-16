/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const TARGET_DIRS = [
  "latihan-frames",
  "hallway-frames",
  "studio-tulis-frames",
];

const CONCURRENCY = 6;
const WEBP_OPTIONS = { quality: 78, effort: 3 };
const cleanPng = process.argv.includes("--clean-png");

function formatMB(bytes) {
  return (bytes / (1024 * 1024)).toFixed(2);
}

async function convertDirectory(dirName) {
  const dirPath = path.join(process.cwd(), "public", dirName);
  if (!fs.existsSync(dirPath)) {
    throw new Error(`Missing directory: ${dirPath}`);
  }

  const pngFiles = fs
    .readdirSync(dirPath)
    .filter((f) => /^ezgif-frame-(\d+)\.png$/i.test(f))
    .sort((a, b) => {
      const na = parseInt(a.match(/(\d+)/)[1], 10);
      const nb = parseInt(b.match(/(\d+)/)[1], 10);
      return na - nb;
    });

  if (pngFiles.length === 0) {
    throw new Error(`No ezgif-frame-*.png files found in ${dirPath}`);
  }

  // Verify contiguous 1..N numbering before encoding
  for (let i = 0; i < pngFiles.length; i++) {
    const num = parseInt(pngFiles[i].match(/(\d+)/)[1], 10);
    if (num !== i + 1) {
      throw new Error(
        `Non-contiguous numbering in ${dirName}: expected ${i + 1}, got ${pngFiles[i]}`
      );
    }
  }

  let inputBytes = 0;
  let outputBytes = 0;
  let completed = 0;
  const startTime = Date.now();

  const tasks = pngFiles.map((file, idx) => {
    const num = String(idx + 1).padStart(3, "0");
    return {
      inFile: path.join(dirPath, file),
      outFile: path.join(dirPath, `frame-${num}.webp`),
    };
  });

  async function worker(queue) {
    while (queue.length > 0) {
      const { inFile, outFile } = queue.shift();
      const inStat = fs.statSync(inFile);
      inputBytes += inStat.size;

      await sharp(inFile).webp(WEBP_OPTIONS).toFile(outFile);

      const outStat = fs.statSync(outFile);
      outputBytes += outStat.size;
      completed++;

      if (cleanPng) {
        fs.unlinkSync(inFile);
      }

      if (completed % 50 === 0 || completed === tasks.length) {
        console.log(`  [${dirName}] ${completed}/${tasks.length} converted`);
      }
    }
  }

  const queue = [...tasks];
  const workers = Array.from(
    { length: Math.min(CONCURRENCY, tasks.length) },
    () => worker(queue)
  );
  await Promise.all(workers);

  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(2);
  const reductionPct = (((inputBytes - outputBytes) / inputBytes) * 100).toFixed(1);

  return {
    dirName,
    count: tasks.length,
    inputMB: formatMB(inputBytes),
    outputMB: formatMB(outputBytes),
    avgKB: (outputBytes / tasks.length / 1024).toFixed(1),
    reductionPct,
    elapsedSec,
  };
}

async function main() {
  console.log(
    `Starting WebP conversion (quality=${WEBP_OPTIONS.quality}, effort=${WEBP_OPTIONS.effort}, cleanPng=${cleanPng})...`
  );
  const totalStart = Date.now();
  const summaries = [];

  for (const dirName of TARGET_DIRS) {
    summaries.push(await convertDirectory(dirName));
  }

  const totalSec = ((Date.now() - totalStart) / 1000).toFixed(2);
  console.log("\nConversion Summary:");
  for (const s of summaries) {
    console.log(
      `- ${s.dirName}: ${s.count} frames | ${s.inputMB} MB PNG -> ${s.outputMB} MB WebP (avg ${s.avgKB} KB/frame, -${s.reductionPct}%) in ${s.elapsedSec}s`
    );
  }
  console.log(`Total elapsed: ${totalSec}s`);
}

main().catch((err) => {
  console.error("Conversion failed:", err);
  process.exit(1);
});
