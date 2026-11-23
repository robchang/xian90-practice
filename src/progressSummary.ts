import type { SpeakAttempt, SpeechLine } from './types'
import { computeWeaknesses, masteryStatus, buildTodayFocus, type FocusItem } from './focusSession'
import { pinyin } from 'pinyin-pro'
import { hanChars } from './scoring'

export const PROGRESS_SUMMARY_VERSION = 1 as const
export const EVENT_DATE = '2026-12-12'

export interface CoachProgressSummary {
  version: 1
  generatedAt: string
  eventDate: string
  daysRemaining: number
  weakWords: Array<{
    chinese: string
    pinyin: string
    itemId: string
    weakness: number
    recentAvg: number
    attempts: number
    commonMiss?: string
  }>
  lineScores: Array<{
    line: number
    chinese: string
    best: number | null
    latest: number | null
    attempts: number
    status: 'mastered' | 'learning' | 'needs-work' | 'unseen'
    trend: number[]
  }>
  recentAttempts: {
    today: number
    last7Days: number
  }
  todayFocus: Array<{ id: string; chinese: string; reason: string }>
  topTroubleSyllables: Array<{ character: string; expected: string; missRate: number; samples: number }>
}

function startOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function pinyinOf(chinese: string): string {
  const chars = hanChars(chinese)
  if (!chars.length) return ''
  return (pinyin(chars.join(''), { toneType: 'symbol', type: 'array', toneSandhi: true }) as string[]).join(' ')
}

export function buildCoachSummary(args: {
  attempts: SpeakAttempt[]
  speechLines: SpeechLine[]
  todayLessonLines?: SpeechLine[]
  now?: number
}): CoachProgressSummary {
  const now = args.now ?? Date.now()
  const event = Date.parse('2026-12-12T00:00:00+08:00')
  const daysRemaining = Math.max(0, Math.ceil((event - now) / (24 * 60 * 60 * 1000)))
  const weak = computeWeaknesses(args.attempts, now)

  const wordWeak = weak
    .filter((w) => w.kind === 'word' || !w.id.startsWith('line-'))
    .slice(0, 8)
    .map((w) => ({
      chinese: w.chinese,
      pinyin: pinyinOf(w.chinese),
      itemId: w.id,
      weakness: Math.round(w.weakness * 100) / 100,
      recentAvg: Math.round(w.recentAvg),
      attempts: w.attempts,
    }))

  const lineScores = args.speechLines.map((line) => {
    const id = `line-${line.number}`
    const list = args.attempts
      .filter((a) => a.itemId === id)
      .sort((a, b) => a.timestamp - b.timestamp)
    const scores = list.map((a) => a.score)
    return {
      line: line.number,
      chinese: line.chinese,
      best: scores.length ? Math.max(...scores) : null,
      latest: scores.length ? scores[scores.length - 1] : null,
      attempts: scores.length,
      status: masteryStatus(id, args.attempts),
      trend: scores.slice(-5),
    }
  })

  const todayStart = startOfDay(now)
  const weekStart = now - 7 * 24 * 60 * 60 * 1000
  const recentAttempts = {
    today: args.attempts.filter((a) => a.timestamp >= todayStart).length,
    last7Days: args.attempts.filter((a) => a.timestamp >= weekStart).length,
  }

  const focus = buildTodayFocus({
    attempts: args.attempts,
    speechLines: args.speechLines,
    todayLessonLines: args.todayLessonLines ?? [],
    limit: 6,
    now,
  })

  const sylStats = new Map<string, { character: string; expected: string; miss: number; samples: number }>()
  for (const attempt of args.attempts) {
    for (const syl of attempt.syllableScores) {
      const key = `${syl.character}:${syl.expected}`
      const entry = sylStats.get(key) ?? { character: syl.character, expected: syl.expected, miss: 0, samples: 0 }
      entry.samples += 1
      const missed = syl.color ? syl.color !== 'green' : syl.score < 0.85
      if (missed) entry.miss += 1
      sylStats.set(key, entry)
    }
  }
  const topTroubleSyllables = [...sylStats.values()]
    .filter((s) => s.samples >= 2)
    .map((s) => ({
      character: s.character,
      expected: s.expected,
      missRate: Math.round((s.miss / s.samples) * 100) / 100,
      samples: s.samples,
    }))
    .sort((a, b) => b.missRate - a.missRate || b.samples - a.samples)
    .slice(0, 8)

  return {
    version: PROGRESS_SUMMARY_VERSION,
    generatedAt: new Date(now).toISOString(),
    eventDate: EVENT_DATE,
    daysRemaining,
    weakWords: wordWeak,
    lineScores,
    recentAttempts,
    todayFocus: focus.map((f: FocusItem) => ({ id: f.id, chinese: f.chinese, reason: f.reason })),
    topTroubleSyllables,
  }
}

export function serializeCoachSummary(summary: CoachProgressSummary): string {
  return JSON.stringify(summary, null, 2)
}
