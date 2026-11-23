import { assetUrl } from './assetUrl'
import { diag, type TakeEndReason } from './diagnostics'
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

export function pickZhCnVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null
  const voices = window.speechSynthesis.getVoices() || []
  const zh = voices.filter((v) => {
    const key = `${v.lang} ${v.name}`
    return /zh[-_]?CN|zh[-_]?Hans|Chinese.*China|普通话|汉语/i.test(key) || /^zh/i.test(v.lang)
  })
  const prefer = (re: RegExp) => zh.find((v) => re.test(v.name))
  return (
    prefer(/Ting-Ting|Tingting|Mei-Jia|Meijia|Xiaoxiao|Xiaoyi|Lili|Huihui|Yaoyao/i) ||
    prefer(/female|女/i) ||
    zh.find((v) => /zh[-_]?CN/i.test(v.lang)) ||
    zh[0] ||
    null
  )
}

export function warmSpeechVoices(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  window.speechSynthesis.getVoices()
  window.speechSynthesis.addEventListener?.('voiceschanged', () => {
    window.speechSynthesis.getVoices()
  }, { once: true })
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
    const voice = pickZhCnVoice()
    if (voice) utterance.voice = voice
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
  const testHook = (typeof window !== 'undefined'
    && (window as Window & { __TEST_PREPARE_MIC?: () => Promise<MicSession> }).__TEST_PREPARE_MIC)
  if (typeof testHook === 'function' && !sharedMic) {
    sharedMic = await testHook()
    diag('mic', 'prepareMic used test hook')
    return sharedMic
  }
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

export const TAP_MAX_RECORD_MS = 20000

export function pickRecorderMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  const candidates = [
    'audio/mp4',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/aac',
    'audio/webm;codecs=opus',
    'audio/webm',
  ]
  return candidates.find((type) => {
    try {
      return MediaRecorder.isTypeSupported(type)
    } catch {
      return false
    }
  }) || ''
}

export async function decodeBlobToPcm16k(blob: Blob, ctx: AudioContext): Promise<Float32Array | null> {
  if (!blob || blob.size < 32) return null
  try {
    const copy = await blob.arrayBuffer()
    const audioBuffer = await ctx.decodeAudioData(copy.slice(0))
    const mono = audioBufferToMono(audioBuffer)
    return downsampleTo16k(mono.samples, mono.sampleRate)
  } catch (err) {
    diag('audio', 'decodeBlobToPcm16k failed', { error: String(err), type: blob.type, size: blob.size })
    return null
  }
}

export interface RecordedTake {
  blob: Blob
  samples16k: Float32Array
  sampleRate: 16000
  heardSpeech: boolean
  endReason: TakeEndReason
}

export interface RecorderHandles {
  stop: (reason?: TakeEndReason) => Promise<RecordedTake>
  heardSpeech: () => boolean
  endReason: () => TakeEndReason | null
}

/**
 * Record from the mic with MediaRecorder (Safari: audio/mp4, no timeslice).
 * In tap mode the only automatic end is the 20s cap; a Stop tap otherwise ends the take.
 * Unexpected track ended/mute or a recorder onstop we did not request is an interruption, not a score.
 */
export async function startPhraseRecording(opts: {
  onLevel?: (rms: number) => void
  onTick?: (elapsedMs: number) => void
  onAutoStop?: (reason: TakeEndReason) => void
  onInterrupted?: (reason: TakeEndReason) => void
  /** Desktop hands-free only. Ignored in tapMode. */
  handsFree?: boolean
  /** When true (iOS / mobile default), only user-stop or the 20s cap may end the take. */
  tapMode?: boolean
  referenceDurationMs?: number
  stream?: MediaStream
  audioContext?: AudioContext
}): Promise<RecorderHandles> {
  const tapMode = opts.tapMode !== false && (opts.tapMode === true || !opts.handsFree)
  const mic = opts.stream && opts.audioContext
    ? { stream: opts.stream, ctx: opts.audioContext }
    : await prepareMic()
  await resumeAudioContext(mic.ctx)
  diag('recorder', 'startPhraseRecording', {
    tapMode,
    handsFree: Boolean(opts.handsFree),
    tracks: mic.stream.getAudioTracks().map((t) => ({ ready: t.readyState, muted: t.muted, label: t.label })),
  })

  const source = mic.ctx.createMediaStreamSource(mic.stream)
  const analyser = mic.ctx.createAnalyser()
  analyser.fftSize = 2048
  source.connect(analyser)

  // PCM side channel for Whisper if the MediaRecorder blob cannot be decoded.
  const samples: number[] = []
  const processor = mic.ctx.createScriptProcessor(4096, 1, 1)
  const mute = mic.ctx.createGain()
  mute.gain.value = 0

  const mime = pickRecorderMimeType()
  let recorder: MediaRecorder | null = null
  const chunks: Blob[] = []
  try {
    recorder = mime ? new MediaRecorder(mic.stream, { mimeType: mime }) : new MediaRecorder(mic.stream)
    diag('recorder', 'MediaRecorder created', { mime: recorder.mimeType || mime || '(default)' })
  } catch (err) {
    diag('recorder', 'MediaRecorder unavailable, will use PCM only', { error: String(err) })
    recorder = null
  }

  const vad: VadController = createVadController({
    maxRecordMs: tapMode ? TAP_MAX_RECORD_MS : maxRecordMsFor(opts.referenceDurationMs),
  })
  let finished = false
  let stopRequested = false
  let heardSpeech = false
  let endReason: TakeEndReason | null = null
  let maxTimer = 0
  let tickTimer = 0
  let raf = 0
  const startedAt = performance.now()

  let resolver: (value: RecordedTake) => void
  const done = new Promise<RecordedTake>((resolve) => {
    resolver = resolve
  })

  const cleanupGraph = () => {
    processor.onaudioprocess = null
    try { processor.disconnect() } catch { /* ignore */ }
    try { source.disconnect() } catch { /* ignore */ }
    try { analyser.disconnect() } catch { /* ignore */ }
    try { mute.disconnect() } catch { /* ignore */ }
    window.clearTimeout(maxTimer)
    window.clearInterval(tickTimer)
    if (raf) cancelAnimationFrame(raf)
  }

  const assemble = async (): Promise<RecordedTake> => {
    let blob: Blob | null = null
    if (chunks.length) {
      blob = new Blob(chunks, { type: recorder?.mimeType || mime || 'audio/mp4' })
    }
    let samples16k: Float32Array | null = blob ? await decodeBlobToPcm16k(blob, mic.ctx) : null
    if (!samples16k || samples16k.length === 0) {
      const raw = new Float32Array(samples)
      samples16k = downsampleTo16k(raw, mic.ctx.sampleRate)
      if (!blob || blob.size === 0) blob = encodeWav(samples16k, 16000)
    }
    return {
      blob: blob!,
      samples16k,
      sampleRate: 16000,
      heardSpeech,
      endReason: endReason || 'unknown',
    }
  }

  const finalize = async () => {
    if (finished) return
    finished = true
    cleanupGraph()
    const take = await assemble()
    diag('recorder', 'finalize', {
      endReason: take.endReason,
      heardSpeech: take.heardSpeech,
      blobType: take.blob.type,
      blobSize: take.blob.size,
      samples: take.samples16k.length,
    })
    resolver(take)
  }

  const requestStop = (reason: TakeEndReason) => {
    if (finished || stopRequested) return
    stopRequested = true
    endReason = reason
    diag('recorder', 'requestStop', { reason })
    if (recorder && (recorder.state === 'recording' || recorder.state === 'paused')) {
      try {
        recorder.stop()
      } catch (err) {
        diag('recorder', 'MediaRecorder.stop threw', { error: String(err) })
        void finalize()
      }
    } else {
      void finalize()
    }
  }

  const interrupt = (reason: TakeEndReason) => {
    if (finished || stopRequested) return
    diag('recorder', 'interrupted', { reason })
    endReason = reason
    stopRequested = true
    opts.onInterrupted?.(reason)
    if (recorder && (recorder.state === 'recording' || recorder.state === 'paused')) {
      try { recorder.stop() } catch { void finalize() }
    } else {
      void finalize()
    }
  }

  if (recorder) {
    recorder.ondataavailable = (event) => {
      diag('recorder', 'ondataavailable', { size: event.data?.size || 0, type: event.data?.type })
      if (event.data && event.data.size > 0) chunks.push(event.data)
    }
    recorder.onerror = () => {
      diag('recorder', 'onerror')
      interrupt('mediarecorder-error')
    }
    recorder.onstop = () => {
      diag('recorder', 'onstop', { stopRequested, endReason })
      if (!stopRequested) {
        interrupt('mediarecorder-onstop-unexpected')
        return
      }
      void finalize()
    }
    // No timeslice: iOS Safari often produces a broken/empty file if one is set.
    recorder.start()
  }

  for (const track of mic.stream.getAudioTracks()) {
    track.addEventListener('ended', () => {
      diag('mic', 'track ended', { stopRequested, ready: track.readyState })
      if (!stopRequested) interrupt('track-ended')
    })
    track.addEventListener('mute', () => {
      diag('mic', 'track mute', { stopRequested })
      if (!stopRequested) interrupt('track-mute')
    })
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
    // Hands-free (desktop only) may auto-stop on trailing silence. Tap mode never does.
    if (!tapMode && opts.handsFree && decision.shouldStop && decision.reason === 'trailing-silence') {
      opts.onAutoStop?.('vad-silence')
      requestStop('vad-silence')
    }
  }
  source.connect(processor)
  processor.connect(mute)
  mute.connect(mic.ctx.destination)

  const timeDomain = new Uint8Array(analyser.fftSize)
  const tick = () => {
    if (finished) return
    analyser.getByteTimeDomainData(timeDomain)
    let sum = 0
    for (let i = 0; i < timeDomain.length; i++) {
      const v = (timeDomain[i] - 128) / 128
      sum += v * v
    }
    opts.onLevel?.(Math.sqrt(sum / timeDomain.length))
    opts.onTick?.(performance.now() - startedAt)
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)

  const cap = tapMode ? TAP_MAX_RECORD_MS : maxRecordMsFor(opts.referenceDurationMs)
  maxTimer = window.setTimeout(() => {
    if (finished || stopRequested) return
    diag('recorder', 'max-duration cap', { cap })
    opts.onAutoStop?.('max-duration')
    requestStop('max-duration')
  }, cap)

  return {
    heardSpeech: () => heardSpeech,
    endReason: () => endReason,
    stop: async (reason: TakeEndReason = 'user-stop') => {
      requestStop(reason)
      return done
    },
  }
}
