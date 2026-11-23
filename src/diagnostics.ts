export interface DiagEvent {
  t: number
  iso: string
  source: string
  message: string
  data?: Record<string, unknown>
}

const MAX = 30
const log: DiagEvent[] = []
const listeners = new Set<() => void>()

export function diag(source: string, message: string, data?: Record<string, unknown>): DiagEvent {
  const event: DiagEvent = {
    t: Date.now(),
    iso: new Date().toISOString(),
    source,
    message,
    data,
  }
  log.push(event)
  if (log.length > MAX) log.shift()
  try {
    console.info(`[coach] ${source}: ${message}`, data ?? '')
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => fn())
  return event
}

export function getDiagLog(): DiagEvent[] {
  return log.slice()
}

export function clearDiagLog(): void {
  log.length = 0
  listeners.forEach((fn) => fn())
}

export function formatDiagLog(): string {
  if (!log.length) return '(no events yet)'
  return log
    .map((e) => {
      const extra = e.data ? ` ${JSON.stringify(e.data)}` : ''
      return `${e.iso} [${e.source}] ${e.message}${extra}`
    })
    .join('\n')
}

export function subscribeDiag(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export type TakeEndReason =
  | 'user-stop'
  | 'max-duration'
  | 'vad-silence'
  | 'interrupted'
  | 'track-ended'
  | 'track-mute'
  | 'mediarecorder-onstop-unexpected'
  | 'mediarecorder-error'
  | 'unknown'

export function isScorableEnd(reason: TakeEndReason | null | undefined): boolean {
  return reason === 'user-stop' || reason === 'max-duration' || reason === 'vad-silence'
}

export function isInterruptedEnd(reason: TakeEndReason | null | undefined): boolean {
  return (
    reason === 'interrupted' ||
    reason === 'track-ended' ||
    reason === 'track-mute' ||
    reason === 'mediarecorder-onstop-unexpected' ||
    reason === 'mediarecorder-error'
  )
}
