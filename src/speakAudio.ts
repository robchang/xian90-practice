import { assetUrl } from './assetUrl'

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

export async function playReference(opts: {
  audioUrl?: string
  text: string
  playbackRate?: number
  signal?: AbortSignal
}): Promise<void> {
  const rate = opts.playbackRate ?? 1
  if (opts.audioUrl) {
    const audio = new Audio(assetUrl(opts.audioUrl))
    audio.playbackRate = rate
    const el = audio as HTMLAudioElement & { preservesPitch?: boolean; webkitPreservesPitch?: boolean }
    el.preservesPitch = true
    el.webkitPreservesPitch = true
    await new Promise<void>((resolve, reject) => {
      const onAbort = () => {
        audio.pause()
        reject(new DOMException('Aborted', 'AbortError'))
      }
      opts.signal?.addEventListener('abort', onAbort)
      audio.onended = () => {
        opts.signal?.removeEventListener('abort', onAbort)
        resolve()
      }
      audio.onerror = () => {
        opts.signal?.removeEventListener('abort', onAbort)
        // Fall through to speech synthesis
        reject(new Error('audio-error'))
      }
      audio.play().catch(reject)
    }).catch(async (err) => {
      if (err?.name === 'AbortError') throw err
      await speakChinese(opts.text, rate, opts.signal)
    })
    return
  }
  await speakChinese(opts.text, rate, opts.signal)
}

function speakChinese(text: string, rate: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!('speechSynthesis' in window)) {
      resolve()
      return
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'zh-CN'
    utterance.rate = Math.max(0.5, Math.min(1.2, rate))
    const onAbort = () => {
      window.speechSynthesis.cancel()
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort)
    utterance.onend = () => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }
    utterance.onerror = () => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }
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

export interface RecorderHandles {
  stop: () => Promise<{ blob: Blob; samples16k: Float32Array; sampleRate: 16000 }>
}

/**
 * Record from the mic, collecting PCM for Whisper and a WAV blob for playback.
 * Stops on silence (RMS VAD) after a minimum duration, or when stop() is called.
 */
export async function startPhraseRecording(opts: {
  onLevel?: (rms: number) => void
  onAutoStop?: () => void
  silenceMs?: number
  minMs?: number
  threshold?: number
}): Promise<RecorderHandles> {
  const silenceMs = opts.silenceMs ?? 1100
  const minMs = opts.minMs ?? 800
  const threshold = opts.threshold ?? 0.018
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true },
  })
  const audioContext = new AudioContext()
  const source = audioContext.createMediaStreamSource(stream)
  const analyser = audioContext.createAnalyser()
  analyser.fftSize = 2048
  source.connect(analyser)

  const samples: number[] = []
  const processor = audioContext.createScriptProcessor(4096, 1, 1)
  const startedAt = performance.now()
  let lastLoud = performance.now()
  let finished = false
  let resolver: (value: { blob: Blob; samples16k: Float32Array; sampleRate: 16000 }) => void
  const done = new Promise<{ blob: Blob; samples16k: Float32Array; sampleRate: 16000 }>((resolve) => {
    resolver = resolve
  })

  const finish = async () => {
    if (finished) return
    finished = true
    processor.onaudioprocess = null
    try { processor.disconnect() } catch { /* ignore */ }
    try { source.disconnect() } catch { /* ignore */ }
    stream.getTracks().forEach((t) => t.stop())
    const raw = new Float32Array(samples)
    const samples16k = downsampleTo16k(raw, audioContext.sampleRate)
    const blob = encodeWav(samples16k, 16000)
    try { await audioContext.close() } catch { /* ignore */ }
    resolver({ blob, samples16k, sampleRate: 16000 })
  }

  processor.onaudioprocess = (event) => {
    if (finished) return
    const input = event.inputBuffer.getChannelData(0)
    for (let i = 0; i < input.length; i++) samples.push(input[i])
    let sum = 0
    for (let i = 0; i < input.length; i++) sum += input[i] * input[i]
    const rms = Math.sqrt(sum / input.length)
    opts.onLevel?.(rms)
    const now = performance.now()
    if (rms >= threshold) lastLoud = now
    const elapsed = now - startedAt
    if (elapsed >= minMs && now - lastLoud >= silenceMs) {
      opts.onAutoStop?.()
      void finish()
    }
  }

  const mute = audioContext.createGain()
  mute.gain.value = 0
  source.connect(processor)
  processor.connect(mute)
  mute.connect(audioContext.destination)

  return {
    stop: async () => {
      await finish()
      return done
    },
  }
}
