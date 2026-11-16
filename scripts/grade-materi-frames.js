const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const inDir = path.join(__dirname, '..', 'public', 'materi-frames');
const tempDir = path.join(__dirname, '..', 'public', 'materi-frames-temp');

if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

async function gradeFrames() {
  console.log('Starting tone-matching color grading for 299 Materi frames to match Hero...');
  const t0 = Date.now();
  const totalFrames = 299;
  const concurrency = 6;
  const indices = Array.from({ length: totalFrames }, (_, i) => i + 1);

  for (let i = 0; i < indices.length; i += concurrency) {
    const chunk = indices.slice(i, i + concurrency);
    await Promise.all(
      chunk.map(async (frameNum) => {
        const num = String(frameNum).padStart(3, '0');
        const inFile = path.join(inDir, `frame-${num}.webp`);
        const outFile = path.join(tempDir, `frame-${num}.webp`);

        if (!fs.existsSync(inFile)) {
          console.warn(`File missing: ${inFile}`);
          return;
        }

        // Gaussian adaptive lift curve centered around frame 195 to counteract severe underexposure
        let lift = 1.0;
        if (frameNum > 60 && frameNum < 280) {
          const center = 195;
          const sigma = 55;
          const dist = Math.abs(frameNum - center);
          const factor = Math.exp(-Math.pow(dist / sigma, 2));
          lift = 1.0 + 0.32 * factor;
        } else if (frameNum >= 280) {
          lift = 1.12;
        }

        // Warm amber channel multipliers matching Hero library (more red/amber, reduced blue)
        const rMult = 1.035 * lift;
        const gMult = 1.000 * lift;
        const bMult = 0.940 * lift;

        await sharp(inFile)
          .linear([rMult, gMult, bMult], [0, 0, 0])
          .modulate({ saturation: 1.05 })
          .webp({ quality: 80, effort: 3 })
          .toFile(outFile);
      })
    );

    const progress = Math.min(100, Math.round(((i + chunk.length) / totalFrames) * 100));
    process.stdout.write(`\rGrading progress: ${progress}% (${Math.min(indices.length, i + chunk.length)}/${totalFrames})`);
  }

  console.log('\n\nReplacing original Materi frames with color-graded frames...');
  for (let f = 1; f <= totalFrames; f++) {
    const num = String(f).padStart(3, '0');
    const tempFile = path.join(tempDir, `frame-${num}.webp`);
    const targetFile = path.join(inDir, `frame-${num}.webp`);
    fs.copyFileSync(tempFile, targetFile);
    fs.unlinkSync(tempFile);
  }
  fs.rmdirSync(tempDir);

  const duration = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`Color grading completed successfully in ${duration}s!`);
}

gradeFrames().catch((err) => {
  console.error('Color grading failed:', err);
  process.exit(1);
});
