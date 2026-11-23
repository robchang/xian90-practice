import { pinyin } from 'pinyin-pro'
import type { SyllableScore } from './types'

export type ScoreColor = 'green' | 'yellow' | 'red'

export interface UtteranceSyllable extends SyllableScore {
  color: ScoreColor
  toneAccepted: boolean
  toneSource: 'pitch' | 'asr' | 'none'
}

export interface UtteranceScore {
  overall: number
  syllables: UtteranceSyllable[]
  tip: string
  missedPinyin: string[]
}

export interface ScoreOptions {
  recognizedPinyin?: string[]
  expectedPinyin?: string[]
  /** Per-expected-syllable tone guess from pitch (1–4), or null if unreliable. */
  pitchToneGuesses?: Array<number | null>
}

interface Token {
  character: string
  pinyin: string
  initial: string
  final: string
  tone: number
}

export function hanChars(text: string): string[] {
  return Array.from(text).filter((c) => /[\u4e00-\u9fff]/.test(c))
}

export function getTone(py: string): number {
  if (/[āēīōūǖ]/.test(py)) return 1
  if (/[áéíóúǘ]/.test(py)) return 2
  if (/[ǎěǐǒǔǚ]/.test(py)) return 3
  if (/[àèìòùǜ]/.test(py)) return 4
  return 0
}

export function removeTone(py: string): string {
  return py
    .replace(/[āáǎà]/g, 'a')
    .replace(/[ēéěè]/g, 'e')
    .replace(/[īíǐì]/g, 'i')
    .replace(/[ōóǒò]/g, 'o')
    .replace(/[ūúǔù]/g, 'u')
    .replace(/[ǖǘǚǜü]/g, 'v')
    .toLowerCase()
}

export function getInitialFinal(py: string): { initial: string; final: string; tone: number } {
  const tone = getTone(py)
  const noTone = removeTone(py)
  const initials = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w']
  for (const initial of initials) {
    if (noTone.startsWith(initial)) {
      return { initial, final: noTone.slice(initial.length), tone }
    }
  }
  return { initial: '', final: noTone, tone }
}

function pinyinForChars(chars: string[], sandhi: boolean): string[] {
  if (chars.length === 0) return []
  const list = pinyin(chars.join(''), {
    toneType: 'symbol',
    type: 'array',
    toneSandhi: sandhi,
  }) as string[]
  return list.slice(0, chars.length)
}

function makeToken(character: string, py: string): Token {
  const parts = getInitialFinal(py)
  return { character, pinyin: py, ...parts }
}

export function acceptedTonesForSyllable(chinese: string, index: number): number[] {
  const chars = hanChars(chinese)
  if (index < 0 || index >= chars.length) return []
  const citation = pinyinForChars(chars, false)
  const spoken = pinyinForChars(chars, true)
  const tones = new Set<number>()
  tones.add(getTone(citation[index] || ''))
  tones.add(getTone(spoken[index] || ''))

  const char = chars[index]
  const nextCitationTone =
    index + 1 < chars.length ? getTone(citation[index + 1] || '') : null
  const toneless = removeTone(citation[index] || '')

  if (char === '一' || toneless === 'yi') {
    tones.add(1)
    if (nextCitationTone === 4) tones.add(2)
    else tones.add(4)
  }
  if (char === '不' || toneless === 'bu') {
    tones.add(4)
    if (nextCitationTone === 4) tones.add(2)
  }
  if (getTone(citation[index] || '') === 3 && nextCitationTone === 3) {
    tones.add(2)
    tones.add(3)
  }

  return [...tones].filter((t) => t > 0).sort((a, b) => a - b)
}

function syllableCost(a: Token, b: Token): number {
  const initial = a.initial === b.initial
  const fin = a.final === b.final
  if (initial && fin) return 0
  if (initial || fin) return 0.45
  return 1
}

/** Align recognized tokens to expected tokens. Returns recognized index or null for each expected syllable. */
export function alignSyllables(expected: Token[], recognized: Token[]): Array<number | null> {
  const n = expected.length
  const m = recognized.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0))
  const bt: string[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill('S'))
  for (let i = 0; i <= n; i++) {
    dp[i][0] = i
    if (i) bt[i][0] = 'D'
  }
  for (let j = 0; j <= m; j++) {
    dp[0][j] = j
    if (j) bt[0][j] = 'I'
  }
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const sub = dp[i - 1][j - 1] + syllableCost(expected[i - 1], recognized[j - 1])
      const del = dp[i - 1][j] + 1
      const ins = dp[i][j - 1] + 1
      if (sub <= del && sub <= ins) {
        dp[i][j] = sub
        bt[i][j] = 'S'
      } else if (del <= ins) {
        dp[i][j] = del
        bt[i][j] = 'D'
      } else {
        dp[i][j] = ins
        bt[i][j] = 'I'
      }
    }
  }
  const map: Array<number | null> = Array(n).fill(null)
  let i = n
  let j = m
  while (i > 0 || j > 0) {
    const op = i === 0 ? 'I' : j === 0 ? 'D' : bt[i][j]
    if (op === 'S' && i > 0 && j > 0) {
      map[i - 1] = j - 1
      i--
      j--
    } else if (op === 'D' && i > 0) {
      map[i - 1] = null
      i--
    } else {
      j--
    }
  }
  return map
}

function colorFor(initialMatch: boolean, finalMatch: boolean, toneRejected: boolean): ScoreColor {
  if (initialMatch && finalMatch) return toneRejected ? 'yellow' : 'green'
  if (initialMatch || finalMatch) return 'yellow'
  return 'red'
}

function syllableNumericScore(initialMatch: boolean, finalMatch: boolean, toneAccepted: boolean, toneReliable: boolean): number {
  let score = 0
  let weight = 0
  score += initialMatch ? 0.4 : 0
  weight += 0.4
  score += finalMatch ? 0.4 : 0
  weight += 0.4
  if (toneReliable) {
    score += toneAccepted ? 0.2 : 0
    weight += 0.2
  }
  return weight === 0 ? 0 : score / weight
}

export function buildTip(syllables: UtteranceSyllable[], overall: number): string {
  if (overall >= 90) return 'Clear and steady. Beautiful work.'
  if (overall >= 85) return 'Nice — that will hold on the podium.'

  const toneMiss = syllables.find((s) => s.initialMatch && s.finalMatch && !s.toneAccepted && s.toneSource === 'pitch')
  if (toneMiss) {
    return `The tone on ${toneMiss.character} sounded off. Aim for ${toneMiss.expected}.`
  }

  const red = syllables.find((s) => s.color === 'red')
  if (red) {
    return `Let's listen again to ${red.character} (${red.expected}).`
  }

  const yellow = syllables.find((s) => s.color === 'yellow')
  if (yellow && !yellow.toneAccepted) {
    return `Almost — check the tone on ${yellow.character} (${yellow.expected}).`
  }
  if (yellow) {
    return `Close on ${yellow.character}. Expected ${yellow.expected}, heard ${yellow.recognized || '—'}.`
  }
  return 'Try that one more time — you are close.'
}

export function scoreUtterance(
  targetChinese: string,
  recognizedText: string,
  options: ScoreOptions = {}
): UtteranceScore {
  const targetChars = hanChars(targetChinese)
  const expectedPy = options.expectedPinyin?.length
    ? options.expectedPinyin
    : pinyinForChars(targetChars, true)

  const recognizedChars = hanChars(recognizedText)
  const recognizedPy = options.recognizedPinyin?.length
    ? options.recognizedPinyin
    : recognizedChars.length > 0
      ? pinyinForChars(recognizedChars, true)
      : []

  const expectedTokens = targetChars.map((ch, i) => makeToken(ch, expectedPy[i] || ''))
  const recognizedTokens = recognizedPy.map((py, i) => makeToken(recognizedChars[i] || '', py))
  const alignment = alignSyllables(expectedTokens, recognizedTokens)

  const syllables: UtteranceSyllable[] = expectedTokens.map((exp, i) => {
    const recIndex = alignment[i]
    const rec = recIndex === null ? null : recognizedTokens[recIndex]
    const initialMatch = !!rec && exp.initial === rec.initial
    const finalMatch = !!rec && exp.final === rec.final
    const accepted = acceptedTonesForSyllable(targetChars.join(''), i)
    const pitchGuess = options.pitchToneGuesses?.[i]
    let toneSource: UtteranceSyllable['toneSource'] = 'none'
    let toneAccepted = true
    let toneReliable = false

    if (pitchGuess && pitchGuess > 0) {
      toneSource = 'pitch'
      toneAccepted = accepted.includes(pitchGuess)
      toneReliable = true
    } else if (rec && rec.pinyin) {
      // Dictionary tone of the recognized characters is a weak signal.
      // Use it only to honor explicit pinyin (tests / sandhi variants);
      // do not treat a dictionary tone conflict as reliable by itself unless
      // the caller supplied recognizedPinyin.
      toneSource = 'asr'
      toneAccepted = accepted.includes(rec.tone) || (initialMatch && finalMatch && !options.recognizedPinyin)
      toneReliable = !!options.recognizedPinyin
    }

    const score = syllableNumericScore(initialMatch, finalMatch, toneAccepted, toneReliable)
    const color = colorFor(initialMatch, finalMatch, toneReliable && !toneAccepted)
    return {
      character: exp.character,
      expected: exp.pinyin,
      recognized: rec?.pinyin || '',
      initialMatch,
      finalMatch,
      toneMatch: toneAccepted,
      toneAccepted,
      toneSource,
      score,
      color,
    }
  })

  const overall = calculateOverallScore(syllables)
  const missedPinyin = syllables
    .filter((s) => s.color !== 'green')
    .map((s) => s.expected)
    .filter(Boolean)

  return {
    overall,
    syllables,
    tip: buildTip(syllables, overall),
    missedPinyin,
  }
}

/** Backward-compatible wrapper used by the older Record screen. */
export function scoreTranscription(targetChinese: string, recognizedText: string): SyllableScore[] {
  return scoreUtterance(targetChinese, recognizedText).syllables
}

export function calculateOverallScore(syllableScores: SyllableScore[]): number {
  if (syllableScores.length === 0) return 0
  const total = syllableScores.reduce((sum, s) => sum + s.score, 0)
  return Math.round((total / syllableScores.length) * 100)
}

export function detectPitch(audioBuffer: AudioBuffer): number[] {
  const sampleRate = audioBuffer.sampleRate
  const data = audioBuffer.getChannelData(0)
  const pitches: number[] = []
  const frameSize = 2048
  const hopSize = 512

  for (let i = 0; i < data.length - frameSize; i += hopSize) {
    const frame = data.slice(i, i + frameSize)
    const pitch = autoCorrelate(frame, sampleRate)
    if (pitch > 0) pitches.push(pitch)
  }
  return pitches
}

/**
 * Very rough per-syllable tone guess from a pitch contour, by splitting
 * voiced frames evenly across syllables and looking at slope + relative height.
 * Returns null when there is not enough signal to be honest.
 */
export function guessTonesFromPitch(pitches: number[], syllableCount: number): Array<number | null> {
  if (syllableCount <= 0 || pitches.length < syllableCount * 2) {
    return Array(syllableCount).fill(null)
  }
  const guesses: Array<number | null> = []
  const size = Math.floor(pitches.length / syllableCount)
  for (let i = 0; i < syllableCount; i++) {
    const slice = pitches.slice(i * size, i === syllableCount - 1 ? pitches.length : (i + 1) * size)
    guesses.push(classifyToneSlice(slice, pitches))
  }
  return guesses
}

function classifyToneSlice(slice: number[], all: number[]): number | null {
  if (slice.length < 2) return null
  const mean = slice.reduce((a, b) => a + b, 0) / slice.length
  const global = all.reduce((a, b) => a + b, 0) / all.length
  const start = slice.slice(0, Math.max(1, Math.floor(slice.length * 0.3))).reduce((a, b) => a + b, 0) / Math.max(1, Math.floor(slice.length * 0.3))
  const end = slice.slice(Math.floor(slice.length * 0.7)).reduce((a, b) => a + b, 0) / Math.max(1, slice.length - Math.floor(slice.length * 0.7))
  const mid = slice[Math.floor(slice.length / 2)]
  const delta = (end - start) / mean
  const dip = mid < start && mid < end
  if (dip && (start - mid) / mean > 0.06) return 3
  if (delta > 0.08) return 2
  if (delta < -0.08) return 4
  if (mean > global * 1.05) return 1
  if (Math.abs(delta) < 0.05) return 1
  return null
}

function autoCorrelate(buffer: Float32Array, sampleRate: number): number {
  const size = buffer.length
  const maxSamples = Math.floor(size / 2)
  let bestOffset = -1
  let bestCorrelation = 0
  let rms = 0
  for (let i = 0; i < size; i++) rms += buffer[i] * buffer[i]
  rms = Math.sqrt(rms / size)
  if (rms < 0.01) return -1

  let lastCorrelation = 1
  for (let offset = 1; offset < maxSamples; offset++) {
    let correlation = 0
    for (let i = 0; i < maxSamples; i++) {
      correlation += Math.abs(buffer[i] - buffer[i + offset])
    }
    correlation = 1 - correlation / maxSamples
    if (correlation > 0.9 && correlation > lastCorrelation) {
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation
        bestOffset = offset
      }
    }
    lastCorrelation = correlation
  }
  if (bestCorrelation > 0.01 && bestOffset !== -1) return sampleRate / bestOffset
  return -1
}
