import { assetUrl } from './assetUrl'
import {
  createVadController,
  maxRecordMsFor,
  POST_PLAYBACK_DELAY_MS,
  type VadController,
} from './vad'

export { POST_PLAYBACK_DELAY_MS }

export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i))
  }
  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeStr(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    offset += 2
  }
  return new Blob([buffer], { type: 'audio/wav' })
}

export function downsampleTo16k(input: Float32Array, inputRate: number): Float32Array {
  if (inputRate === 16000) return input
  const ratio = inputRate / 16000
  const outLength = Math.round(input.length / ratio)
  const out = new Float32Array(outLength)
  for (let i = 0; i < outLength; i++) {
    const start = Math.floor(i * ratio)
    const end = Math.min(input.length, Math.floor((i + 1) * ratio))
    let sum = 0
    for (let j = start; j < end; j++) sum += input[j]
    out[i] = end > start ? sum / (end - start) : input[start] || 0
  }
  return out
}

export function audioBufferToMono(buffer: AudioBuffer): { samples: Float32Array; sampleRate: number } {
  const channels = buffer.numberOfChannels
  const length = buffer.length
  const samples = new Float32Array(length)
  for (let c = 0; c < channels; c++) {
    const data = buffer.getChannelData(c)
    for (let i = 0; i < length; i++) samples[i] += data[i] / channels
  }
  return { samples, sampleRate: buffer.sampleRate }
}

export function waitMs(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      window.clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort)
  })
}

export async function playReference(opts: {
  audioUrl?: string
  text: string
  playbackRate?: number
  signal?: AbortSignal
}): Promise<{ durationMs: number }> {
  const rate = opts.playbackRate ?? 1
  if (opts.audioUrl) {
    try {
      const durationMs = await playHtmlAudio(assetUrl(opts.audioUrl), rate, opts.signal)
      return { durationMs }
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') throw err
      const durationMs = await speakChinese(opts.text, rate, opts.signal)
      return { durationMs }
    }
  }
  const durationMs = await speakChinese(opts.text, rate, opts.signal)
  return { durationMs }
}

async function playHtmlAudio(url: string, rate: number, signal?: AbortSignal): Promise<number> {
  const audio = new Audio()
  audio.preload = 'auto'
  audio.src = url
  audio.playbackRate = rate
  const el = audio as HTMLAudioElement & { preservesPitch?: boolean; webkitPreservesPitch?: boolean }
  el.preservesPitch = true
  el.webkitPreservesPitch = true

  await new Promise<void>((resolve, reject) => {
    if (audio.readyState >= 2) {
      resolve()
      return
    }
    const onReady = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new Error('audio-error'))
    }
    const cleanup = () => {
      audio.removeEventListener('canplaythrough', onReady)
      audio.removeEventListener('loadeddata', onReady)
      audio.removeEventListener('error', onError)
    }
    audio.addEventListener('canplaythrough', onReady)
    audio.addEventListener('loadeddata', onReady)
    audio.addEventListener('error', onError)
    audio.load()
  })

  const startedAt = performance.now()
  await new Promise<void>((resolve, reject) => {
    let settled = false
    let watchdog = 0
    const finish = () => {
      if (settled) return
      settled = true
      window.clearTimeout(watchdog)
      signal?.removeEventListener('abort', onAbort)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
      resolve()
    }
    const fail = (err: unknown) => {
      if (settled) return
      settled = true
      window.clearTimeout(watchdog)
      signal?.removeEventListener('abort', onAbort)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
      reject(err)
    }
    const onAbort = () => {
      audio.pause()
      fail(new DOMException('Aborted', 'AbortError'))
    }
    const onEnded = () => {
      const duration = audio.duration
      if (Number.isFinite(duration) && duration > 0.4 && audio.currentTime < duration * 0.85) {
        return
      }
      finish()
    }
    const onError = () => fail(new Error('audio-error'))
    signal?.addEventListener('abort', onAbort)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)
    const expectedMs = Number.isFinite(audio.duration) && audio.duration > 0
      ? (audio.duration / Math.max(0.4, rate)) * 1000 + 800
      : 15000
    watchdog = window.setTimeout(finish, expectedMs)
    audio.play().catch(fail)
    if (signal?.aborted) onAbort()
  })

  return Math.max(0, performance.now() - startedAt)
}

function speakChinese(text: string, rate: number, signal?: AbortSignal): Promise<number> {
  return new Promise((resolve, reject) => {
    const startedAt = performance.now()
    const durationGuess = Math.max(1200, (text.length * 280) / Math.max(0.5, rate))
    if (!('speechSynthesis' in window)) {
      resolve(0)
      return
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'zh-CN'
    utterance.rate = Math.max(0.5, Math.min(1.2, rate))
    let settled = false
    let watchdog = 0
    const finish = () => {
      if (settled) return
      settled = true
      signal?.removeEventListener('abort', onAbort)
      window.clearTimeout(watchdog)
      resolve(performance.now() - startedAt)
    }
    const onAbort = () => {
      if (settled) return
      settled = true
      window.speechSynthesis.cancel()
      window.clearTimeout(watchdog)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort)
    utterance.onend = finish
    // A quick error must not look like "playback finished" and open the mic early.
    utterance.onerror = () => {
      window.setTimeout(finish, 400)
    }
    watchdog = window.setTimeout(finish, durationGuess + 800)
    window.speechSynthesis.speak(utterance)
  })
}

export async function playBlob(blob: Blob): Promise<void> {
  const url = URL.createObjectURL(blob)
  try {
    const audio = new Audio(url)
    await new Promise<void>((resolve, reject) => {
      audio.onended = () => resolve()
      audio.onerror = () => reject(new Error('playback failed'))
      audio.play().catch(reject)
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

export interface MicSession {
  stream: MediaStream
  ctx: AudioContext
}

let sharedMic: MicSession | null = null

export async function resumeAudioContext(ctx: AudioContext): Promise<void> {
  const state = ctx.state as AudioContextState | 'interrupted'
  if (state === 'suspended' || state === 'interrupted') {
    try {
      await ctx.resume()
    } catch {
      /* iOS may still refuse if there is no gesture */
    }
  }
}

/** Open (or reuse) the mic and resume AudioContext. Call from a user tap on iOS. */
export async function prepareMic(): Promise<MicSession> {
  if (sharedMic) {
    const live = sharedMic.stream.getTracks().some((t) => t.readyState === 'live')
    if (live) {
      await resumeAudioContext(sharedMic.ctx)
      return sharedMic
    }
    releaseSharedMic()
  }
  const w = window as Window & { webkitAudioContext?: typeof AudioContext }
  const AudioCtx = window.AudioContext || w.webkitAudioContext
  if (!AudioCtx) throw new Error('Web Audio is not available')
  const ctx = new AudioCtx()
  await resumeAudioContext(ctx)
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  })
  await resumeAudioContext(ctx)
  sharedMic = { stream, ctx }
  return sharedMic
}

export function releaseSharedMic(): void {
  if (!sharedMic) return
  sharedMic.stream.getTracks().forEach((t) => t.stop())
  void sharedMic.ctx.close().catch(() => {})
  sharedMic = null
}

export interface RecordedTake {
  blob: Blob
  samples16k: Float32Array
  sampleRate: 16000
  heardSpeech: boolean
}

export interface RecorderHandles {
  stop: () => Promise<RecordedTake>
  heardSpeech: () => boolean
}

/**
 * Record from the mic, collecting PCM for Whisper and a WAV blob for playback.
 * When handsFree is on, auto-stops after trailing silence following speech onset,
 * or at max(8s, 3× reference). The silence timer never starts before onset.
 * Tap-to-talk still auto-stops at the max duration only.
 */
export async function startPhraseRecording(opts: {
  onLevel?: (rms: number) => void
  onAutoStop?: () => void
  handsFree?: boolean
  referenceDurationMs?: number
  stream?: MediaStream
  audioContext?: AudioContext
}): Promise<RecorderHandles> {
  const mic = opts.stream && opts.audioContext
    ? { stream: opts.stream, ctx: opts.audioContext }
    : await prepareMic()
  await resumeAudioContext(mic.ctx)

  const source = mic.ctx.createMediaStreamSource(mic.stream)
  const samples: number[] = []
  const processor = mic.ctx.createScriptProcessor(4096, 1, 1)
  const vad: VadController = createVadController({
    maxRecordMs: maxRecordMsFor(opts.referenceDurationMs),
  })
  let finished = false
  let heardSpeech = false
  let resolver: (value: RecordedTake) => void
  const done = new Promise<RecordedTake>((resolve) => {
    resolver = resolve
  })

  const mute = mic.ctx.createGain()
  mute.gain.value = 0

  const finish = () => {
    if (finished) return
    finished = true
    processor.onaudioprocess = null
    try { processor.disconnect() } catch { /* ignore */ }
    try { source.disconnect() } catch { /* ignore */ }
    try { mute.disconnect() } catch { /* ignore */ }
    const raw = new Float32Array(samples)
    const samples16k = downsampleTo16k(raw, mic.ctx.sampleRate)
    const blob = encodeWav(samples16k, 16000)
    resolver({ blob, samples16k, sampleRate: 16000, heardSpeech })
  }

  processor.onaudioprocess = (event) => {
    if (finished) return
    const input = event.inputBuffer.getChannelData(0)
    for (let i = 0; i < input.length; i++) samples.push(input[i])
    let sum = 0
    for (let i = 0; i < input.length; i++) sum += input[i] * input[i]
    const rms = Math.sqrt(sum / input.length)
    opts.onLevel?.(rms)
    const decision = vad.process(rms, performance.now())
    if (decision.heardSpeech) heardSpeech = true
    if (decision.shouldStop && (opts.handsFree || decision.reason === 'max')) {
      opts.onAutoStop?.()
      finish()
    }
  }

  source.connect(processor)
  processor.connect(mute)
  mute.connect(mic.ctx.destination)

  return {
    heardSpeech: () => heardSpeech,
    stop: async () => {
      finish()
      return done
    },
  }
}
