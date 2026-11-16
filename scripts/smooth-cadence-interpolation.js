const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function processDirectory(dirName, totalFrames) {
  const dir = path.join(__dirname, '..', 'public', dirName);
  console.log(`\nScanning ${dirName} (${totalFrames} frames) for duplicate hold-frames (cadence stutter)...`);

  const duplicates = [];

  // 1. Detect all consecutive duplicate pairs
  for (let f = 1; f < totalFrames; f++) {
    const f1Str = String(f).padStart(3, '0');
    const f2Str = String(f + 1).padStart(3, '0');
    const p1 = path.join(dir, `frame-${f1Str}.webp`);
    const p2 = path.join(dir, `frame-${f2Str}.webp`);

    if (!fs.existsSync(p1) || !fs.existsSync(p2)) continue;

    // Quick size comparison
    const s1 = fs.statSync(p1).size;
    const s2 = fs.statSync(p2).size;
    if (s1 === s2) {
      const b1 = fs.readFileSync(p1);
      const b2 = fs.readFileSync(p2);
      if (b1.equals(b2)) {
        duplicates.push(f + 1); // Frame (f+1) is a duplicate of frame f
      }
    }
  }

  console.log(`Found ${duplicates.length} duplicate freeze-frames in ${dirName}.`);

  if (duplicates.length === 0) return;

  // 2. Interpolate each duplicate frame: Frame[dup] = 0.5 * Frame[dup - 1] + 0.5 * Frame[dup + 1]
  let interpolatedCount = 0;
  for (const dupFrame of duplicates) {
    const prevFrame = dupFrame - 1;
    const nextFrame = dupFrame + 1;

    if (nextFrame > totalFrames) continue;

    const prevPath = path.join(dir, `frame-${String(prevFrame).padStart(3, '0')}.webp`);
    const dupPath = path.join(dir, `frame-${String(dupFrame).padStart(3, '0')}.webp`);
    const nextPath = path.join(dir, `frame-${String(nextFrame).padStart(3, '0')}.webp`);

    if (!fs.existsSync(prevPath) || !fs.existsSync(nextPath)) continue;

    const prevRaw = await sharp(prevPath).raw().toBuffer();
    const nextRaw = await sharp(nextPath).raw().toBuffer();

    const interpRaw = Buffer.alloc(prevRaw.length);
    for (let i = 0; i < prevRaw.length; i++) {
      interpRaw[i] = Math.round((prevRaw[i] + nextRaw[i]) / 2);
    }

    const interpWebp = await sharp(interpRaw, {
      raw: { width: 1920, height: 1080, channels: 3 },
    })
      .webp({ quality: 82, effort: 3 })
      .toBuffer();

    fs.writeFileSync(dupPath, interpWebp);
    interpolatedCount++;
  }

  console.log(`✓ Successfully interpolated ${interpolatedCount} freeze-frames in ${dirName} into continuous motion!`);
}

async function main() {
  const t0 = Date.now();
  console.log('=== Aksaraloka Image Sequence Cadence Motion Interpolator ===');

  await processDirectory('hero-frames', 240);
  await processDirectory('materi-frames', 299);
  await processDirectory('reading-frames', 537);

  const duration = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n=== All cadence freeze-frames successfully interpolated in ${duration}s! ===`);
}

main().catch(console.error);
