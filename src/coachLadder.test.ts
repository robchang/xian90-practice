import { describe, expect, test } from 'vitest'
import {
  splitIntoChunks,
  missedWordUnits,
  createLadder,
  applyScore,
  PASS_THRESHOLD,
} from './coachLadder'
import type { SyllableScore } from './types'

function syl(character: string, color: 'green' | 'yellow' | 'red', score = color === 'green' ? 1 : color === 'yellow' ? 0.6 : 0.2): SyllableScore & { color: 'green' | 'yellow' | 'red' } {
  return {
    character,
    expected: character,
    recognized: color === 'red' ? '' : character,
    initialMatch: color !== 'red',
    finalMatch: color === 'green',
    toneMatch: color === 'green',
    score,
    color,
  }
}

describe('splitIntoChunks', () => {
  test('splits line 4 at commas and enumeration pauses', () => {
    const line = '九十年前，我的祖父和杨虎城将军，为了停止内战、一致抗日，发动了西安事变。'
    const chunks = splitIntoChunks(line)
    expect(chunks.map((c) => c.chinese)).toEqual([
      '九十年前',
      '我的祖父和杨虎城将军',
      '为了停止内战',
      '一致抗日',
      '发动了西安事变',
    ])
  })

  test('a short phrase with no comma stays whole', () => {
    expect(splitIntoChunks('感谢主办方邀请我来到北京。').map((c) => c.chinese)).toEqual([
      '感谢主办方邀请我来到北京',
    ])
  })
})

describe('missedWordUnits', () => {
  test('groups consecutive missed characters into word units', () => {
    const syllables = [
      syl('不', 'green'),
      syl('怕', 'green'),
      syl('死', 'green'),
      syl('不', 'red'),
      syl('爱', 'red'),
      syl('钱', 'yellow'),
    ]
    const units = missedWordUnits('不怕死不爱钱', syllables)
    expect(units.map((u) => u.chinese)).toEqual(['不爱钱'])
  })
})

describe('adaptive ladder', () => {
  const phrase = {
    id: 'line-12',
    kind: 'line' as const,
    chinese: '祖父做人的原则是："不怕死，不爱钱。"',
    pinyin: 'Zǔfù zuòrén de yuánzé shì: "Bú pà sǐ, bú ài qián."',
    english: "My grandfather's principles were: \"Not afraid of death, not loving money.\"",
  }

  test('a passing score at normal speed advances to the next phrase', () => {
    const session = createLadder([phrase, { ...phrase, id: 'line-13', chinese: '我会把这段历史，告诉下一代。' }])
    expect(session.current.id).toBe('line-12')
    expect(session.current.speed).toBe('normal')

    const next = applyScore(session, PASS_THRESHOLD, [syl('祖', 'green')])
    expect(next.current.id).toBe('line-13')
    expect(next.current.speed).toBe('normal')
    expect(next.events[0].kind).toBe('passed')
  })

  test('first fail retries the same phrase more slowly', () => {
    const session = createLadder([phrase])
    const next = applyScore(session, 60, [syl('祖', 'red')])
    expect(next.current.id).toBe('line-12')
    expect(next.current.speed).toBe('slow')
    expect(next.current.playbackRate).toBe(0.75)
    expect(next.events[0].kind).toBe('slow-down')
  })

  test('second fail breaks the phrase into missed-word drills starting slow', () => {
    let session = createLadder([phrase])
    const missed = [
      ...Array.from('祖父做人的原则是').map((c) => syl(c, 'green')),
      ...Array.from('不怕死').map((c) => syl(c, 'green')),
      ...Array.from('不爱钱').map((c) => syl(c, 'red')),
    ]
    session = applyScore(session, 60, missed)
    session = applyScore(session, 55, missed)
    expect(session.current.kind).toBe('word')
    expect(session.current.chinese).toBe('不爱钱')
    expect(session.current.speed).toBe('slower')
    expect(session.current.playbackRate).toBe(0.6)
    expect(session.stage).toBe('word-drill')
  })

  test('passing a slow word drill repeats that word at normal speed, then rebuilds the full phrase', () => {
    let session = createLadder([phrase])
    const missed = [
      ...Array.from('祖父做人的原则是').map((c) => syl(c, 'green')),
      ...Array.from('不怕死').map((c) => syl(c, 'green')),
      ...Array.from('不爱钱').map((c) => syl(c, 'red')),
    ]
    session = applyScore(session, 60, missed)
    session = applyScore(session, 55, missed)
    expect(session.current.chinese).toBe('不爱钱')
    expect(session.current.speed).toBe('slower')

    session = applyScore(session, 90, Array.from('不爱钱').map((c) => syl(c, 'green')))
    expect(session.current.chinese).toBe('不爱钱')
    expect(session.current.speed).toBe('normal')
    expect(session.current.playbackRate).toBe(1)

    session = applyScore(session, 90, Array.from('不爱钱').map((c) => syl(c, 'green')))
    expect(session.current.kind).toBe('line')
    expect(session.current.id).toBe('line-12')
    expect(session.stage).toBe('rebuild')
    expect(session.current.speed).toBe('slow')
  })

  test('caps retries and marks the phrase as needs-work instead of looping forever', () => {
    let session = createLadder([
      phrase,
      { ...phrase, id: 'line-13', chinese: '我会把这段历史，告诉下一代。' },
    ])
    for (let i = 0; i < 12; i++) {
      session = applyScore(session, 40, Array.from(phrase.chinese).filter((c) => /[\u4e00-\u9fa5]/.test(c)).map((c) => syl(c, 'red')))
      if (session.events.some((e) => e.kind === 'needs-work')) break
    }
    expect(session.events.some((e) => e.kind === 'needs-work')).toBe(true)
    expect(session.needsWorkIds).toContain('line-12')
    expect(session.current.id).toBe('line-13')
  })

  test('encouragement is present after both passes and struggles', () => {
    let session = createLadder([phrase])
    session = applyScore(session, 60, [syl('祖', 'red')])
    expect(session.events[0].message.toLowerCase()).toMatch(/slow|again|together|try/)
    session = applyScore(session, 90, [syl('祖', 'green')])
    expect(session.events[0].message.length).toBeGreaterThan(0)
  })
})
