import { pinyin } from 'pinyin-pro';
import type { SyllableScore } from './types';


function getTone(py: string): number {
  if (/[āēīōūǖ]/.test(py)) return 1;
  if (/[áéíóúǘ]/.test(py)) return 2;
  if (/[ǎěǐǒǔǚ]/.test(py)) return 3;
  if (/[àèìòùǜ]/.test(py)) return 4;
  return 0;
}

function removeTone(py: string): string {
  return py
    .replace(/[āáǎà]/g, 'a')
    .replace(/[ēéěè]/g, 'e')
    .replace(/[īíǐì]/g, 'i')
    .replace(/[ōóǒò]/g, 'o')
    .replace(/[ūúǔù]/g, 'u')
    .replace(/[ǖǘǚǜ]/g, 'ü');
}

function getInitialFinal(py: string): { initial: string; final: string; tone: number } {
  const tone = getTone(py);
  const noTone = removeTone(py);
  
  const initials = ['b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'zh', 'ch', 'sh', 'r', 'z', 'c', 's', 'y', 'w'];
  
  for (const initial of initials.sort((a, b) => b.length - a.length)) {
    if (noTone.startsWith(initial)) {
      return {
        initial,
        final: noTone.slice(initial.length),
        tone
      };
    }
  }
  
  return { initial: '', final: noTone, tone };
}

function acceptToneVariant(expected: number, recognized: number, expectedSyllable: string, _recognizedSyllable: string): boolean {
  const expNoTone = removeTone(expectedSyllable).toLowerCase();
  
  if (expNoTone === 'yi' || expNoTone === 'yī' || expNoTone === 'yí' || expNoTone === 'yǐ' || expNoTone === 'yì') {
    return true;
  }
  
  if (expNoTone === 'bu' || expNoTone === 'bū' || expNoTone === 'bú' || expNoTone === 'bǔ' || expNoTone === 'bù') {
    return true;
  }
  
  if (expected === 3 && recognized === 2) {
    return true;
  }
  
  return expected === recognized;
}

export function scoreTranscription(
  targetChinese: string,
  recognizedText: string
): SyllableScore[] {
  const targetChars = Array.from(targetChinese).filter(c => /[\u4e00-\u9fa5]/.test(c));
  const targetPinyin = pinyin(targetChinese, { toneType: 'symbol', type: 'array' });
  
  const recognizedChars = Array.from(recognizedText).filter(c => /[\u4e00-\u9fa5]/.test(c));
  const recognizedPinyin = recognizedChars.length > 0 
    ? pinyin(recognizedText, { toneType: 'symbol', type: 'array' })
    : [];
  
  const scores: SyllableScore[] = [];
  
  for (let i = 0; i < targetChars.length; i++) {
    const expectedPy = targetPinyin[i] || '';
    const recognizedPy = recognizedPinyin[i] || '';
    
    const expectedParts = getInitialFinal(expectedPy);
    const recognizedParts = getInitialFinal(recognizedPy);
    
    const initialMatch = expectedParts.initial === recognizedParts.initial;
    const finalMatch = expectedParts.final === recognizedParts.final;
    const toneMatch = acceptToneVariant(
      expectedParts.tone,
      recognizedParts.tone,
      expectedPy,
      recognizedPy
    );
    
    let score = 0;
    if (initialMatch) score += 0.3;
    if (finalMatch) score += 0.4;
    if (toneMatch) score += 0.3;
    
    scores.push({
      character: targetChars[i],
      expected: expectedPy,
      recognized: recognizedPy,
      initialMatch,
      finalMatch,
      toneMatch,
      score
    });
  }
  
  return scores;
}

export function calculateOverallScore(syllableScores: SyllableScore[]): number {
  if (syllableScores.length === 0) return 0;
  const total = syllableScores.reduce((sum, s) => sum + s.score, 0);
  return Math.round((total / syllableScores.length) * 100);
}

export function detectPitch(audioBuffer: AudioBuffer): number[] {
  const sampleRate = audioBuffer.sampleRate;
  const data = audioBuffer.getChannelData(0);
  const pitches: number[] = [];
  
  const frameSize = 2048;
  const hopSize = 512;
  
  for (let i = 0; i < data.length - frameSize; i += hopSize) {
    const frame = data.slice(i, i + frameSize);
    const pitch = autoCorrelate(frame, sampleRate);
    if (pitch > 0) {
      pitches.push(pitch);
    }
  }
  
  return pitches;
}

function autoCorrelate(buffer: Float32Array, sampleRate: number): number {
  let size = buffer.length;
  let maxSamples = Math.floor(size / 2);
  let bestOffset = -1;
  let bestCorrelation = 0;
  let rms = 0;
  
  for (let i = 0; i < size; i++) {
    rms += buffer[i] * buffer[i];
  }
  rms = Math.sqrt(rms / size);
  
  if (rms < 0.01) return -1;
  
  let lastCorrelation = 1;
  for (let offset = 1; offset < maxSamples; offset++) {
    let correlation = 0;
    for (let i = 0; i < maxSamples; i++) {
      correlation += Math.abs(buffer[i] - buffer[i + offset]);
    }
    correlation = 1 - correlation / maxSamples;
    
    if (correlation > 0.9 && correlation > lastCorrelation) {
      const foundGoodCorrelation = correlation > bestCorrelation;
      if (foundGoodCorrelation) {
        bestCorrelation = correlation;
        bestOffset = offset;
      }
    }
    lastCorrelation = correlation;
  }
  
  if (bestCorrelation > 0.01 && bestOffset !== -1) {
    return sampleRate / bestOffset;
  }
  return -1;
}
