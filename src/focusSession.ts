import type { SpeakAttempt, SpeechLine } from './types'

const HALF_LIFE_DAYS = 7
const PASS = 85

export interface WeakItem {
  id: string
  kind: 'line' | 'chunk' | 'word'
  chinese: string
  weakness: number
  recentAvg: number
  attempts: number
  lastTimestamp: number
}

export type Mastery = 'mastered' | 'learning' | 'needs-work' | 'unseen'

export interface FocusItem {
  id: string
  kind: 'line' | 'chunk' | 'word'
  chinese: string
  pinyin: string
  english?: string
  audioUrl?: string
  reason: 'weak' | 'today-lesson' | 'review'
}

function recencyWeight(timestamp: number, now: number): number {
  const ageDays = Math.max(0, (now - timestamp) / (24 * 60 * 60 * 1000))
  return Math.exp(-ageDays / HALF_LIFE_DAYS)
}

export function computeWeaknesses(attempts: SpeakAttempt[], now = Date.now()): WeakItem[] {
  const groups = new Map<string, SpeakAttempt[]>()
  for (const attempt of attempts) {
    const key = attempt.itemId
    const list = groups.get(key) ?? []
    list.push(attempt)
    groups.set(key, list)
  }

  const items: WeakItem[] = []
  for (const [id, list] of groups) {
    let weightedMiss = 0
    let weight = 0
    let weightedScore = 0
    for (const attempt of list) {
      const w = recencyWeight(attempt.timestamp, now)
      weightedMiss += (1 - attempt.score / 100) * w
      weightedScore += attempt.score * w
      weight += w
    }
    if (weight === 0) continue
    items.push({
      id,
      kind: list[0].kind,
      chinese: list[list.length - 1].chinese,
      weakness: weightedMiss / weight,
      recentAvg: weightedScore / weight,
      attempts: list.length,
      lastTimestamp: Math.max(...list.map((a) => a.timestamp)),
    })
  }
  return items.sort((a, b) => b.weakness - a.weakness)
}

export function masteryStatus(itemId: string, attempts: SpeakAttempt[]): Mastery {
  const recent = attempts
    .filter((a) => a.itemId === itemId)
    .sort((a, b) => b.timestamp - a.timestamp)
  if (recent.length === 0) return 'unseen'
  const lastTwo = recent.slice(0, 2)
  if (lastTwo.length >= 2 && lastTwo.every((a) => a.score >= PASS)) return 'mastered'
  if (recent[0].score < 70) return 'needs-work'
  return 'learning'
}

export function buildTodayFocus(args: {
  attempts: SpeakAttempt[]
  speechLines: SpeechLine[]
  todayLessonLines: SpeechLine[]
  limit?: number
  now?: number
}): FocusItem[] {
  const limit = args.limit ?? 6
  const weak = computeWeaknesses(args.attempts, args.now)
  const focus: FocusItem[] = []
  const seen = new Set<string>()

  const push = (item: FocusItem) => {
    if (seen.has(item.id) || seen.has(item.chinese)) return
    seen.add(item.id)
    seen.add(item.chinese)
    focus.push(item)
  }

  for (const item of weak) {
    if (focus.length >= limit) break
    if (item.weakness < 0.12 && masteryStatus(item.id, args.attempts) === 'mastered') continue
    const line = args.speechLines.find((l) => `line-${l.number}` === item.id)
    push({
      id: item.id,
      kind: item.kind,
      chinese: line?.chinese ?? item.chinese,
      pinyin: line?.pinyin ?? '',
      english: line?.english,
      audioUrl: line?.audioUrl,
      reason: 'weak',
    })
  }

  for (const line of args.todayLessonLines) {
    if (focus.length >= limit) break
    push({
      id: `line-${line.number}`,
      kind: 'line',
      chinese: line.chinese,
      pinyin: line.pinyin,
      english: line.english,
      audioUrl: line.audioUrl,
      reason: 'today-lesson',
    })
  }

  // Fill with unseen or learning lines; mastered lines only if space remains.
  const rankedLines = [...args.speechLines].sort((a, b) => {
    const sa = masteryStatus(`line-${a.number}`, args.attempts)
    const sb = masteryStatus(`line-${b.number}`, args.attempts)
    const rank = (s: Mastery) => (s === 'needs-work' ? 0 : s === 'unseen' ? 1 : s === 'learning' ? 2 : 3)
    return rank(sa) - rank(sb)
  })
  for (const line of rankedLines) {
    if (focus.length >= limit) break
    push({
      id: `line-${line.number}`,
      kind: 'line',
      chinese: line.chinese,
      pinyin: line.pinyin,
      english: line.english,
      audioUrl: line.audioUrl,
      reason: masteryStatus(`line-${line.number}`, args.attempts) === 'mastered' ? 'review' : 'weak',
    })
  }

  return focus
}
