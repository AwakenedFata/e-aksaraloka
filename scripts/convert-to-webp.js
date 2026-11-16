const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const inDir = path.join(__dirname, '..', 'public', 'hero_frame');
const outDir = path.join(__dirname, '..', 'public', 'hero_frame_webp');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function convertAll() {
  console.log('Starting WebP conversion for 240 frames...');
  const t0 = Date.now();
  let totalInSize = 0;
  let totalOutSize = 0;

  const totalFrames = 240;
  const concurrency = 6;
  const indices = Array.from({ length: totalFrames }, (_, i) => i + 1);

  for (let i = 0; i < indices.length; i += concurrency) {
    const chunk = indices.slice(i, i + concurrency);
    await Promise.all(
      chunk.map(async (frameNum) => {
        const num = String(frameNum).padStart(3, '0');
        const inFile = path.join(inDir, `ezgif-frame-${num}.png`);
        const outFile = path.join(outDir, `frame-${num}.webp`);
        const outCompatFile = path.join(outDir, `ezgif-frame-${num}.webp`);

        if (!fs.existsSync(inFile)) {
          console.warn(`Missing: ${inFile}`);
          return;
        }

        const inSize = fs.statSync(inFile).size;
        totalInSize += inSize;

        // Convert to WebP Full HD (1920x1080) at quality 78 with effort 3
        await sharp(inFile)
          .webp({ quality: 78, effort: 3 })
          .toFile(outFile);

        // Also create compat copy / symlink if needed
        try {
          fs.copyFileSync(outFile, outCompatFile);
        } catch {
          // ignore
        }

        const outSize = fs.statSync(outFile).size;
        totalOutSize += outSize;
      })
    );

    const progress = Math.min(100, Math.round(((i + chunk.length) / totalFrames) * 100));
    process.stdout.write(`\rProgress: ${progress}% (${Math.min(indices.length, i + chunk.length)}/${totalFrames})`);
  }

  const duration = ((Date.now() - t0) / 1000).toFixed(1);
  console.log('\n\n--- WebP Conversion Summary ---');
  console.log(`Frames converted: ${totalFrames}`);
  console.log(`Original PNG size: ${(totalInSize / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`Optimized WebP size: ${(totalOutSize / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`Bandwidth savings: ${((1 - totalOutSize / totalInSize) * 100).toFixed(1)}%`);
  console.log(`Total duration: ${duration}s`);
}

convertAll().catch((err) => {
  console.error('Error during conversion:', err);
  process.exit(1);
});
