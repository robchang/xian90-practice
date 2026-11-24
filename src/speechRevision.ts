import type { SpeechLine } from './types'
import { spokenPinyin } from './speechPinyin'

export const SPEECH_HISTORY_LIMIT = 8

/** Bump when the canonical speech text changes, so old drafts are not applied as current. */
export const CANONICAL_SPEECH_VERSION = 2

export interface SpeechSnapshot {
  savedAt: number
  lines: SpeechLine[]
  label?: string
}

export interface SpeechDocument {
  version: 1
  canonicalVersion?: number
  current: SpeechLine[]
  history: SpeechSnapshot[]
}

export function normalizeChinese(text: string): string {
  return text.replace(/[“”"‘’]/g, '"').replace(/\s+/g, '').trim()
}

export function sameLineText(a: string, b: string): boolean {
  return normalizeChinese(a) === normalizeChinese(b)
}

export function attachOriginalMeta(lines: SpeechLine[]): SpeechLine[] {
  return lines.map((line) => ({
    ...line,
    pinyin: line.pinyin || spokenPinyin(line.chinese),
  }))
}

/** If the Chinese still matches a canonical line, keep that recording; otherwise drop audioUrl. */
export function syncLineAudio(line: SpeechLine, originals: SpeechLine[]): SpeechLine {
  const match = originals.find((o) => sameLineText(o.chinese, line.chinese))
  if (match?.audioUrl) {
    return { ...line, audioUrl: match.audioUrl, pinyin: line.pinyin || spokenPinyin(line.chinese) }
  }
  const { audioUrl: _drop, ...rest } = line
  void _drop
  return { ...rest, pinyin: line.pinyin || spokenPinyin(line.chinese) }
}

export function syncSpeechAudio(lines: SpeechLine[], originals: SpeechLine[]): SpeechLine[] {
  return lines.map((line, i) => {
    const next = syncLineAudio(line, originals)
    return { ...next, number: i + 1 }
  })
}

export function lineNeedsNewAudio(line: SpeechLine, originals: SpeechLine[]): boolean {
  return !originals.some((o) => sameLineText(o.chinese, line.chinese) && o.audioUrl)
}

export function renumber(lines: SpeechLine[]): SpeechLine[] {
  return lines.map((line, i) => ({ ...line, number: i + 1 }))
}

export function moveLine(lines: SpeechLine[], index: number, dir: -1 | 1): SpeechLine[] {
  const next = lines.slice()
  const j = index + dir
  if (j < 0 || j >= next.length) return lines
  const tmp = next[index]
  next[index] = next[j]
  next[j] = tmp
  return renumber(next)
}

export function makeBlankLine(after: number): SpeechLine {
  return { number: after + 1, chinese: '', pinyin: '', english: '' }
}

export function pushHistory(
  history: SpeechSnapshot[],
  current: SpeechLine[],
  savedAt = Date.now(),
  label?: string
): SpeechSnapshot[] {
  const snapshot: SpeechSnapshot = {
    savedAt,
    lines: current.map((l) => ({ ...l })),
    ...(label ? { label } : {}),
  }
  return [...history, snapshot].slice(-SPEECH_HISTORY_LIMIT)
}

/**
 * If a stored draft was saved against an older canonical speech, keep it in history
 * and start from the new official text instead of applying the old draft.
 */
export function migrateSpeechDocument(
  stored: SpeechDocument | null,
  canonical: SpeechLine[],
  now = Date.now()
): { doc: SpeechDocument | null; migrated: boolean; staleLineNumbers: number[] } {
  if (!stored) {
    return { doc: null, migrated: false, staleLineNumbers: [] }
  }
  if ((stored.canonicalVersion ?? 1) === CANONICAL_SPEECH_VERSION) {
    return { doc: stored, migrated: false, staleLineNumbers: [] }
  }
  const history = pushHistory(stored.history, stored.current, now, 'Previous 14-line draft')
  const stale = new Set<number>()
  stored.current.forEach((line) => stale.add(line.number))
  // Line numbers whose Chinese no longer exists in the new canonical speech
  const staleLineNumbers = [...stale].filter(
    (n) => !canonical.some((c) => c.number === n && sameLineText(c.chinese, stored.current.find((l) => l.number === n)?.chinese || ''))
  )
  return {
    doc: {
      version: 1,
      canonicalVersion: CANONICAL_SPEECH_VERSION,
      current: canonical,
      history,
    },
    migrated: true,
    staleLineNumbers,
  }
}

export function formatSpeechPlain(lines: SpeechLine[]): string {
  return lines
    .map((line) => {
      const bits = [`${line.number}. ${line.chinese}`]
      if (line.pinyin) bits.push(`   ${line.pinyin}`)
      if (line.english) bits.push(`   ${line.english}`)
      return bits.join('\n')
    })
    .join('\n\n')
}

export interface CoachSpeechExport {
  version: 1
  generatedAt: string
  build?: string
  lines: Array<{
    number: number
    chinese: string
    pinyin: string
    english: string
    changed: boolean
  }>
  plainText: string
}

export function buildCoachSpeechExport(
  lines: SpeechLine[],
  originals: SpeechLine[],
  build?: string
): CoachSpeechExport {
  const payload: CoachSpeechExport = {
    version: 1,
    generatedAt: new Date().toISOString(),
    build,
    lines: lines.map((line) => ({
      number: line.number,
      chinese: line.chinese,
      pinyin: line.pinyin,
      english: line.english,
      changed: lineNeedsNewAudio(line, originals),
    })),
    plainText: formatSpeechPlain(lines),
  }
  return payload
}

export function serializeCoachSpeechExport(doc: CoachSpeechExport): string {
  return `${doc.plainText}\n\n---\nJSON for the coach\n${JSON.stringify(doc, null, 2)}`
}


/** Map a lesson / practice sentence onto the current speech draft (by current or canonical text). */
export function resolvePracticeLine(
  practiceChinese: string,
  speechLines: SpeechLine[],
  canonicalLines: SpeechLine[] = []
): SpeechLine | undefined {
  const fold = (s: string) => normalizeChinese(s).replace(/[，。！？、：；]/g, '')
  const target = fold(practiceChinese)
  if (!target) return undefined
  const fuzzy = (line: SpeechLine) => {
    const f = fold(line.chinese)
    return f === target || (!!f && !!target && (f.includes(target) || target.includes(f)))
  }
  const current = speechLines.find(fuzzy)
  if (current) return current
  const canon = canonicalLines.find(fuzzy)
  if (canon) return speechLines.find((line) => line.number === canon.number)
  return undefined
}

export function textsChanged(a: SpeechLine[], b: SpeechLine[]): boolean {
  if (a.length !== b.length) return true
  return a.some((line, i) => !sameLineText(line.chinese, b[i].chinese) || line.english !== b[i].english)
}

export function editedLineNumbers(current: SpeechLine[], previous: SpeechLine[]): number[] {
  const changed = new Set<number>()
  current.forEach((line) => {
    const was = previous.find((p) => p.number === line.number)
    if (!was || !sameLineText(was.chinese, line.chinese)) changed.add(line.number)
  })
  previous.forEach((line) => {
    if (!current.some((c) => c.number === line.number)) changed.add(line.number)
  })
  return [...changed]
}
