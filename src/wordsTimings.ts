export type WordSpan = { start: number; end: number }

export interface TimedWord {
  chinese: string
  pinyin: string
  english: string
  spans: WordSpan[]
}

export interface WordsTimings {
  version: number
  kind?: string
  audio: string
  voice?: string
  words: TimedWord[]
}

export interface TimedLine {
  number: number
  chinese: string
  start: number
  end: number
}

export interface LineTimings {
  version: number
  kind?: string
  audio: string
  voice?: string
  lines: TimedLine[]
}

/** Map an audio path to its sibling timings JSON, e.g. words.mp3 -> words_timings.json. */
export function timingsUrlFor(audioUrl: string): string {
  return audioUrl.replace(/\.mp3(?=[?#]|$)/i, '_timings.json')
}

export function wordWindow(word: TimedWord): { start: number; end: number } {
  if (!word.spans.length) return { start: 0, end: 0 }
  return { start: word.spans[0].start, end: word.spans[word.spans.length - 1].end }
}

/** Index of the item whose window contains t; gaps keep the previous item. */
export function activeIndexByRange(t: number, items: Array<{ start: number; end: number }>): number {
  if (!items.length) return -1
  let last = -1
  for (let i = 0; i < items.length; i++) {
    const { start, end } = items[i]
    if (t >= start && t <= end) return i
    if (t >= start) last = i
  }
  return last
}

export function activeWordIndex(t: number, words: TimedWord[]): number {
  return activeIndexByRange(t, words.map(wordWindow))
}

export function activeLineIndex(t: number, lines: TimedLine[]): number {
  return activeIndexByRange(t, lines)
}

export function wordSeekTime(word: TimedWord): number {
  return word.spans[0]?.start ?? 0
}

export async function fetchTimings<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}
