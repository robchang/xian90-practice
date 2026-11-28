import { describe, expect, test } from 'vitest'
import { uniqueSpeechChars, toggleUnknownChar } from './unknownChars'

describe('uniqueSpeechChars', () => {
  test('lists Han characters in first-occurrence order', () => {
    const chars = uniqueSpeechChars([
      { chinese: '尊敬的各位领导、各位来宾：大家好！' },
      { chinese: '我叫张居信，是张学良将军的孙子。' },
    ])
    expect(chars[0]).toBe('尊')
    expect(chars.slice(0, 8)).toEqual(['尊', '敬', '的', '各', '位', '领', '导', '来'])
    expect(chars.filter((c) => c === '张').length).toBe(1)
    expect(chars).toContain('信')
    expect(chars.every((c) => /[\u4e00-\u9fff]/.test(c))).toBe(true)
  })
})

describe('toggleUnknownChar', () => {
  test('marks and unmarks a character', () => {
    const once = toggleUnknownChar('尊', [])
    expect(once).toEqual(['尊'])
    const twice = toggleUnknownChar('尊', once)
    expect(twice).toEqual([])
  })
})
