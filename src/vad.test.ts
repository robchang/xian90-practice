import { describe, expect, test } from 'vitest'
import {
  createVadController,
  runVadOnPcm,
  shouldScoreAttempt,
  MIN_RECORD_MS,
  TRAILING_SILENCE_MS,
} from './vad'

function drive(vad: ReturnType<typeof createVadController>, rms: number, from: number, to: number, step = 50) {
  const stops: number[] = []
  for (let t = from; t <= to; t += step) {
    if (vad.process(rms, t).shouldStop) stops.push(t)
  }
  return stops
}

describe('VAD onset and trailing silence', () => {
  test('silence then speech after 3s must not stop early', () => {
    const vad = createVadController()
    expect(drive(vad, 0.001, 0, 3000)).toEqual([])
    expect(vad.heardSpeech).toBe(false)

    // a few voiced frames around 3s
    expect(vad.process(0.15, 3000).shouldStop).toBe(false)
    expect(vad.process(0.15, 3050).shouldStop).toBe(false)
    const onset = vad.process(0.15, 3100)
    expect(onset.heardSpeech).toBe(true)
    expect(onset.shouldStop).toBe(false)
    expect(drive(vad, 0.15, 3150, 4000)).toEqual([])
  })

  test('speech then 1.5s silence stops (after the 2s minimum)', () => {
    const vad = createVadController()
    expect(drive(vad, 0.15, 0, 800)).toEqual([])
    expect(vad.heardSpeech).toBe(true)

    // trailing silence just short of 1.5s must not stop
    const almost = 800 + TRAILING_SILENCE_MS - 50
    expect(drive(vad, 0.001, 850, almost)).toEqual([])

    const stopAt = 800 + TRAILING_SILENCE_MS
    expect(stopAt).toBeGreaterThanOrEqual(MIN_RECORD_MS)
    expect(vad.process(0.001, stopAt).shouldStop).toBe(true)
  })

  test('1s of trailing silence after speech is not enough', () => {
    const vad = createVadController()
    drive(vad, 0.15, 0, 800)
    expect(drive(vad, 0.001, 850, 800 + 1000)).toEqual([])
    expect(vad.heardSpeech).toBe(true)
  })

  test('pure silence never auto-stops before the max duration', () => {
    const vad = createVadController({ maxRecordMs: 8000 })
    expect(drive(vad, 0.001, 0, 7900, 100)).toEqual([])
    expect(vad.heardSpeech).toBe(false)
    expect(vad.process(0.001, 8000).shouldStop).toBe(true)
  })

  test('quieter speech after 3s silence is still detected (noise floor must not chase the voice)', () => {
    const sampleRate = 16000
    const silence = new Float32Array(sampleRate * 3)
    const speech = new Float32Array(sampleRate * 1)
    for (let i = 0; i < speech.length; i++) speech[i] = Math.sin((2 * Math.PI * 220 * i) / sampleRate) * 0.08
    const trail = new Float32Array(Math.round(sampleRate * 1.6))
    const samples = new Float32Array(silence.length + speech.length + trail.length)
    samples.set(silence, 0)
    samples.set(speech, silence.length)
    samples.set(trail, silence.length + speech.length)
    const result = runVadOnPcm(samples, sampleRate)
    expect(result.heardSpeech).toBe(true)
    expect(result.heardAtMs).toBeGreaterThanOrEqual(3000)
    expect(result.stoppedAtMs).not.toBeNull()
    expect(result.stoppedAtMs!).toBeGreaterThan(3000)
  })

  test('runVadOnPcm: 3s silence + speech + 1.6s silence stops after the speech', () => {
    const sampleRate = 16000
    const silence = new Float32Array(sampleRate * 3)
    const speech = new Float32Array(sampleRate * 1)
    for (let i = 0; i < speech.length; i++) speech[i] = Math.sin((2 * Math.PI * 220 * i) / sampleRate) * 0.3
    const trail = new Float32Array(Math.round(sampleRate * 1.6))
    const samples = new Float32Array(silence.length + speech.length + trail.length)
    samples.set(silence, 0)
    samples.set(speech, silence.length)
    samples.set(trail, silence.length + speech.length)

    const result = runVadOnPcm(samples, sampleRate)
    expect(result.heardSpeech).toBe(true)
    expect(result.heardAtMs).toBeGreaterThanOrEqual(3000)
    expect(result.heardAtMs).toBeLessThan(3500)
    expect(result.stoppedAtMs).not.toBeNull()
    expect(result.stoppedAtMs!).toBeGreaterThan(3000 + 1000)
    // Must not have stopped during the opening silence.
    expect(result.stoppedAtMs!).toBeGreaterThan(3000)
  })
})

describe('shouldScoreAttempt', () => {
  test('does not count silence or empty recognition', () => {
    expect(shouldScoreAttempt(false, '你好')).toBe(false)
    expect(shouldScoreAttempt(true, '')).toBe(false)
    expect(shouldScoreAttempt(true, '   ')).toBe(false)
    expect(shouldScoreAttempt(true, null)).toBe(false)
    expect(shouldScoreAttempt(true, '不怕死')).toBe(true)
  })
})
