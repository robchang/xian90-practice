import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pipeline } from '@huggingface/transformers';
import { runVadOnPcm } from '../src/vad.ts';
import { scoreUtterance } from '../src/scoring.ts';
import speech from '../public/data/speech.json' with { type: 'json' };

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const sampleRate = 16000;

function loadMp3As16k(file) {
  const buf = execFileSync('ffmpeg', [
    '-i', file,
    '-ar', String(sampleRate),
    '-ac', '1',
    '-f', 'f32le',
    '-v', 'error',
    'pipe:1',
  ]);
  return new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 4));
}

function concat(parts) {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Float32Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

const line1 = speech.find((l) => l.number === 1).chinese;
const mp3 = path.join(root, 'public/audio/lines/line_01.mp3');
const speechPcm = loadMp3As16k(mp3);
const silence3s = new Float32Array(sampleRate * 3);
const trail = new Float32Array(Math.round(sampleRate * 1.8));
const fakeMic = concat([silence3s, speechPcm, trail]);

const result = runVadOnPcm(fakeMic, sampleRate);
console.log('VAD', result);

if (result.heardSpeech !== true) {
  console.error('FAILED: expected to hear speech after 3s of silence');
  process.exit(1);
}
if (result.heardAtMs == null || result.heardAtMs < 2800) {
  console.error(`FAILED: VAD stopped or triggered too early (heardAtMs=${result.heardAtMs})`);
  process.exit(1);
}
if (result.stoppedAtMs != null && result.stoppedAtMs < 3000) {
  console.error(`FAILED: VAD stopped during opening silence at ${result.stoppedAtMs}ms`);
  process.exit(1);
}

// Keep audio from the start through stop (or the end). Must include the line.
const endSample = result.stoppedAtMs != null
  ? Math.min(fakeMic.length, Math.ceil((result.stoppedAtMs / 1000) * sampleRate))
  : fakeMic.length;
const captured = fakeMic.slice(0, endSample);
const speechStart = sampleRate * 3;
if (captured.length < speechStart + sampleRate * 0.6) {
  console.error('FAILED: captured audio does not include the spoken line');
  process.exit(1);
}

const transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny', { dtype: 'q8' });
const out = await transcriber(captured, { language: 'chinese', task: 'transcribe' });
const text = (typeof out === 'string' ? out : out.text || '').trim();
const score = scoreUtterance(line1, text);
console.log('ASR', text);
console.log('score', score.overall);

if (score.overall < 70) {
  console.error(`FAILED: expected a high score for the captured line, got ${score.overall} (asr: ${text})`);
  process.exit(1);
}
console.log('VAD MIC TEST PASSED');
