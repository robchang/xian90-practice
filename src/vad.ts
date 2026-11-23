/** Trailing silence after speech onset before auto-stop. */
export const TRAILING_SILENCE_MS = 1500
/** Do not auto-stop before this much recording time has elapsed. */
export const MIN_RECORD_MS = 2000
/** Floor for the maximum take, extended to 3× the reference when that is longer. */
export const MAX_RECORD_MS_FLOOR = 8000
export const POST_PLAYBACK_DELAY_MS = 300

const MIN_THRESHOLD = 0.02
const ONSET_FRAMES = 3
const NOISE_ALPHA = 0.08

export interface VadConfig {
  trailingSilenceMs?: number
  minRecordMs?: number
  maxRecordMs?: number
  minThreshold?: number
  onsetFrames?: number
}

export interface VadDecision {
  shouldStop: boolean
  reason: 'max' | 'trailing-silence' | null
  heardSpeech: boolean
  rms: number
  threshold: number
}

export function maxRecordMsFor(referenceDurationMs?: number): number {
  const scaled = typeof referenceDurationMs === 'number' && Number.isFinite(referenceDurationMs)
    ? referenceDurationMs * 3
    : 0
  return Math.max(MAX_RECORD_MS_FLOOR, scaled)
}

/**
 * Adaptive RMS VAD. The trailing-silence timer starts only after speech onset
 * (several frames above a noise-floor-relative threshold). Initial silence,
 * no matter how long (until max), will not end the take.
 */
export function createVadController(config: VadConfig = {}) {
  const trailingSilenceMs = config.trailingSilenceMs ?? TRAILING_SILENCE_MS
  const minRecordMs = config.minRecordMs ?? MIN_RECORD_MS
  const maxRecordMs = config.maxRecordMs ?? MAX_RECORD_MS_FLOOR
  const minThreshold = config.minThreshold ?? MIN_THRESHOLD
  const onsetFrames = config.onsetFrames ?? ONSET_FRAMES

  let heardSpeech = false
  let voicedStreak = 0
  let noiseFloor = 0.004
  let lastVoicedAt = 0
  let startedAt: number | null = null
  let heardAt: number | null = null

  function process(rms: number, nowMs: number): VadDecision {
    if (startedAt === null) startedAt = nowMs
    const safeRms = Number.isFinite(rms) ? Math.max(0, rms) : 0

    // Never let speech raise the noise floor, or the threshold chases the voice
    // and onset is never declared (this was the bug on real line MP3s).
    const threshold = Math.max(minThreshold, noiseFloor * 3.5 + 0.008)
    if (safeRms < threshold) {
      noiseFloor = noiseFloor * (1 - NOISE_ALPHA) + safeRms * NOISE_ALPHA
    }

    if (safeRms >= threshold) {
      voicedStreak += 1
      lastVoicedAt = nowMs
      if (!heardSpeech && voicedStreak >= onsetFrames) {
        heardSpeech = true
        heardAt = nowMs
      }
    } else {
      voicedStreak = 0
    }

    const elapsed = nowMs - startedAt
    const trailing = heardSpeech ? nowMs - lastVoicedAt : 0
    const hitMax = elapsed >= maxRecordMs
    const hitTrail = heardSpeech && elapsed >= minRecordMs && trailing >= trailingSilenceMs

    return {
      shouldStop: hitMax || hitTrail,
      reason: hitMax ? 'max' : hitTrail ? 'trailing-silence' : null,
      heardSpeech,
      rms: safeRms,
      threshold,
    }
  }

  return {
    process,
    get heardSpeech() {
      return heardSpeech
    },
    get heardAtMs() {
      return heardAt
    },
  }
}

export type VadController = ReturnType<typeof createVadController>

/** Run the VAD over a complete PCM buffer (for tests and injected-audio checks). */
export function runVadOnPcm(
  samples: Float32Array,
  sampleRate: number,
  config: VadConfig = {},
  frameSamples = 1024
): { stoppedAtMs: number | null; heardSpeech: boolean; heardAtMs: number | null } {
  const vad = createVadController(config)
  let stoppedAtMs: number | null = null
  for (let i = 0; i < samples.length; i += frameSamples) {
    const end = Math.min(samples.length, i + frameSamples)
    let sum = 0
    for (let j = i; j < end; j++) sum += samples[j] * samples[j]
    const rms = Math.sqrt(sum / Math.max(1, end - i))
    const nowMs = (end / sampleRate) * 1000
    const decision = vad.process(rms, nowMs)
    if (decision.shouldStop) {
      stoppedAtMs = nowMs
      break
    }
  }
  return { stoppedAtMs, heardSpeech: vad.heardSpeech, heardAtMs: vad.heardAtMs }
}

/** A take counts only when we heard voice and got some recognized text. */
export function shouldScoreAttempt(heardSpeech: boolean, transcript: string | null | undefined): boolean {
  return Boolean(heardSpeech && transcript && transcript.trim().length > 0)
}
