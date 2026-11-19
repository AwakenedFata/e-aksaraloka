import type { SequenceType } from "./sequenceEasing";

export interface SequencePackChunk {
  readonly url: string;
  readonly startFrame: number;
  readonly endFrame: number;
}

export const SEQUENCE_PACK_CHUNKS: Readonly<Record<SequenceType, readonly SequencePackChunk[]>> = {
  "hero": [
    {
      "url": "/seq-packs/hero-c00.bin",
      "startFrame": 1,
      "endFrame": 12
    },
    {
      "url": "/seq-packs/hero-c01.bin",
      "startFrame": 13,
      "endFrame": 24
    },
    {
      "url": "/seq-packs/hero-c02.bin",
      "startFrame": 25,
      "endFrame": 36
    },
    {
      "url": "/seq-packs/hero-c03.bin",
      "startFrame": 37,
      "endFrame": 48
    },
    {
      "url": "/seq-packs/hero-c04.bin",
      "startFrame": 49,
      "endFrame": 60
    },
    {
      "url": "/seq-packs/hero-c05.bin",
      "startFrame": 61,
      "endFrame": 72
    },
    {
      "url": "/seq-packs/hero-c06.bin",
      "startFrame": 73,
      "endFrame": 84
    },
    {
      "url": "/seq-packs/hero-c07.bin",
      "startFrame": 85,
      "endFrame": 96
    },
    {
      "url": "/seq-packs/hero-c08.bin",
      "startFrame": 97,
      "endFrame": 108
    },
    {
      "url": "/seq-packs/hero-c09.bin",
      "startFrame": 109,
      "endFrame": 120
    },
    {
      "url": "/seq-packs/hero-c10.bin",
      "startFrame": 121,
      "endFrame": 132
    },
    {
      "url": "/seq-packs/hero-c11.bin",
      "startFrame": 133,
      "endFrame": 144
    },
    {
      "url": "/seq-packs/hero-c12.bin",
      "startFrame": 145,
      "endFrame": 156
    },
    {
      "url": "/seq-packs/hero-c13.bin",
      "startFrame": 157,
      "endFrame": 168
    },
    {
      "url": "/seq-packs/hero-c14.bin",
      "startFrame": 169,
      "endFrame": 180
    },
    {
      "url": "/seq-packs/hero-c15.bin",
      "startFrame": 181,
      "endFrame": 192
    },
    {
      "url": "/seq-packs/hero-c16.bin",
      "startFrame": 193,
      "endFrame": 204
    },
    {
      "url": "/seq-packs/hero-c17.bin",
      "startFrame": 205,
      "endFrame": 216
    },
    {
      "url": "/seq-packs/hero-c18.bin",
      "startFrame": 217,
      "endFrame": 228
    },
    {
      "url": "/seq-packs/hero-c19.bin",
      "startFrame": 229,
      "endFrame": 240
    }
  ],
  "materi": [
    {
      "url": "/seq-packs/materi-c00.bin",
      "startFrame": 1,
      "endFrame": 12
    },
    {
      "url": "/seq-packs/materi-c01.bin",
      "startFrame": 13,
      "endFrame": 24
    },
    {
      "url": "/seq-packs/materi-c02.bin",
      "startFrame": 25,
      "endFrame": 36
    },
    {
      "url": "/seq-packs/materi-c03.bin",
      "startFrame": 37,
      "endFrame": 48
    },
    {
      "url": "/seq-packs/materi-c04.bin",
      "startFrame": 49,
      "endFrame": 60
    },
    {
      "url": "/seq-packs/materi-c05.bin",
      "startFrame": 61,
      "endFrame": 72
    },
    {
      "url": "/seq-packs/materi-c06.bin",
      "startFrame": 73,
      "endFrame": 84
    },
    {
      "url": "/seq-packs/materi-c07.bin",
      "startFrame": 85,
      "endFrame": 96
    },
    {
      "url": "/seq-packs/materi-c08.bin",
      "startFrame": 97,
      "endFrame": 108
    },
    {
      "url": "/seq-packs/materi-c09.bin",
      "startFrame": 109,
      "endFrame": 120
    },
    {
      "url": "/seq-packs/materi-c10.bin",
      "startFrame": 121,
      "endFrame": 132
    },
    {
      "url": "/seq-packs/materi-c11.bin",
      "startFrame": 133,
      "endFrame": 144
    },
    {
      "url": "/seq-packs/materi-c12.bin",
      "startFrame": 145,
      "endFrame": 156
    },
    {
      "url": "/seq-packs/materi-c13.bin",
      "startFrame": 157,
      "endFrame": 168
    },
    {
      "url": "/seq-packs/materi-c14.bin",
      "startFrame": 169,
      "endFrame": 180
    },
    {
      "url": "/seq-packs/materi-c15.bin",
      "startFrame": 181,
      "endFrame": 192
    },
    {
      "url": "/seq-packs/materi-c16.bin",
      "startFrame": 193,
      "endFrame": 204
    },
    {
      "url": "/seq-packs/materi-c17.bin",
      "startFrame": 205,
      "endFrame": 216
    },
    {
      "url": "/seq-packs/materi-c18.bin",
      "startFrame": 217,
      "endFrame": 228
    },
    {
      "url": "/seq-packs/materi-c19.bin",
      "startFrame": 229,
      "endFrame": 240
    },
    {
      "url": "/seq-packs/materi-c20.bin",
      "startFrame": 241,
      "endFrame": 252
    },
    {
      "url": "/seq-packs/materi-c21.bin",
      "startFrame": 253,
      "endFrame": 264
    },
    {
      "url": "/seq-packs/materi-c22.bin",
      "startFrame": 265,
      "endFrame": 276
    },
    {
      "url": "/seq-packs/materi-c23.bin",
      "startFrame": 277,
      "endFrame": 288
    },
    {
      "url": "/seq-packs/materi-c24.bin",
      "startFrame": 289,
      "endFrame": 299
    }
  ],
  "reading": [
    {
      "url": "/seq-packs/reading-c00.bin",
      "startFrame": 1,
      "endFrame": 15
    },
    {
      "url": "/seq-packs/reading-c01.bin",
      "startFrame": 16,
      "endFrame": 30
    },
    {
      "url": "/seq-packs/reading-c02.bin",
      "startFrame": 31,
      "endFrame": 45
    },
    {
      "url": "/seq-packs/reading-c03.bin",
      "startFrame": 46,
      "endFrame": 60
    },
    {
      "url": "/seq-packs/reading-c04.bin",
      "startFrame": 61,
      "endFrame": 75
    },
    {
      "url": "/seq-packs/reading-c05.bin",
      "startFrame": 76,
      "endFrame": 90
    },
    {
      "url": "/seq-packs/reading-c06.bin",
      "startFrame": 91,
      "endFrame": 105
    },
    {
      "url": "/seq-packs/reading-c07.bin",
      "startFrame": 106,
      "endFrame": 120
    },
    {
      "url": "/seq-packs/reading-c08.bin",
      "startFrame": 121,
      "endFrame": 135
    },
    {
      "url": "/seq-packs/reading-c09.bin",
      "startFrame": 136,
      "endFrame": 150
    },
    {
      "url": "/seq-packs/reading-c10.bin",
      "startFrame": 151,
      "endFrame": 165
    },
    {
      "url": "/seq-packs/reading-c11.bin",
      "startFrame": 166,
      "endFrame": 180
    },
    {
      "url": "/seq-packs/reading-c12.bin",
      "startFrame": 181,
      "endFrame": 195
    },
    {
      "url": "/seq-packs/reading-c13.bin",
      "startFrame": 196,
      "endFrame": 210
    },
    {
      "url": "/seq-packs/reading-c14.bin",
      "startFrame": 211,
      "endFrame": 225
    },
    {
      "url": "/seq-packs/reading-c15.bin",
      "startFrame": 226,
      "endFrame": 240
    },
    {
      "url": "/seq-packs/reading-c16.bin",
      "startFrame": 241,
      "endFrame": 255
    },
    {
      "url": "/seq-packs/reading-c17.bin",
      "startFrame": 256,
      "endFrame": 270
    },
    {
      "url": "/seq-packs/reading-c18.bin",
      "startFrame": 271,
      "endFrame": 285
    },
    {
      "url": "/seq-packs/reading-c19.bin",
      "startFrame": 286,
      "endFrame": 300
    },
    {
      "url": "/seq-packs/reading-c20.bin",
      "startFrame": 301,
      "endFrame": 315
    },
    {
      "url": "/seq-packs/reading-c21.bin",
      "startFrame": 316,
      "endFrame": 330
    },
    {
      "url": "/seq-packs/reading-c22.bin",
      "startFrame": 331,
      "endFrame": 345
    },
    {
      "url": "/seq-packs/reading-c23.bin",
      "startFrame": 346,
      "endFrame": 360
    },
    {
      "url": "/seq-packs/reading-c24.bin",
      "startFrame": 361,
      "endFrame": 375
    },
    {
      "url": "/seq-packs/reading-c25.bin",
      "startFrame": 376,
      "endFrame": 390
    },
    {
      "url": "/seq-packs/reading-c26.bin",
      "startFrame": 391,
      "endFrame": 405
    },
    {
      "url": "/seq-packs/reading-c27.bin",
      "startFrame": 406,
      "endFrame": 420
    },
    {
      "url": "/seq-packs/reading-c28.bin",
      "startFrame": 421,
      "endFrame": 435
    },
    {
      "url": "/seq-packs/reading-c29.bin",
      "startFrame": 436,
      "endFrame": 450
    },
    {
      "url": "/seq-packs/reading-c30.bin",
      "startFrame": 451,
      "endFrame": 465
    },
    {
      "url": "/seq-packs/reading-c31.bin",
      "startFrame": 466,
      "endFrame": 480
    },
    {
      "url": "/seq-packs/reading-c32.bin",
      "startFrame": 481,
      "endFrame": 495
    },
    {
      "url": "/seq-packs/reading-c33.bin",
      "startFrame": 496,
      "endFrame": 510
    },
    {
      "url": "/seq-packs/reading-c34.bin",
      "startFrame": 511,
      "endFrame": 525
    },
    {
      "url": "/seq-packs/reading-c35.bin",
      "startFrame": 526,
      "endFrame": 537
    }
  ],
  "latihan": [
    {
      "url": "/seq-packs/latihan-c00.bin",
      "startFrame": 1,
      "endFrame": 12
    },
    {
      "url": "/seq-packs/latihan-c01.bin",
      "startFrame": 13,
      "endFrame": 24
    },
    {
      "url": "/seq-packs/latihan-c02.bin",
      "startFrame": 25,
      "endFrame": 36
    },
    {
      "url": "/seq-packs/latihan-c03.bin",
      "startFrame": 37,
      "endFrame": 48
    },
    {
      "url": "/seq-packs/latihan-c04.bin",
      "startFrame": 49,
      "endFrame": 60
    },
    {
      "url": "/seq-packs/latihan-c05.bin",
      "startFrame": 61,
      "endFrame": 72
    },
    {
      "url": "/seq-packs/latihan-c06.bin",
      "startFrame": 73,
      "endFrame": 84
    },
    {
      "url": "/seq-packs/latihan-c07.bin",
      "startFrame": 85,
      "endFrame": 96
    },
    {
      "url": "/seq-packs/latihan-c08.bin",
      "startFrame": 97,
      "endFrame": 108
    },
    {
      "url": "/seq-packs/latihan-c09.bin",
      "startFrame": 109,
      "endFrame": 120
    },
    {
      "url": "/seq-packs/latihan-c10.bin",
      "startFrame": 121,
      "endFrame": 132
    },
    {
      "url": "/seq-packs/latihan-c11.bin",
      "startFrame": 133,
      "endFrame": 144
    },
    {
      "url": "/seq-packs/latihan-c12.bin",
      "startFrame": 145,
      "endFrame": 156
    },
    {
      "url": "/seq-packs/latihan-c13.bin",
      "startFrame": 157,
      "endFrame": 168
    },
    {
      "url": "/seq-packs/latihan-c14.bin",
      "startFrame": 169,
      "endFrame": 180
    },
    {
      "url": "/seq-packs/latihan-c15.bin",
      "startFrame": 181,
      "endFrame": 192
    },
    {
      "url": "/seq-packs/latihan-c16.bin",
      "startFrame": 193,
      "endFrame": 204
    },
    {
      "url": "/seq-packs/latihan-c17.bin",
      "startFrame": 205,
      "endFrame": 216
    },
    {
      "url": "/seq-packs/latihan-c18.bin",
      "startFrame": 217,
      "endFrame": 228
    },
    {
      "url": "/seq-packs/latihan-c19.bin",
      "startFrame": 229,
      "endFrame": 240
    },
    {
      "url": "/seq-packs/latihan-c20.bin",
      "startFrame": 241,
      "endFrame": 252
    },
    {
      "url": "/seq-packs/latihan-c21.bin",
      "startFrame": 253,
      "endFrame": 264
    },
    {
      "url": "/seq-packs/latihan-c22.bin",
      "startFrame": 265,
      "endFrame": 276
    },
    {
      "url": "/seq-packs/latihan-c23.bin",
      "startFrame": 277,
      "endFrame": 288
    },
    {
      "url": "/seq-packs/latihan-c24.bin",
      "startFrame": 289,
      "endFrame": 300
    },
    {
      "url": "/seq-packs/latihan-c25.bin",
      "startFrame": 301,
      "endFrame": 312
    },
    {
      "url": "/seq-packs/latihan-c26.bin",
      "startFrame": 313,
      "endFrame": 324
    },
    {
      "url": "/seq-packs/latihan-c27.bin",
      "startFrame": 325,
      "endFrame": 336
    },
    {
      "url": "/seq-packs/latihan-c28.bin",
      "startFrame": 337,
      "endFrame": 348
    },
    {
      "url": "/seq-packs/latihan-c29.bin",
      "startFrame": 349,
      "endFrame": 360
    },
    {
      "url": "/seq-packs/latihan-c30.bin",
      "startFrame": 361,
      "endFrame": 372
    },
    {
      "url": "/seq-packs/latihan-c31.bin",
      "startFrame": 373,
      "endFrame": 384
    },
    {
      "url": "/seq-packs/latihan-c32.bin",
      "startFrame": 385,
      "endFrame": 396
    },
    {
      "url": "/seq-packs/latihan-c33.bin",
      "startFrame": 397,
      "endFrame": 408
    },
    {
      "url": "/seq-packs/latihan-c34.bin",
      "startFrame": 409,
      "endFrame": 420
    },
    {
      "url": "/seq-packs/latihan-c35.bin",
      "startFrame": 421,
      "endFrame": 432
    },
    {
      "url": "/seq-packs/latihan-c36.bin",
      "startFrame": 433,
      "endFrame": 444
    },
    {
      "url": "/seq-packs/latihan-c37.bin",
      "startFrame": 445,
      "endFrame": 456
    },
    {
      "url": "/seq-packs/latihan-c38.bin",
      "startFrame": 457,
      "endFrame": 468
    },
    {
      "url": "/seq-packs/latihan-c39.bin",
      "startFrame": 469,
      "endFrame": 480
    },
    {
      "url": "/seq-packs/latihan-c40.bin",
      "startFrame": 481,
      "endFrame": 492
    },
    {
      "url": "/seq-packs/latihan-c41.bin",
      "startFrame": 493,
      "endFrame": 504
    },
    {
      "url": "/seq-packs/latihan-c42.bin",
      "startFrame": 505,
      "endFrame": 516
    },
    {
      "url": "/seq-packs/latihan-c43.bin",
      "startFrame": 517,
      "endFrame": 528
    },
    {
      "url": "/seq-packs/latihan-c44.bin",
      "startFrame": 529,
      "endFrame": 540
    },
    {
      "url": "/seq-packs/latihan-c45.bin",
      "startFrame": 541,
      "endFrame": 552
    },
    {
      "url": "/seq-packs/latihan-c46.bin",
      "startFrame": 553,
      "endFrame": 561
    }
  ]
} as const;
