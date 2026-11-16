const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function blendMateriEntry() {
  console.log('Harmonizing transition from Hero Frame 240 to Materi Frame 001-005...');
  
  const hero240Path = path.join(__dirname, '..', 'public', 'hero-frames', 'frame-240.webp');
  const materi1Path = path.join(__dirname, '..', 'public', 'materi-frames', 'frame-001.webp');

  // 1. Frame 001 of Materi becomes an EXACT clone of Hero Frame 240
  fs.copyFileSync(hero240Path, materi1Path);
  console.log('✓ Cloned Hero 240 directly to Materi 001 (0.00% difference guaranteed)');

  // 2. Linearly cross-fade frames 2 to 4 to eliminate any camera jerk or particle jump
  const hFileBuf = fs.readFileSync(hero240Path);
  const hRaw = await sharp(hFileBuf).raw().toBuffer();
  const weights = [0.75, 0.50, 0.25];

  for (let idx = 0; idx < weights.length; idx++) {
    const frameNum = idx + 2;
    const num = String(frameNum).padStart(3, '0');
    const mPath = path.join(__dirname, '..', 'public', 'materi-frames', `frame-${num}.webp`);
    const mFileBuf = fs.readFileSync(mPath);
    const mRaw = await sharp(mFileBuf).raw().toBuffer();

    const w = weights[idx];
    const blended = Buffer.alloc(hRaw.length);
    for (let i = 0; i < hRaw.length; i++) {
      blended[i] = Math.round(hRaw[i] * w + mRaw[i] * (1 - w));
    }

    const outBuf = await sharp(blended, { raw: { width: 1920, height: 1080, channels: 3 } })
      .webp({ quality: 82, effort: 3 })
      .toBuffer();

    fs.writeFileSync(mPath, outBuf);
    console.log(`✓ Smoothly blended Materi frame ${num} with ${(w * 100).toFixed(0)}% Hero 240 weighting`);
  }

  console.log('Seamless transition blending completed successfully!');
}

blendMateriEntry().catch((err) => {
  console.error('Blending failed:', err);
  process.exit(1);
});
