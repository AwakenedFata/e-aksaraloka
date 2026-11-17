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
      "endFrame": 24
    },
    {
      "url": "/seq-packs/hero-c01.bin",
      "startFrame": 25,
      "endFrame": 48
    },
    {
      "url": "/seq-packs/hero-c02.bin",
      "startFrame": 49,
      "endFrame": 72
    },
    {
      "url": "/seq-packs/hero-c03.bin",
      "startFrame": 73,
      "endFrame": 96
    },
    {
      "url": "/seq-packs/hero-c04.bin",
      "startFrame": 97,
      "endFrame": 120
    },
    {
      "url": "/seq-packs/hero-c05.bin",
      "startFrame": 121,
      "endFrame": 144
    },
    {
      "url": "/seq-packs/hero-c06.bin",
      "startFrame": 145,
      "endFrame": 168
    },
    {
      "url": "/seq-packs/hero-c07.bin",
      "startFrame": 169,
      "endFrame": 192
    },
    {
      "url": "/seq-packs/hero-c08.bin",
      "startFrame": 193,
      "endFrame": 216
    },
    {
      "url": "/seq-packs/hero-c09.bin",
      "startFrame": 217,
      "endFrame": 240
    }
  ],
  "materi": [
    {
      "url": "/seq-packs/materi-c00.bin",
      "startFrame": 1,
      "endFrame": 30
    },
    {
      "url": "/seq-packs/materi-c01.bin",
      "startFrame": 31,
      "endFrame": 60
    },
    {
      "url": "/seq-packs/materi-c02.bin",
      "startFrame": 61,
      "endFrame": 90
    },
    {
      "url": "/seq-packs/materi-c03.bin",
      "startFrame": 91,
      "endFrame": 120
    },
    {
      "url": "/seq-packs/materi-c04.bin",
      "startFrame": 121,
      "endFrame": 150
    },
    {
      "url": "/seq-packs/materi-c05.bin",
      "startFrame": 151,
      "endFrame": 180
    },
    {
      "url": "/seq-packs/materi-c06.bin",
      "startFrame": 181,
      "endFrame": 210
    },
    {
      "url": "/seq-packs/materi-c07.bin",
      "startFrame": 211,
      "endFrame": 240
    },
    {
      "url": "/seq-packs/materi-c08.bin",
      "startFrame": 241,
      "endFrame": 270
    },
    {
      "url": "/seq-packs/materi-c09.bin",
      "startFrame": 271,
      "endFrame": 299
    }
  ],
  "reading": [
    {
      "url": "/seq-packs/reading-c00.bin",
      "startFrame": 1,
      "endFrame": 30
    },
    {
      "url": "/seq-packs/reading-c01.bin",
      "startFrame": 31,
      "endFrame": 60
    },
    {
      "url": "/seq-packs/reading-c02.bin",
      "startFrame": 61,
      "endFrame": 90
    },
    {
      "url": "/seq-packs/reading-c03.bin",
      "startFrame": 91,
      "endFrame": 120
    },
    {
      "url": "/seq-packs/reading-c04.bin",
      "startFrame": 121,
      "endFrame": 150
    },
    {
      "url": "/seq-packs/reading-c05.bin",
      "startFrame": 151,
      "endFrame": 180
    },
    {
      "url": "/seq-packs/reading-c06.bin",
      "startFrame": 181,
      "endFrame": 210
    },
    {
      "url": "/seq-packs/reading-c07.bin",
      "startFrame": 211,
      "endFrame": 240
    },
    {
      "url": "/seq-packs/reading-c08.bin",
      "startFrame": 241,
      "endFrame": 270
    },
    {
      "url": "/seq-packs/reading-c09.bin",
      "startFrame": 271,
      "endFrame": 300
    },
    {
      "url": "/seq-packs/reading-c10.bin",
      "startFrame": 301,
      "endFrame": 330
    },
    {
      "url": "/seq-packs/reading-c11.bin",
      "startFrame": 331,
      "endFrame": 360
    },
    {
      "url": "/seq-packs/reading-c12.bin",
      "startFrame": 361,
      "endFrame": 390
    },
    {
      "url": "/seq-packs/reading-c13.bin",
      "startFrame": 391,
      "endFrame": 420
    },
    {
      "url": "/seq-packs/reading-c14.bin",
      "startFrame": 421,
      "endFrame": 450
    },
    {
      "url": "/seq-packs/reading-c15.bin",
      "startFrame": 451,
      "endFrame": 480
    },
    {
      "url": "/seq-packs/reading-c16.bin",
      "startFrame": 481,
      "endFrame": 510
    },
    {
      "url": "/seq-packs/reading-c17.bin",
      "startFrame": 511,
      "endFrame": 537
    }
  ],
  "latihan": [
    {
      "url": "/seq-packs/latihan-c00.bin",
      "startFrame": 1,
      "endFrame": 24
    },
    {
      "url": "/seq-packs/latihan-c01.bin",
      "startFrame": 25,
      "endFrame": 48
    },
    {
      "url": "/seq-packs/latihan-c02.bin",
      "startFrame": 49,
      "endFrame": 72
    },
    {
      "url": "/seq-packs/latihan-c03.bin",
      "startFrame": 73,
      "endFrame": 96
    },
    {
      "url": "/seq-packs/latihan-c04.bin",
      "startFrame": 97,
      "endFrame": 120
    },
    {
      "url": "/seq-packs/latihan-c05.bin",
      "startFrame": 121,
      "endFrame": 144
    },
    {
      "url": "/seq-packs/latihan-c06.bin",
      "startFrame": 145,
      "endFrame": 168
    },
    {
      "url": "/seq-packs/latihan-c07.bin",
      "startFrame": 169,
      "endFrame": 192
    },
    {
      "url": "/seq-packs/latihan-c08.bin",
      "startFrame": 193,
      "endFrame": 216
    },
    {
      "url": "/seq-packs/latihan-c09.bin",
      "startFrame": 217,
      "endFrame": 240
    },
    {
      "url": "/seq-packs/latihan-c10.bin",
      "startFrame": 241,
      "endFrame": 264
    },
    {
      "url": "/seq-packs/latihan-c11.bin",
      "startFrame": 265,
      "endFrame": 288
    },
    {
      "url": "/seq-packs/latihan-c12.bin",
      "startFrame": 289,
      "endFrame": 312
    },
    {
      "url": "/seq-packs/latihan-c13.bin",
      "startFrame": 313,
      "endFrame": 336
    },
    {
      "url": "/seq-packs/latihan-c14.bin",
      "startFrame": 337,
      "endFrame": 360
    },
    {
      "url": "/seq-packs/latihan-c15.bin",
      "startFrame": 361,
      "endFrame": 384
    },
    {
      "url": "/seq-packs/latihan-c16.bin",
      "startFrame": 385,
      "endFrame": 408
    },
    {
      "url": "/seq-packs/latihan-c17.bin",
      "startFrame": 409,
      "endFrame": 432
    },
    {
      "url": "/seq-packs/latihan-c18.bin",
      "startFrame": 433,
      "endFrame": 456
    },
    {
      "url": "/seq-packs/latihan-c19.bin",
      "startFrame": 457,
      "endFrame": 480
    },
    {
      "url": "/seq-packs/latihan-c20.bin",
      "startFrame": 481,
      "endFrame": 504
    },
    {
      "url": "/seq-packs/latihan-c21.bin",
      "startFrame": 505,
      "endFrame": 528
    },
    {
      "url": "/seq-packs/latihan-c22.bin",
      "startFrame": 529,
      "endFrame": 552
    },
    {
      "url": "/seq-packs/latihan-c23.bin",
      "startFrame": 553,
      "endFrame": 561
    }
  ]
} as const;
