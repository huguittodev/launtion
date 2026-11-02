import fs from 'node:fs';
import { analyzeMediaWithGeminiVision } from '../src/lib/input-intelligence';

for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
(async () => {
  const frames = fs
    .readdirSync('out/base44_frames')
    .filter((n) => /^frame_\d+s\.jpg$/.test(n))
    .map((n) => ({
      timeSeconds: Number(n.match(/\d+/)![0]),
      dataUri: 'data:image/jpeg;base64,' + fs.readFileSync('out/base44_frames/' + n).toString('base64'),
    }));
  console.log('frames', frames.length);
  const t0 = Date.now();
  const r = await analyzeMediaWithGeminiVision({
    fileBase64: frames[0].dataUri,
    mimeType: 'image/jpeg',
    mediaType: 'video',
    filename: 'base44.mp4',
    targetDurationInFrames: 480,
    fps: 30,
    mediaAspect: 1.7778,
    mediaDurationSeconds: 52,
    frames,
  });
  console.log('source', r.source, r.model, r.reason ?? '', Date.now() - t0, 'ms');
  console.log(r.summary);
  for (const l of r.landmarks) {
    console.log(l.timeSeconds, l.category, l.suggestedAction, l.label, JSON.stringify(l.normalizedCenter));
  }
  console.log('events', r.interactionMap.events.map((e) => `${e.frame}:${e.type}`).join(' '), 'dur', r.interactionMap.durationInFrames);
})();
