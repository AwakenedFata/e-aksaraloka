/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const PUBLIC_DIR = path.join(process.cwd(), "public");
const CONCURRENCY = 6;
const CLEAN_PNG = process.argv.includes("--clean-png");

const MOTION_WIDTH = 1600;
const MOTION_HEIGHT = 900;
const MOTION_WEBP_OPTIONS = { quality: 54, smartSubsample: true, effort: 6 };

const CRISP_WIDTH = 1920;
const CRISP_HEIGHT = 1080;
const CRISP_WEBP_OPTIONS = { quality: 82, smartSubsample: true, effort: 6 };

function formatMB(bytes) {
  return (bytes / (1024 * 1024)).toFixed(2);
}

/**
 * Loads an image file as a raw 3-channel RGB buffer (1920x1080).
 */
async function loadRgbBuffer(filePath) {
  const { data, info } = await sharp(filePath)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: info.channels };
}

/**
 * Computes sampled Mean Absolute Difference between two raw RGB buffers.
 */
function computeSampledMad(bufA, bufB, step = 16) {
  let sum = 0;
  let count = 0;
  for (let i = 0; i < bufA.length; i += step) {
    sum += Math.abs(bufA[i] - bufB[i]);
    count++;
  }
  return sum / Math.max(1, count);
}

/**
 * Linearly blends two raw RGB buffers: out = (1 - weightB) * bufA + weightB * bufB
 */
function blendBuffers(bufA, bufB, weightB) {
  const out = Buffer.allocUnsafe(bufA.length);
  const wA = 1 - weightB;
  for (let i = 0; i < bufA.length; i++) {
    out[i] = Math.round(bufA[i] * wA + bufB[i] * weightB);
  }
  return out;
}

/**
 * Scans lossless PNGs in a directory, drops exact pulldown duplicates (MAD === 0),
 * and optionally caps at `maxSourceIndex` (e.g. 231 for latihan-frames to remove
 * the 3-frame spatial overshoot past hallway-frames/frame-001).
 */
async function collectUniquePngs(dirName, maxSourceIndex = Infinity) {
  const dirPath = path.join(PUBLIC_DIR, dirName);
  const allPngFiles = fs
    .readdirSync(dirPath)
    .filter((f) => /^ezgif-frame-(\d+)\.png$/i.test(f))
    .sort((a, b) => {
      const na = parseInt(a.match(/(\d+)/)[1], 10);
      const nb = parseInt(b.match(/(\d+)/)[1], 10);
      return na - nb;
    });

  const pngFiles = allPngFiles.filter((f) => {
    const idx = parseInt(f.match(/(\d+)/)[1], 10);
    return idx <= maxSourceIndex;
  });

  const uniqueFiles = [];
  let prevBuf = null;

  for (const file of pngFiles) {
    const fullPath = path.join(dirPath, file);
    const { data } = await loadRgbBuffer(fullPath);
    if (prevBuf) {
      const mad = computeSampledMad(data, prevBuf, 16);
      if (mad === 0) {
        continue;
      }
    }
    prevBuf = data;
    uniqueFiles.push(fullPath);
  }

  return { uniqueFiles, allPngFiles };
}

/**
 * Hybrid Motion-vs-Static encoder:
 * - Bridge & final landing frames (`crispIndices`, 1-based local frame numbers) stay 1920x1080 @ quality 82.
 * - High-speed motion frames between bridges are downscaled to 1600x900 @ quality 54 (smartSubsample + effort 6).
 */
async function encodeFolder({
  dirName,
  sourceFiles,
  crispIndices,
  headAnchorBuffer,
  headBlendWeights,
  tailAnchorBuffer,
  tailBlendWeights,
}) {
  const dirPath = path.join(PUBLIC_DIR, dirName);
  const totalOut = sourceFiles.length;

  const existingWebps = fs
    .readdirSync(dirPath)
    .filter((f) => /^frame-(\d+)\.webp$/i.test(f));
  for (const f of existingWebps) {
    const num = parseInt(f.match(/(\d+)/)[1], 10);
    if (num > totalOut) {
      fs.unlinkSync(path.join(dirPath, f));
    }
  }

  let outputBytes = 0;
  let crispCount = 0;
  let motionCount = 0;
  let completed = 0;
  const startTime = Date.now();

  const jobs = sourceFiles.map((inFile, idx) => ({
    idx,
    localFrame: idx + 1,
    inFile,
    outFile: path.join(dirPath, `frame-${String(idx + 1).padStart(3, "0")}.webp`),
  }));

  async function worker(queue) {
    while (queue.length > 0) {
      const { idx, localFrame, inFile, outFile } = queue.shift();
      const isCrisp = crispIndices.has(localFrame);
      if (isCrisp) crispCount++;
      else motionCount++;

      let needRawBlend = false;
      let anchorBuf = null;
      let anchorWeight = 0;

      if (headAnchorBuffer && idx < headBlendWeights.length) {
        needRawBlend = true;
        anchorBuf = headAnchorBuffer;
        anchorWeight = headBlendWeights[idx];
      } else if (tailAnchorBuffer && idx >= totalOut - tailBlendWeights.length) {
        needRawBlend = true;
        anchorBuf = tailAnchorBuffer;
        const tailIdx = idx - (totalOut - tailBlendWeights.length);
        anchorWeight = tailBlendWeights[tailIdx];
      }

      let pipeline;
      if (needRawBlend && anchorBuf && anchorWeight > 0) {
        if (anchorWeight >= 1) {
          pipeline = sharp(anchorBuf, {
            raw: { width: CRISP_WIDTH, height: CRISP_HEIGHT, channels: 3 },
          });
        } else {
          const { data } = await loadRgbBuffer(inFile);
          const blended = blendBuffers(data, anchorBuf, anchorWeight);
          pipeline = sharp(blended, {
            raw: { width: CRISP_WIDTH, height: CRISP_HEIGHT, channels: 3 },
          });
        }
      } else {
        pipeline = sharp(inFile);
      }

      if (!isCrisp) {
        pipeline = pipeline
          .resize(MOTION_WIDTH, MOTION_HEIGHT)
          .webp(MOTION_WEBP_OPTIONS);
      } else {
        pipeline = pipeline.webp(CRISP_WEBP_OPTIONS);
      }

      await pipeline.toFile(outFile);

      outputBytes += fs.statSync(outFile).size;
      completed++;
      if (completed % 50 === 0 || completed === totalOut) {
        console.log(`  [${dirName}] ${completed}/${totalOut} hybrid-encoded`);
      }
    }
  }

  const queue = [...jobs];
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, () => worker(queue))
  );

  return {
    dirName,
    count: totalOut,
    crispCount,
    motionCount,
    outputMB: formatMB(outputBytes),
    avgKB: (outputBytes / totalOut / 1024).toFixed(1),
    elapsedSec: ((Date.now() - startTime) / 1000).toFixed(2),
  };
}

function removeRawPngs(dirName, allPngFiles) {
  const dirPath = path.join(PUBLIC_DIR, dirName);
  let removedBytes = 0;
  for (const file of allPngFiles) {
    const fullPath = path.join(dirPath, file);
    if (fs.existsSync(fullPath)) {
      removedBytes += fs.statSync(fullPath).size;
      fs.unlinkSync(fullPath);
    }
  }
  return {
    dirName,
    removedCount: allPngFiles.length,
    removedMB: formatMB(removedBytes),
  };
}

async function main() {
  console.log(
    `Step 1/4: Scanning lossless PNGs to strip pulldown duplicates & trim latihan overshoot (cleanPng=${CLEAN_PNG})...`
  );
  const [latihanScan, hallwayScan, studioScan] = await Promise.all([
    collectUniquePngs("latihan-frames", 231),
    collectUniquePngs("hallway-frames"),
    collectUniquePngs("studio-tulis-frames"),
  ]);

  const latihanFiles = latihanScan.uniqueFiles;
  const hallwayFiles = hallwayScan.uniqueFiles;
  const studioFiles = studioScan.uniqueFiles;

  console.log(
    `Unique frames retained: latihan=${latihanFiles.length}, hallway=${hallwayFiles.length}, studio-tulis=${studioFiles.length} (total=${
      latihanFiles.length + hallwayFiles.length + studioFiles.length
    })`
  );

  console.log("Step 2/4: Preparing 1920x1080 seam anchor buffers...");
  const heroEndPath = path.join(PUBLIC_DIR, "hero-frames", "frame-240.webp");
  const { data: hero240Buf } = await loadRgbBuffer(heroEndPath);
  const { data: latihanEndBuf } = await loadRgbBuffer(
    latihanFiles[latihanFiles.length - 1]
  );
  const { data: hallwayStartBuf } = await loadRgbBuffer(hallwayFiles[0]);
  const { data: hallwayEndBuf } = await loadRgbBuffer(
    hallwayFiles[hallwayFiles.length - 1]
  );
  const { data: studioStartBuf } = await loadRgbBuffer(studioFiles[0]);

  const latHallMidpoint = blendBuffers(latihanEndBuf, hallwayStartBuf, 0.5);
  const hallStudioMidpoint = blendBuffers(hallwayEndBuf, studioStartBuf, 0.5);

  console.log(
    `Step 3/4: Hybrid encoding (Motion=${MOTION_WIDTH}x${MOTION_HEIGHT}@q${MOTION_WEBP_OPTIONS.quality}, Bridge/Static=${CRISP_WIDTH}x${CRISP_HEIGHT}@q${CRISP_WEBP_OPTIONS.quality})...`
  );

  const results = [];
  // Global crisp bridge & static frames:
  // - latihan-frames (1..185): local 1 (global 1) & local 185 (global 185)
  results.push(
    await encodeFolder({
      dirName: "latihan-frames",
      sourceFiles: latihanFiles,
      crispIndices: new Set([1, latihanFiles.length]),
      headAnchorBuffer: hero240Buf,
      headBlendWeights: [1.0, 0.8, 0.6, 0.4, 0.22, 0.1],
      tailAnchorBuffer: latHallMidpoint,
      tailBlendWeights: [0.25, 0.55, 0.85],
    })
  );

  // - hallway-frames (186..373): local 1 (global 186) & local 188 (global 373)
  results.push(
    await encodeFolder({
      dirName: "hallway-frames",
      sourceFiles: hallwayFiles,
      crispIndices: new Set([1, hallwayFiles.length]),
      headAnchorBuffer: latHallMidpoint,
      headBlendWeights: [0.85, 0.65, 0.45, 0.28, 0.14],
      tailAnchorBuffer: hallStudioMidpoint,
      tailBlendWeights: [0.25, 0.55, 0.85],
    })
  );

  // - studio-tulis-frames (374..561): local 1 (global 374) & local 182..188 (global 555..561)
  const studioCrisp = new Set([1]);
  for (let local = studioFiles.length - 6; local <= studioFiles.length; local++) {
    if (local >= 1) studioCrisp.add(local);
  }
  results.push(
    await encodeFolder({
      dirName: "studio-tulis-frames",
      sourceFiles: studioFiles,
      crispIndices: studioCrisp,
      headAnchorBuffer: hallStudioMidpoint,
      headBlendWeights: [0.85, 0.65, 0.45, 0.28, 0.14],
      tailAnchorBuffer: null,
      tailBlendWeights: [],
    })
  );

  console.log("\nHybrid Latihan Sequence Summary:");
  let grandTotalMB = 0;
  for (const r of results) {
    grandTotalMB += parseFloat(r.outputMB);
    console.log(
      `- ${r.dirName}: ${r.count} frames (${r.crispCount} @1080p, ${r.motionCount} @900p) | ${r.outputMB} MB WebP (avg ${r.avgKB} KB/frame) in ${r.elapsedSec}s`
    );
  }
  console.log(`Total Latihan WebP Size: ${grandTotalMB.toFixed(2)} MB`);

  if (CLEAN_PNG) {
    console.log("\nStep 4/4: Removing unused raw ezgif-frame-*.png files...");
    const cleanupReports = [
      removeRawPngs("latihan-frames", latihanScan.allPngFiles),
      removeRawPngs("hallway-frames", hallwayScan.allPngFiles),
      removeRawPngs("studio-tulis-frames", studioScan.allPngFiles),
    ];
    let totalFreed = 0;
    for (const c of cleanupReports) {
      totalFreed += parseFloat(c.removedMB);
      console.log(`- Removed ${c.removedCount} PNGs (${c.removedMB} MB) from ${c.dirName}`);
    }
    console.log(`Total Raw PNG Storage Reclaimed: ${totalFreed.toFixed(2)} MB`);
  } else {
    console.log("\nStep 4/4 skipped (pass --clean-png to delete raw PNG sources).");
  }
}

main().catch((err) => {
  console.error("Optimization failed:", err);
  process.exit(1);
});
