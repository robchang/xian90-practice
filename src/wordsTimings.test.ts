import { describe, expect, test } from 'vitest'
import {
  activeLineIndex,
  activeWordIndex,
  timingsUrlFor,
  wordSeekTime,
  type TimedWord,
} from './wordsTimings'

const words: TimedWord[] = [
  { chinese: '张居信', pinyin: 'Zhāng Jūxìn', english: 'name', spans: [{ start: 0.2, end: 1.0 }, { start: 3.0, end: 3.8 }] },
  { chinese: '孙子', pinyin: 'sūnzi', english: 'grandson', spans: [{ start: 5.8, end: 6.4 }, { start: 8.4, end: 9.0 }] },
]

describe('activeWordIndex', () => {
  test('highlights from the first span through the second (includes the repeat gap)', () => {
    expect(activeWordIndex(0.0, words)).toBe(-1)
    expect(activeWordIndex(0.2, words)).toBe(0)
    expect(activeWordIndex(2.0, words)).toBe(0)
    expect(activeWordIndex(3.8, words)).toBe(0)
  })

  test('keeps the previous word in the inter-word gap', () => {
    expect(activeWordIndex(4.5, words)).toBe(0)
    expect(activeWordIndex(5.8, words)).toBe(1)
    expect(activeWordIndex(10.0, words)).toBe(1)
  })

  test('wordSeekTime is the first span start', () => {
    expect(wordSeekTime(words[1])).toBe(5.8)
  })
})

describe('activeLineIndex', () => {
  const lines = [
    { number: 1, chinese: 'A', start: 0, end: 3.4 },
    { number: 2, chinese: 'B', start: 4.0, end: 7.0 },
  ]
  test('highlights the spoken line and holds through the pause', () => {
    expect(activeLineIndex(1.2, lines)).toBe(0)
    expect(activeLineIndex(3.7, lines)).toBe(0)
    expect(activeLineIndex(4.1, lines)).toBe(1)
  })
})

describe('timingsUrlFor', () => {
  test('inserts _timings before the extension', () => {
    expect(timingsUrlFor('/audio/tricky_words.mp3')).toBe('/audio/tricky_words_timings.json')
    expect(timingsUrlFor('audio/daily/day-02/words.mp3')).toBe('audio/daily/day-02/words_timings.json')
  })
})
