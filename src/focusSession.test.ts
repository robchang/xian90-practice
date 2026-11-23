import { describe, expect, test } from 'vitest'
import { computeWeaknesses, buildTodayFocus, masteryStatus } from './focusSession'
import type { SpeakAttempt, SpeechLine } from './types'

const lines: SpeechLine[] = [
  { number: 1, chinese: '大家好！', pinyin: 'dàjiā hǎo', english: 'Hello' },
  { number: 2, chinese: '我叫张居信', pinyin: 'wǒ jiào Zhāng Jūxìn', english: 'My name is Zhang Juxin' },
  { number: 4, chinese: '发动了西安事变。', pinyin: 'fādòng le Xīān Shìbiàn', english: "launched the Xi'an Incident" },
]

function attempt(partial: Partial<SpeakAttempt> & Pick<SpeakAttempt, 'itemId' | 'chinese' | 'score'>): SpeakAttempt {
  return {
    id: partial.id ?? `${partial.itemId}-${partial.timestamp ?? 1}`,
    itemId: partial.itemId,
    kind: partial.kind ?? 'line',
    chinese: partial.chinese,
    score: partial.score,
    syllableScores: partial.syllableScores ?? [],
    speed: partial.speed ?? 'normal',
    timestamp: partial.timestamp ?? Date.now(),
    source: partial.source ?? 'whisper',
  }
}

describe("weakness and today's focus", () => {
  test('recent low scores outweigh older high scores for the same word', () => {
    const now = Date.now()
    const day = 24 * 60 * 60 * 1000
    const attempts = [
      attempt({ itemId: 'word:一致', chinese: '一致', score: 100, timestamp: now - 40 * day, kind: 'word' }),
      attempt({ itemId: 'word:一致', chinese: '一致', score: 40, timestamp: now - 1 * day, kind: 'word' }),
      attempt({ itemId: 'word:一致', chinese: '一致', score: 45, timestamp: now, kind: 'word' }),
      attempt({ itemId: 'word:孙子', chinese: '孙子', score: 95, timestamp: now, kind: 'word' }),
    ]
    const weak = computeWeaknesses(attempts)
    expect(weak[0].chinese).toBe('一致')
    expect(weak[0].weakness).toBeGreaterThan(weak.find((w) => w.chinese === '孙子')!.weakness)
  })

  test("today's focus leads with weak items, includes today's lesson lines, and deprioritizes mastered lines", () => {
    const now = Date.now()
    const attempts = [
      attempt({ itemId: 'line-4', chinese: lines[2].chinese, score: 50, timestamp: now, kind: 'line' }),
      attempt({ itemId: 'line-4', chinese: lines[2].chinese, score: 55, timestamp: now - 1000, kind: 'line' }),
      attempt({ itemId: 'line-1', chinese: lines[0].chinese, score: 95, timestamp: now, kind: 'line' }),
      attempt({ itemId: 'line-1', chinese: lines[0].chinese, score: 98, timestamp: now - 1000, kind: 'line' }),
      attempt({ itemId: 'word:抗日', chinese: '抗日', score: 40, timestamp: now, kind: 'word' }),
    ]
    const focus = buildTodayFocus({
      attempts,
      speechLines: lines,
      todayLessonLines: [lines[1]],
      limit: 6,
    })
    const ids = focus.map((f) => f.id)
    expect(ids[0]).toMatch(/抗日|line-4/)
    expect(ids).toContain('line-2')
    // Mastered line 1 may appear, but not ahead of weak items
    if (ids.includes('line-1')) {
      expect(ids.indexOf('line-1')).toBeGreaterThan(ids.indexOf('line-4') === -1 ? -1 : ids.findIndex((id) => id === 'line-4' || id.includes('抗日')))
    }
  })

  test('masteryStatus treats two recent high scores as mastered', () => {
    const now = Date.now()
    const attempts = [
      attempt({ itemId: 'line-1', chinese: '大家好！', score: 96, timestamp: now }),
      attempt({ itemId: 'line-1', chinese: '大家好！', score: 90, timestamp: now - 1000 }),
    ]
    expect(masteryStatus('line-1', attempts)).toBe('mastered')
    expect(masteryStatus('line-4', attempts)).toBe('unseen')
  })
})
