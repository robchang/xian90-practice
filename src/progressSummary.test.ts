import { describe, expect, test } from 'vitest'
import { buildCoachSummary } from './progressSummary'
import type { SpeakAttempt, SpeechLine } from './types'

const lines: SpeechLine[] = [
  { number: 1, chinese: '大家好！', pinyin: 'dàjiā hǎo', english: 'Hello' },
  { number: 2, chinese: '我叫张居信', pinyin: 'wǒ jiào Zhāng Jūxìn', english: 'Name' },
]

describe('buildCoachSummary', () => {
  test('includes version, counts, and line status', () => {
    const now = Date.parse('2026-11-22T20:00:00-08:00')
    const attempts: SpeakAttempt[] = [
      { id: 'a', itemId: 'word:抗日', kind: 'word', chinese: '抗日', score: 40, syllableScores: [], speed: 'normal', timestamp: now, source: 'whisper' },
      { id: 'b', itemId: 'line-1', kind: 'line', chinese: lines[0].chinese, score: 96, syllableScores: [], speed: 'normal', timestamp: now, source: 'whisper' },
      { id: 'c', itemId: 'line-1', kind: 'line', chinese: lines[0].chinese, score: 94, syllableScores: [], speed: 'normal', timestamp: now - 1000, source: 'whisper' },
    ]
    const summary = buildCoachSummary({ attempts, speechLines: lines, todayLessonLines: [lines[1]], now, unknownChars: ['尊', '敬'] })
    expect(summary.version).toBe(1)
    expect(summary.eventDate).toBe('2026-12-12')
    expect(summary.daysRemaining).toBeGreaterThan(0)
    expect(summary.recentAttempts.today).toBe(3)
    expect(summary.weakWords[0].chinese).toBe('抗日')
    expect(summary.lineScores.find((l) => l.line === 1)?.status).toBe('mastered')
    expect(summary.todayFocus.some((f) => f.id === 'line-2')).toBe(true)
    expect(summary.unknownChars).toEqual(['尊', '敬'])
  })
})

