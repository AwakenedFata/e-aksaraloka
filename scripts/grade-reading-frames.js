const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const materi299Path = path.join(__dirname, '..', 'public', 'materi-frames', 'frame-299.webp');
const readingDir = path.join(__dirname, '..', 'public', 'reading-frames');
const tempDir = path.join(__dirname, '..', 'public', 'reading-frames-graded-temp');

if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

async function gradeReadingFrames() {
  console.log('--- Harmonizing Reading Frames Color Tone to Match Materi 299 ---');
  const t0 = Date.now();
  const totalFrames = 537;
  const concurrency = 8;

  if (!fs.existsSync(materi299Path)) {
    throw new Error(`Materi bridge frame not found at: ${materi299Path}`);
  }

  // 1. Frame 001 becomes an EXACT clone of Materi Frame 299 (0.00% difference guaranteed)
  const tempF1 = path.join(tempDir, 'frame-001.webp');
  fs.copyFileSync(materi299Path, tempF1);
  console.log('✓ Cloned Materi Frame 299 to Reading Frame 001 (0.00% delta guaranteed)');

  // Pre-load Materi 299 raw buffer for smooth cross-fading frames 002-008
  const m299Buf = fs.readFileSync(materi299Path);
  const m299Raw = await sharp(m299Buf).raw().toBuffer();

  // Blend weights for frames 2 through 8
  const blendWeights = {
    2: 0.85,
    3: 0.70,
    4: 0.55,
    5: 0.40,
    6: 0.25,
    7: 0.12,
  };

  // Color grading multipliers matching Hero and Materi warm library amber
  const rMult = 1.035;
  const gMult = 1.000;
  const bMult = 0.940;
  const saturation = 1.05;

  const frameIndices = Array.from({ length: totalFrames - 1 }, (_, i) => i + 2); // Frames 2 to 537

  for (let i = 0; i < frameIndices.length; i += concurrency) {
    const chunk = frameIndices.slice(i, i + concurrency);
    await Promise.all(
      chunk.map(async (frameNum) => {
        const num = String(frameNum).padStart(3, '0');
        const inFile = path.join(readingDir, `frame-${num}.webp`);
        const outFile = path.join(tempDir, `frame-${num}.webp`);

        if (!fs.existsSync(inFile)) {
          console.warn(`File missing: ${inFile}`);
          return;
        }

        // Apply color grading to match warm amber library tone
        let gradedBuf = await sharp(inFile)
          .linear([rMult, gMult, bMult], [0, 0, 0])
          .modulate({ saturation })
          .toBuffer();

        // If this frame is within the initial blend window (2-7), blend with Materi 299
        if (blendWeights[frameNum] !== undefined) {
          const w = blendWeights[frameNum];
          const gradedRaw = await sharp(gradedBuf).raw().toBuffer();
          const blendedRaw = Buffer.alloc(m299Raw.length);

          for (let p = 0; p < m299Raw.length; p++) {
            blendedRaw[p] = Math.round(m299Raw[p] * w + gradedRaw[p] * (1 - w));
          }

          gradedBuf = await sharp(blendedRaw, { raw: { width: 1920, height: 1080, channels: 3 } })
            .webp({ quality: 82, effort: 3 })
            .toBuffer();
        } else {
          // Re-encode graded buffer to WebP Q82
          gradedBuf = await sharp(gradedBuf)
            .webp({ quality: 82, effort: 3 })
            .toBuffer();
        }

        fs.writeFileSync(outFile, gradedBuf);
      })
    );

    const progress = Math.min(100, Math.round(((i + chunk.length) / (totalFrames - 1)) * 100));
    process.stdout.write(`\rGrading progress: ${progress}% (${Math.min(totalFrames - 1, i + chunk.length)}/${totalFrames - 1})`);
  }

  console.log('\n\nReplacing original Reading frames with color-graded frames...');
  for (let f = 1; f <= totalFrames; f++) {
    const num = String(f).padStart(3, '0');
    const tempFile = path.join(tempDir, `frame-${num}.webp`);
    const targetFile = path.join(readingDir, `frame-${num}.webp`);
    if (fs.existsSync(tempFile)) {
      fs.copyFileSync(tempFile, targetFile);
      fs.unlinkSync(tempFile);
    }
  }

  try {
    fs.rmdirSync(tempDir);
  } catch {
    // Ignore rmdir error if already empty
  }

  const duration = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\nAll 537 Reading frames successfully harmonized and color-graded in ${duration}s!`);
}

gradeReadingFrames().catch((err) => {
  console.error('Grading failed:', err);
  process.exit(1);
});
