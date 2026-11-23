import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pipeline } from '@huggingface/transformers';
import { scoreUtterance } from '../src/scoring.ts';
import speech from '../public/data/speech.json' with { type: 'json' };

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const model = process.env.WHISPER_MODEL || 'Xenova/whisper-tiny';

function loadMp3As16k(file) {
  const buf = execFileSync('ffmpeg', [
    '-i', file,
    '-ar', '16000',
    '-ac', '1',
    '-f', 'f32le',
    '-v', 'error',
    'pipe:1',
  ]);
  return new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 4));
}

function lineText(n) {
  return speech.find((l) => l.number === n).chinese;
}

const transcriber = await pipeline('automatic-speech-recognition', model, { dtype: 'q8' });

async function transcribe(lineNo) {
  const file = path.join(root, 'public/audio/lines', `line_${String(lineNo).padStart(2, '0')}.mp3`);
  const audio = loadMp3As16k(file);
  const out = await transcriber(audio, { language: 'chinese', task: 'transcribe' });
  return (typeof out === 'string' ? out : out.text || '').trim();
}

const text1 = await transcribe(1);
const text4 = await transcribe(4);
console.log('line 1 ASR:', text1);
console.log('line 4 ASR:', text4);

const same1 = scoreUtterance(lineText(1), text1);
const cross14 = scoreUtterance(lineText(4), text1);
const same4 = scoreUtterance(lineText(4), text4);
const cross41 = scoreUtterance(lineText(1), text4);

console.log('score line1-vs-self', same1.overall);
console.log('score line1-audio vs line4-text', cross14.overall);
console.log('score line4-vs-self', same4.overall);
console.log('score line4-audio vs line1-text', cross41.overall);

const failures = [];
if (same1.overall < 70) failures.push(`expected high score for line 1 audio vs itself, got ${same1.overall} (asr: ${text1})`);
if (same4.overall < 70) failures.push(`expected high score for line 4 audio vs itself, got ${same4.overall} (asr: ${text4})`);
if (cross14.overall >= 55) failures.push(`expected low score for line 1 audio vs line 4, got ${cross14.overall}`);
if (cross41.overall >= 55) failures.push(`expected low score for line 4 audio vs line 1, got ${cross41.overall}`);
if (same1.overall <= cross14.overall) failures.push('line 1 should score higher against itself than against line 4');
if (same4.overall <= cross41.overall) failures.push('line 4 should score higher against itself than against line 1');

if (failures.length) {
  console.error('WHISPER TEST FAILED:\n' + failures.map((f) => ' - ' + f).join('\n'));
  process.exit(1);
}
console.log('WHISPER TEST PASSED');
