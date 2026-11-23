import { downsampleTo16k, audioBufferToMono } from './speakAudio'

export type RecognitionSource = 'speech-recognition' | 'whisper' | 'manual'

export function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

export interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives?: number
  start: () => void
  stop: () => void
  abort?: () => void
  onresult: ((event: { results: ArrayLike<{ isFinal?: boolean; 0: { transcript: string } }> }) => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onend: (() => void) | null
}

export function startLiveRecognition(opts?: {
  shouldContinue?: () => boolean
}): {
  stop: () => void
  result: Promise<string | null>
  supported: boolean
} {
  const Ctor = getSpeechRecognitionCtor()
  if (!Ctor) {
    return { stop() {}, result: Promise.resolve(null), supported: false }
  }
  const recognition = new Ctor()
  recognition.lang = 'zh-CN'
  // iOS often ends a non-continuous session immediately with no-speech.
  // We still use non-continuous (more reliable on iOS) and restart while recording.
  recognition.continuous = false
  recognition.interimResults = false
  recognition.maxAlternatives = 1

  let stopped = false
  let restartTimer = 0
  let transcript: string | null = null
  let resolveFn: (value: string | null) => void = () => {}
  const result = new Promise<string | null>((resolve) => {
    resolveFn = resolve
  })
  const settle = () => {
    if (stopped) return
    stopped = true
    resolveFn(transcript)
  }

  const startSafe = () => {
    if (stopped) return
    try {
      recognition.start()
    } catch {
      // already started or not allowed
    }
  }

  recognition.onresult = (event) => {
    const first = event.results[event.results.length - 1] || event.results[0]
    const text = first?.[0]?.transcript || ''
    if (text.trim()) transcript = text
    // Do not settle or stop the mic just because we got a result; the user
    // (or VAD) decides when the take is over.
  }
  recognition.onerror = (event) => {
    const err = event?.error || ''
    // no-speech / aborted / audio-capture must not end the recording take.
    if (err === 'no-speech' || err === 'aborted' || err === 'canceled' || err === 'audio-capture') {
      return
    }
  }
  recognition.onend = () => {
    if (stopped) {
      settle()
      return
    }
    if (opts?.shouldContinue?.()) {
      // iOS often fires onend quickly; keep listening until the recorder stops.
      restartTimer = window.setTimeout(startSafe, 120)
      return
    }
    settle()
  }

  startSafe()

  return {
    supported: true,
    stop: () => {
      if (stopped) return
      stopped = true
      window.clearTimeout(restartTimer)
      try { recognition.abort?.() } catch { /* ignore */ }
      try { recognition.stop() } catch { /* already ended */ }
      resolveFn(transcript)
    },
    result,
  }
}

export const WHISPER_MODEL = 'Xenova/whisper-tiny'
export const WHISPER_SIZE_HINT = 'about 40 MB for the speech model plus about 27 MB for the runtime, downloaded once and cached on this device'

type ProgressFn = (message: string, progress?: number) => void

let whisperPromise: Promise<(input: Float32Array | string, options?: Record<string, unknown>) => Promise<{ text: string }>> | null = null

export async function ensureWhisper(onProgress?: ProgressFn): Promise<
  (input: Float32Array | string, options?: Record<string, unknown>) => Promise<{ text: string }>
> {
  if (!whisperPromise) {
    whisperPromise = (async () => {
      onProgress?.('Loading the on-device listener…')
      const { pipeline, env } = await import('@huggingface/transformers')
      env.allowLocalModels = false
      const transcriber = await pipeline('automatic-speech-recognition', WHISPER_MODEL, {
        dtype: 'q8',
        progress_callback: (item: { status?: string; progress?: number }) => {
          if (item?.status === 'progress' && typeof item.progress === 'number') {
            onProgress?.('Downloading the on-device listener (first time only)…', item.progress)
          }
        },
      })
      return transcriber as unknown as (input: Float32Array | string, options?: Record<string, unknown>) => Promise<{ text: string }>
    })().catch((err) => {
      whisperPromise = null
      throw err
    })
  }
  return whisperPromise
}

export async function transcribeWithWhisper(
  input: Float32Array | AudioBuffer | string,
  onProgress?: ProgressFn
): Promise<string> {
  const transcriber = await ensureWhisper(onProgress)
  let audio: Float32Array
  if (typeof input === 'string') {
    throw new Error('Pass decoded 16 kHz PCM, not a file path (AudioContext is unavailable in Node).')
  } else if (typeof AudioBuffer !== 'undefined' && input instanceof AudioBuffer) {
    const mono = audioBufferToMono(input)
    audio = downsampleTo16k(mono.samples, mono.sampleRate)
  } else {
    audio = input as Float32Array
  }
  const out = await transcriber(audio, {
    language: 'chinese',
    task: 'transcribe',
  })
  const text = typeof out === 'string' ? out : (out as { text?: string }).text || ''
  return text.trim()
}

export async function transcribeRecording(opts: {
  samples16k?: Float32Array
  liveTranscript?: string | null
  onProgress?: ProgressFn
}): Promise<{ text: string; source: RecognitionSource }> {
  if (opts.liveTranscript && hanish(opts.liveTranscript)) {
    return { text: opts.liveTranscript, source: 'speech-recognition' }
  }
  if (opts.samples16k && opts.samples16k.length > 0) {
    const text = await transcribeWithWhisper(opts.samples16k, opts.onProgress)
    if (text) return { text, source: 'whisper' }
  }
  if (opts.liveTranscript) {
    return { text: opts.liveTranscript, source: 'speech-recognition' }
  }
  return { text: '', source: 'manual' }
}

function hanish(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text)
}
