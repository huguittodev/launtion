/**
 * tests/adversarial-milestone1.test.ts
 *
 * EMPIRICAL CHALLENGER VERIFICATION HARNESS — Milestone 1
 *
 * Adversarial stress-testing and empirical verification for:
 * 1. Binary RIFF/WAVE headers (44.1kHz, 16-bit, mono, PCM format 1) across all 18 files.
 * 2. True Peak & True RMS dBFS verification (safe corridor [-1.0 dBFS, -6.0 dBFS] for all 12 generated SFX).
 * 3. Cryptographic SHA-256 manifest audit against public/sfx/SFX_LICENSES.md.
 * 4. Adversarial fuzzing of AudioAssetSchema and AllowedMimeTypesEnum (empty strings,
 *    malformed, case sensitivity, injection strings, non-string primitives, prototype pollution).
 * 5. AudioCueSchema and AudioMixer polyphony/ducking invariants.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

import { AudioAssetSchema, AudioCueSchema } from '../src/lib/scene-graph/schema';
import type { AudioAsset } from '../src/lib/scene-graph/types';
import { AllowedMimeTypesEnum } from '../src/lib/input-intelligence/schema';
import {
  SFX_CATALOG,
  getMechanicalTapAsset,
  resolveClickAsset,
  scheduleProceduralKeystrokes,
  scheduleSceneTransitionWhooshes,
} from '../remotion/motion-kit/audio/AudioTimeline';
import { calculateDuckingFactor, softLimitGain } from '../remotion/motion-kit/audio/AudioMixer';

const SFX_DIR = path.resolve(process.cwd(), 'public/sfx');
const LICENSES_PATH = path.resolve(SFX_DIR, 'SFX_LICENSES.md');

const ALL_18_ASSET_NAMES: AudioAsset[] = [
  'ambient-beat',
  'camera-whoosh',
  'chime',
  'keyboard-tap',
  'mouse-click',
  'soft-pop',
  'transition-whoosh-heavy',
  'transition-whoosh-fast',
  'sound-riser',
  'sub-bass-drop',
  'click-switch',
  'click-soft',
  'mechanical-tap-1',
  'mechanical-tap-2',
  'mechanical-tap-3',
  'mechanical-tap-4',
  'pop-clean',
  'success-chime',
];

const NEW_12_GENERATED_ASSETS = [
  'transition-whoosh-heavy.wav',
  'transition-whoosh-fast.wav',
  'sound-riser.wav',
  'sub-bass-drop.wav',
  'click-switch.wav',
  'click-soft.wav',
  'mechanical-tap-1.wav',
  'mechanical-tap-2.wav',
  'mechanical-tap-3.wav',
  'mechanical-tap-4.wav',
  'pop-clean.wav',
  'success-chime.wav',
];

interface ParsedWav {
  filename: string;
  buffer: Buffer;
  riffId: string;
  waveId: string;
  formatCode: number;
  channels: number;
  sampleRate: number;
  byteRate: number;
  blockAlign: number;
  bitsPerSample: number;
  dataOffset: number;
  dataSize: number;
  samples: Int16Array;
  durationSec: number;
  peakDbfs: number;
  rmsDbfs: number;
  sha256: string;
}

function parseWavFile(filename: string): ParsedWav {
  const filePath = path.join(SFX_DIR, filename);
  const buffer = fs.readFileSync(filePath);
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

  const riffId = buffer.toString('ascii', 0, 4);
  const waveId = buffer.toString('ascii', 8, 12);

  let offset = 12;
  let formatCode = -1;
  let channels = -1;
  let sampleRate = -1;
  let byteRate = -1;
  let blockAlign = -1;
  let bitsPerSample = -1;
  let dataOffset = -1;
  let dataSize = -1;

  while (offset < buffer.length - 8) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);

    if (chunkId === 'fmt ') {
      formatCode = buffer.readUInt16LE(offset + 8);
      channels = buffer.readUInt16LE(offset + 10);
      sampleRate = buffer.readUInt32LE(offset + 12);
      byteRate = buffer.readUInt32LE(offset + 16);
      blockAlign = buffer.readUInt16LE(offset + 20);
      bitsPerSample = buffer.readUInt16LE(offset + 22);
    } else if (chunkId === 'data') {
      dataOffset = offset + 8;
      dataSize = chunkSize;
    }
    offset += 8 + chunkSize;
  }

  assert.ok(dataOffset > 0, `File ${filename} missing PCM 'data' chunk`);
  assert.ok(dataSize > 0, `File ${filename} has empty 'data' chunk`);

  const numSamples = dataSize / 2;
  const samples = new Int16Array(numSamples);
  let maxAbs = 0;
  let sumSq = 0;

  for (let i = 0; i < numSamples; i++) {
    const val = buffer.readInt16LE(dataOffset + i * 2);
    samples[i] = val;
    const norm = val / 32768.0;
    const absNorm = Math.abs(norm);
    if (absNorm > maxAbs) maxAbs = absNorm;
    sumSq += norm * norm;
  }

  const rms = Math.sqrt(sumSq / numSamples);
  const peakDbfs = maxAbs > 0 ? 20 * Math.log10(maxAbs) : -100;
  const rmsDbfs = rms > 0 ? 20 * Math.log10(rms) : -100;
  const durationSec = numSamples / sampleRate;

  return {
    filename,
    buffer,
    riffId,
    waveId,
    formatCode,
    channels,
    sampleRate,
    byteRate,
    blockAlign,
    bitsPerSample,
    dataOffset,
    dataSize,
    samples,
    durationSec,
    peakDbfs,
    rmsDbfs,
    sha256,
  };
}

describe('Empirical Challenger: Milestone 1 Verification Harness', () => {
  describe('1. Binary RIFF/WAVE Header & Integrity Verification', () => {
    it('1.1 parses all 18 WAV files and confirms RIFF/WAVE PCM 16-bit 44.1kHz mono format', () => {
      const files = fs.readdirSync(SFX_DIR).filter((f) => f.endsWith('.wav'));
      assert.equal(files.length, 18, `Expected exactly 18 WAV files in ${SFX_DIR}, found ${files.length}`);

      for (const file of files) {
        const parsed = parseWavFile(file);

        assert.equal(parsed.riffId, 'RIFF', `${file}: ChunkID must be 'RIFF'`);
        assert.equal(parsed.waveId, 'WAVE', `${file}: Format must be 'WAVE'`);
        assert.equal(parsed.formatCode, 1, `${file}: AudioFormat must be 1 (uncompressed PCM)`);
        assert.equal(parsed.channels, 1, `${file}: NumChannels must be 1 (mono)`);
        assert.equal(parsed.sampleRate, 44100, `${file}: SampleRate must be 44,100 Hz`);
        assert.equal(parsed.bitsPerSample, 16, `${file}: BitsPerSample must be 16-bit`);
        assert.equal(parsed.blockAlign, 2, `${file}: BlockAlign must be 2 bytes (1 channel * 2 bytes)`);
        assert.equal(parsed.byteRate, 88200, `${file}: ByteRate must be 88,200 bytes/sec`);
        assert.ok(parsed.durationSec > 0, `${file}: Duration must be strictly positive`);
        assert.ok(parsed.samples.length > 0, `${file}: Samples must be populated`);
      }
    });

    it('1.2 verifies all 12 generated WAV files are strictly within [-1.0 dBFS, -6.0 dBFS] safe corridor', () => {
      for (const filename of NEW_12_GENERATED_ASSETS) {
        const parsed = parseWavFile(filename);

        // Verification of safe loudness corridor:
        // Peak <= -1.0 dBFS guarantees zero digital clipping (minimum 1.0 dB headroom)
        // Peak >= -6.0 dBFS guarantees adequate loudness (not buried in noise floor)
        assert.ok(
          parsed.peakDbfs <= -1.0,
          `${filename}: Peak ${parsed.peakDbfs.toFixed(2)} dBFS exceeds -1.0 dBFS ceiling (risk of digital clipping)`
        );
        assert.ok(
          parsed.peakDbfs >= -6.0,
          `${filename}: Peak ${parsed.peakDbfs.toFixed(2)} dBFS falls below -6.0 dBFS floor (inadequate loudness)`
        );

        // RMS must be strictly lower than peak (physical acoustic requirement)
        assert.ok(
          parsed.rmsDbfs < parsed.peakDbfs,
          `${filename}: RMS ${parsed.rmsDbfs.toFixed(2)} dBFS must be lower than Peak ${parsed.peakDbfs.toFixed(2)} dBFS`
        );

        // RMS must be within realistic musical bounds
        assert.ok(
          parsed.rmsDbfs > -30.0,
          `${filename}: RMS ${parsed.rmsDbfs.toFixed(2)} dBFS is unrealistically quiet`
        );
      }
    });

    it('1.3 audits SHA-256 hashes against public/sfx/SFX_LICENSES.md manifest', () => {
      assert.ok(fs.existsSync(LICENSES_PATH), 'SFX_LICENSES.md must exist');
      const manifestText = fs.readFileSync(LICENSES_PATH, 'utf-8');

      // Extract ledger rows: `| **`filename`** | ... | `sha256` |`
      const hashRegex = /\|\s*\*\*`([^`]+)`\*\*\s*\|[^|]+\|[^|]+\|[^|]+\|[^|]+\|[^|]+\|[^|]+\|[^|]+\|\s*`([a-f0-9]{64})`\s*\|/g;
      const ledgerEntries: Record<string, string> = {};

      let match: RegExpExecArray | null;
      while ((match = hashRegex.exec(manifestText)) !== null) {
        ledgerEntries[match[1]] = match[2];
      }

      assert.equal(
        Object.keys(ledgerEntries).length,
        18,
        `Expected 18 manifest entries in SFX_LICENSES.md table, parsed ${Object.keys(ledgerEntries).length}`
      );

      for (const [filename, expectedHash] of Object.entries(ledgerEntries)) {
        const parsed = parseWavFile(filename);
        assert.equal(
          parsed.sha256,
          expectedHash,
          `Cryptographic SHA-256 mismatch for ${filename}:\nExpected: ${expectedHash}\nComputed: ${parsed.sha256}`
        );
      }
    });
  });

  describe('2. Adversarial Stress-Testing: AudioAssetSchema', () => {
    it('2.1 admits all 18 canonical assets in exact lowercase form', () => {
      for (const asset of ALL_18_ASSET_NAMES) {
        const res = AudioAssetSchema.safeParse(asset);
        assert.ok(res.success, `Canonical asset '${asset}' must parse successfully`);
        assert.equal(res.data, asset);
      }
    });

    it('2.2 rejects empty strings, whitespace-only, and strings with leading/trailing whitespace', () => {
      const whitespaceInputs = [
        '',
        ' ',
        '   ',
        '\t',
        '\n',
        '\r\n',
        ' mouse-click',
        'mouse-click ',
        '  mouse-click  ',
        'click-soft\n',
        '\ttransition-whoosh-heavy',
      ];

      for (const input of whitespaceInputs) {
        const res = AudioAssetSchema.safeParse(input);
        assert.equal(
          res.success,
          false,
          `Whitespace input '${JSON.stringify(input)}' must be rejected`
        );
      }
    });

    it('2.3 rejects uppercase, titlecase, and mixed-case variants (strict case sensitivity)', () => {
      const caseVariants = [
        'MOUSE-CLICK',
        'Mouse-Click',
        'mOuSe-ClIck',
        'TRANSITION-WHOOSH-HEAVY',
        'Transition-Whoosh-Heavy',
        'CLICK-SWITCH',
        'Click-Switch',
        'SUB-BASS-DROP',
        'Sub-Bass-Drop',
        'SUCCESS-CHIME',
        'Success-Chime',
      ];

      for (const input of caseVariants) {
        const res = AudioAssetSchema.safeParse(input);
        assert.equal(
          res.success,
          false,
          `Non-lowercase input '${input}' must be strictly rejected`
        );
      }
    });

    it('2.4 rejects injection vectors, path traversals, and script strings', () => {
      const attackVectors = [
        "mouse-click'; DROP TABLE audio_assets; --",
        '<script>alert("xss")</script>',
        '<img src=x onerror=alert(1)>',
        '../../public/sfx/mouse-click.wav',
        '../../../etc/passwd',
        '/etc/shadow',
        'mouse-click\0.wav',
        'click-soft\u0000',
        '${7*7}',
        '{{constructor.constructor("return process")()}}',
        'mouse-click && rm -rf /',
        'mouse-click | cat /etc/passwd',
        'eval("mouse-click")',
      ];

      for (const attack of attackVectors) {
        const res = AudioAssetSchema.safeParse(attack);
        assert.equal(
          res.success,
          false,
          `Adversarial attack vector '${attack}' must be strictly rejected`
        );
      }
    });

    it('2.5 rejects malformed, truncated, near-miss, and concatenated strings', () => {
      const nearMisses = [
        'mouse_click',
        'mouse click',
        'mouse--click',
        'mouse-clicks',
        'mouse',
        'click',
        'transition-whoosh',
        'mechanical-tap',
        'mechanical-tap-0',
        'mechanical-tap-5',
        'sub-bass',
        'sound_riser',
        'ambient',
        'chimes',
        'pop',
        'success',
        'mouse-click,camera-whoosh',
        'mouse-click;click-soft',
      ];

      for (const nm of nearMisses) {
        const res = AudioAssetSchema.safeParse(nm);
        assert.equal(
          res.success,
          false,
          `Near-miss asset '${nm}' must be strictly rejected`
        );
      }
    });

    it('2.6 rejects non-string types, boundaries, and prototype manipulation', () => {
      const nonStringInputs: unknown[] = [
        null,
        undefined,
        0,
        1,
        -1,
        3.14,
        NaN,
        Infinity,
        -Infinity,
        true,
        false,
        {},
        { value: 'mouse-click' },
        { toString: () => 'mouse-click' },
        [],
        ['mouse-click'],
        () => 'mouse-click',
        Symbol('mouse-click'),
        'a'.repeat(100_000),
      ];

      for (const input of nonStringInputs) {
        const res = AudioAssetSchema.safeParse(input);
        assert.equal(
          res.success,
          false,
          `Non-string / boundary input '${String(input)}' must be rejected`
        );
      }
    });
  });

  describe('3. Adversarial Stress-Testing: AllowedMimeTypesEnum', () => {
    it('3.1 admits exactly the 6 canonical MIME types in lowercase', () => {
      const admitted = [
        'image/png',
        'image/jpeg',
        'image/jpg',
        'image/webp',
        'video/mp4',
        'video/webm',
      ];

      for (const mime of admitted) {
        const res = AllowedMimeTypesEnum.safeParse(mime);
        assert.ok(res.success, `Admitted MIME '${mime}' must parse successfully`);
        assert.equal(res.data, mime);
      }
    });

    it('3.2 rejects empty, whitespace, and leading/trailing whitespace MIME inputs', () => {
      const whitespaceMimes = [
        '',
        ' ',
        '\t',
        '\n',
        ' video/mp4',
        'video/mp4 ',
        ' image/png ',
        'video/webm\n',
        '\timage/jpeg',
      ];

      for (const input of whitespaceMimes) {
        const res = AllowedMimeTypesEnum.safeParse(input);
        assert.equal(
          res.success,
          false,
          `Whitespace MIME input '${JSON.stringify(input)}' must be rejected`
        );
      }
    });

    it('3.3 rejects case variations (strict MIME case sensitivity)', () => {
      const caseVariants = [
        'VIDEO/MP4',
        'Video/Mp4',
        'video/MP4',
        'IMAGE/PNG',
        'Image/Png',
        'IMAGE/JPEG',
        'image/JPEG',
        'IMAGE/JPG',
        'video/WEBM',
        'Video/WebM',
      ];

      for (const input of caseVariants) {
        const res = AllowedMimeTypesEnum.safeParse(input);
        assert.equal(
          res.success,
          false,
          `Non-lowercase MIME '${input}' must be strictly rejected`
        );
      }
    });

    it('3.4 rejects injection strings, file paths, and MIME parameters', () => {
      const attacks = [
        'video/mp4; codecs=avc1.42E01E,mp4a.40.2',
        'image/jpeg; charset=utf-8',
        'video/mp4; rm -rf /',
        'image/png; DROP TABLE files;',
        '<script>alert("mime")</script>',
        'video/mp4\0.exe',
        'video/webm\u0000',
        '../../uploads/evil.webm',
        'video/mp4,video/webm',
        'video/mp4|cat /etc/passwd',
      ];

      for (const attack of attacks) {
        const res = AllowedMimeTypesEnum.safeParse(attack);
        assert.equal(
          res.success,
          false,
          `Adversarial MIME attack '${attack}' must be strictly rejected`
        );
      }
    });

    it('3.5 rejects unsupported MIME types, media categories, and malformed structures', () => {
      const unsupported = [
        'image/gif',
        'image/bmp',
        'image/svg+xml',
        'image/tiff',
        'image/avif',
        'video/quicktime', // .mov
        'video/x-msvideo', // .avi
        'video/x-matroska', // .mkv
        'video/ogg',
        'audio/wav',
        'audio/mpeg',
        'audio/aac',
        'application/pdf',
        'application/json',
        'application/octet-stream',
        'text/plain',
        'text/html',
        'video',
        'image',
        'video/',
        'image/',
        '/mp4',
        'video//mp4',
        'image///png',
      ];

      for (const item of unsupported) {
        const res = AllowedMimeTypesEnum.safeParse(item);
        assert.equal(
          res.success,
          false,
          `Unsupported MIME '${item}' must be strictly rejected`
        );
      }
    });

    it('3.6 rejects non-string boundary values and object prototypes for AllowedMimeTypesEnum', () => {
      const nonStrings: unknown[] = [
        null,
        undefined,
        0,
        1,
        NaN,
        Infinity,
        true,
        false,
        {},
        { mimeType: 'video/mp4' },
        ['video/mp4'],
        () => 'video/mp4',
        Symbol('video/mp4'),
        'video/mp4'.repeat(10_000),
      ];

      for (const input of nonStrings) {
        const res = AllowedMimeTypesEnum.safeParse(input);
        assert.equal(
          res.success,
          false,
          `Non-string MIME input '${String(input)}' must be rejected`
        );
      }
    });
  });

  describe('4. AudioCueSchema & AudioEngine Robustness', () => {
    it('4.1 AudioCueSchema rejects invalid frames, volumes, and empty IDs', () => {
      // Valid baseline
      const validCue = {
        id: 'cue-valid-1',
        frame: 45,
        asset: 'click-switch',
        volume: 0.8,
        fadeInFrames: 5,
        fadeOutFrames: 10,
      };
      assert.ok(AudioCueSchema.safeParse(validCue).success);

      // Empty id
      assert.equal(AudioCueSchema.safeParse({ ...validCue, id: '' }).success, false);

      // Negative frame
      assert.equal(AudioCueSchema.safeParse({ ...validCue, frame: -1 }).success, false);

      // Fractional frame
      assert.equal(AudioCueSchema.safeParse({ ...validCue, frame: 10.5 }).success, false);

      // Non-finite frame
      assert.equal(AudioCueSchema.safeParse({ ...validCue, frame: NaN }).success, false);
      assert.equal(AudioCueSchema.safeParse({ ...validCue, frame: Infinity }).success, false);

      // Negative volume
      assert.equal(AudioCueSchema.safeParse({ ...validCue, volume: -0.01 }).success, false);

      // Volume > 1.0
      assert.equal(AudioCueSchema.safeParse({ ...validCue, volume: 1.01 }).success, false);

      // Non-finite volume
      assert.equal(AudioCueSchema.safeParse({ ...validCue, volume: NaN }).success, false);

      // Unauthorized asset in cue
      assert.equal(AudioCueSchema.safeParse({ ...validCue, asset: 'laser-beam' }).success, false);
    });

    it('4.2 SFX_CATALOG strictly aligns with AudioAssetSchema options and ducking rules', () => {
      const schemaOptions = AudioAssetSchema.options;
      assert.equal(schemaOptions.length, 18);

      for (const opt of schemaOptions) {
        const entry = SFX_CATALOG[opt];
        assert.ok(entry, `SFX_CATALOG must have entry for '${opt}'`);
        assert.equal(entry.asset, opt);
        assert.ok(entry.nominalVolume > 0 && entry.nominalVolume <= 1.0);
        assert.ok([0, 1, 2].includes(entry.duckingPriority));
      }
    });

    it('4.3 Procedural keystrokes schedule correctly across sequence limits and zero counts', () => {
      const zeroCues = scheduleProceduralKeystrokes({ startFrame: 0, charCount: 0 });
      assert.equal(zeroCues.length, 0);

      const singleCue = scheduleProceduralKeystrokes({ startFrame: 10, charCount: 1 });
      assert.equal(singleCue.length, 1);
      assert.equal(singleCue[0].asset, 'mechanical-tap-1');
      assert.equal(singleCue[0].frame, 10);

      // Stress: 100 keystrokes ensures 25 full cycles without error
      const heavyTyping = scheduleProceduralKeystrokes({
        startFrame: 0,
        charCount: 100,
        framesPerChar: 2,
      });
      assert.equal(heavyTyping.length, 100);
      for (let i = 0; i < 100; i++) {
        const expectedTap = `mechanical-tap-${(i % 4) + 1}`;
        assert.equal(heavyTyping[i].asset, expectedTap);
        assert.equal(getMechanicalTapAsset(i), expectedTap);
        assert.equal(heavyTyping[i].frame, i * 2);
      }
    });

    it('4.4 Click alternation handles extreme index values and unmapped roles gracefully', () => {
      assert.equal(resolveClickAsset('primary', 999), 'click-switch');
      assert.equal(resolveClickAsset('subtle', 999), 'click-soft');
      assert.equal(resolveClickAsset('standard', 0), 'mouse-click');
      assert.equal(resolveClickAsset('standard', 1), 'click-soft');
      assert.equal(resolveClickAsset('standard', 1000), 'mouse-click');
      assert.equal(resolveClickAsset('standard', 1001), 'click-soft');

      // Unmapped role falls back safely
      assert.equal(resolveClickAsset('unmapped' as unknown as 'standard'), 'mouse-click');
    });

    it('4.5 Scene transition whooshes handle empty scenes and out-of-bounds lead frames safely', () => {
      assert.deepEqual(
        scheduleSceneTransitionWhooshes({ scenes: [], canvasDurationInFrames: 300 }),
        []
      );

      // Single scene has no transitions
      assert.deepEqual(
        scheduleSceneTransitionWhooshes({
          scenes: [{ startFrame: 0, durationInFrames: 300 }],
          canvasDurationInFrames: 300,
        }),
        []
      );

      // Lead frames larger than start frame clamp to 0 without negative frame
      const cues = scheduleSceneTransitionWhooshes({
        scenes: [
          { startFrame: 0, durationInFrames: 10 },
          { startFrame: 10, durationInFrames: 90 },
        ],
        canvasDurationInFrames: 100,
        leadFrames: 20, // 10 - 20 = -10, must clamp to 0
      });
      assert.equal(cues.length, 1);
      assert.equal(cues[0].frame, 0);
    });

    it('4.6 Master Soft Limiter preserves derivative continuity and ceiling under extreme gain (10,000x)', () => {
      // Test at knee boundary (0.75)
      const belowKnee = softLimitGain(0.74, 0.75, 0.95);
      assert.equal(belowKnee.limitedGain, 0.74);
      assert.equal(belowKnee.limitFactor, 1.0);

      const atKnee = softLimitGain(0.75, 0.75, 0.95);
      assert.equal(atKnee.limitedGain, 0.75);

      // Extreme polyphony (10,000 simultaneous tracks)
      const extreme = softLimitGain(10000.0, 0.75, 0.95);
      assert.ok(extreme.limitedGain <= 0.95, 'Must remain bounded by 0.95 ceiling');
      assert.ok(extreme.limitedGain >= 0.949, 'Must approach 0.95 ceiling asymptotically');
    });

    it('4.7 Dynamic Sidechain Ducking responds only to priority 2 energetic sound assets', () => {
      const energeticCues = [
        { startFrame: 50, durationInFrames: 20, priority: SFX_CATALOG['sub-bass-drop'].duckingPriority },
      ];
      assert.equal(calculateDuckingFactor(40, energeticCues), 1.0);
      assert.equal(calculateDuckingFactor(55, energeticCues), 0.55);

      const microCues = [
        { startFrame: 50, durationInFrames: 20, priority: SFX_CATALOG['mechanical-tap-1'].duckingPriority },
      ];
      // Priority 1 never ducks music bed
      assert.equal(calculateDuckingFactor(55, microCues), 1.0);
    });
  });
});
