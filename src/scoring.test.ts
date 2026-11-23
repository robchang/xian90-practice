import { describe, expect, test } from 'vitest'
import {
  calculateOverallScore,
  scoreUtterance,
  acceptedTonesForSyllable,
} from './scoring'

describe('scoreUtterance: identity and homophones', () => {
  test('identical phrase 张居信 scores 100', () => {
    const result = scoreUtterance('张居信', '张居信')
    expect(result.overall).toBe(100)
    expect(result.syllables.every((s) => s.color === 'green')).toBe(true)
  })

  test('homophone 章居信 matches 张居信 by pinyin', () => {
    const result = scoreUtterance('张居信', '章居信')
    expect(result.overall).toBeGreaterThanOrEqual(95)
    expect(result.syllables[0].initialMatch).toBe(true)
    expect(result.syllables[0].finalMatch).toBe(true)
  })

  test('traditional characters 張居信 match simplified 张居信', () => {
    const result = scoreUtterance('张居信', '張居信')
    expect(result.overall).toBeGreaterThanOrEqual(95)
  })
})

describe('scoreUtterance: alignment', () => {
  test('missing first character still scores later syllables correctly', () => {
    const result = scoreUtterance('我叫张居信', '叫张居信')
    expect(result.syllables[0].character).toBe('我')
    expect(result.syllables[0].color).toBe('red')
    // The remaining four should be strong matches, not shifted off-by-one
    const rest = result.syllables.slice(1)
    expect(rest.every((s) => s.initialMatch && s.finalMatch)).toBe(true)
    expect(result.overall).toBeGreaterThanOrEqual(70)
    expect(result.overall).toBeLessThan(95)
  })

  test('extra character at the start does not ruin later matches', () => {
    const result = scoreUtterance('我叫张居信', '啊我叫张居信')
    expect(result.syllables.every((s) => s.initialMatch && s.finalMatch)).toBe(true)
    expect(result.overall).toBeGreaterThanOrEqual(90)
  })
})

describe('sandhi: 一 and 不, plus 3-3 pairs', () => {
  test('不怕死: citation bù and spoken bú are both accepted for 不', () => {
    const bu = acceptedTonesForSyllable('不怕死', 0)
    expect(bu).toEqual(expect.arrayContaining([2, 4]))
    expect(bu).not.toContain(1)
    expect(bu).not.toContain(3)

    const spoken = scoreUtterance('不怕死', '不怕死')
    expect(spoken.overall).toBeGreaterThanOrEqual(95)

    const citation = scoreUtterance('不怕死', '不怕死', {
      recognizedPinyin: ['bù', 'pà', 'sǐ'],
    })
    expect(citation.syllables[0].toneAccepted).toBe(true)
    expect(citation.overall).toBeGreaterThanOrEqual(95)

    const sandhi = scoreUtterance('不怕死', '不怕死', {
      recognizedPinyin: ['bú', 'pà', 'sǐ'],
    })
    expect(sandhi.syllables[0].toneAccepted).toBe(true)
    expect(sandhi.overall).toBeGreaterThanOrEqual(95)

    const wrongTone = scoreUtterance('不怕死', '不怕死', {
      recognizedPinyin: ['bǔ', 'pà', 'sǐ'],
    })
    expect(wrongTone.syllables[0].initialMatch).toBe(true)
    expect(wrongTone.syllables[0].finalMatch).toBe(true)
    expect(wrongTone.syllables[0].toneAccepted).toBe(false)
  })

  test('一致: citation yī and sandhi yí are accepted, not yì or yǐ', () => {
    const yi = acceptedTonesForSyllable('一致', 0)
    expect(yi).toEqual(expect.arrayContaining([1, 2]))
    expect(yi).not.toContain(4)
    expect(yi).not.toContain(3)

    const spoken = scoreUtterance('一致', '一致')
    expect(spoken.overall).toBeGreaterThanOrEqual(95)

    const citation = scoreUtterance('一致', '一致', {
      recognizedPinyin: ['yī', 'zhì'],
    })
    expect(citation.syllables[0].toneAccepted).toBe(true)
  })

  test('一直: citation yī and sandhi yì are accepted, not yí', () => {
    const yi = acceptedTonesForSyllable('一直', 0)
    expect(yi).toEqual(expect.arrayContaining([1, 4]))
    expect(yi).not.toContain(2)

    const spoken = scoreUtterance('一直', '一直')
    expect(spoken.overall).toBeGreaterThanOrEqual(95)

    const citation = scoreUtterance('一直', '一直', {
      recognizedPinyin: ['yī', 'zhí'],
    })
    expect(citation.syllables[0].toneAccepted).toBe(true)
  })

  test('赵一荻: citation yī and sandhi yì are accepted for 一', () => {
    const yi = acceptedTonesForSyllable('赵一荻', 1)
    expect(yi).toEqual(expect.arrayContaining([1, 4]))

    const spoken = scoreUtterance('赵一荻', '赵一荻')
    expect(spoken.overall).toBeGreaterThanOrEqual(95)

    const citation = scoreUtterance('赵一荻', '赵一荻', {
      recognizedPinyin: ['zhào', 'yī', 'dí'],
    })
    expect(citation.syllables[1].toneAccepted).toBe(true)
  })

  test('领导: 3-3 pair accepts lǐng and líng on the first syllable', () => {
    const first = acceptedTonesForSyllable('领导', 0)
    expect(first).toEqual(expect.arrayContaining([2, 3]))

    const citation = scoreUtterance('领导', '领导')
    expect(citation.overall).toBeGreaterThanOrEqual(95)

    const sandhi = scoreUtterance('领导', '领导', {
      recognizedPinyin: ['líng', 'dǎo'],
    })
    expect(sandhi.syllables[0].toneAccepted).toBe(true)
    expect(sandhi.overall).toBeGreaterThanOrEqual(95)
  })
})

describe('score presentation', () => {
  test('mismatched phrase is low and marks misses red with pinyin', () => {
    const result = scoreUtterance(
      '我叫张居信，是张学良将军的孙子。',
      '感谢主办方邀请我来到北京。'
    )
    expect(result.overall).toBeLessThan(50)
    expect(result.syllables.some((s) => s.color === 'red')).toBe(true)
    expect(result.missedPinyin.length).toBeGreaterThan(0)
  })

  test('a completely wrong syllable is red and contributes a tip', () => {
    const result = scoreUtterance('抗日', '休息', {
      recognizedPinyin: ['xiū', 'xī'],
    })
    expect(result.syllables[0].color).toBe('red')
    expect(result.tip.length).toBeGreaterThan(0)
    expect(result.missedPinyin.join(' ')).toMatch(/kàng/i)
  })

  test('calculateOverallScore averages syllable scores onto 0–100', () => {
    expect(calculateOverallScore([])).toBe(0)
    expect(
      calculateOverallScore([
        { character: '一', expected: 'yī', recognized: 'yī', initialMatch: true, finalMatch: true, toneMatch: true, score: 1 },
        { character: '直', expected: 'zhí', recognized: 'zhí', initialMatch: true, finalMatch: true, toneMatch: true, score: 1 },
      ])
    ).toBe(100)
  })
})
