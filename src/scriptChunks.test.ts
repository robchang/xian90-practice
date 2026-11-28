import { describe, expect, test } from 'vitest'
import { CANONICAL_CHUNKS, chunksForLine, splitByPunctuation } from './scriptChunks'

describe('chunksForLine', () => {
  test('uses slash-marked chunks when the line is still the approved text', () => {
    const line4 = CANONICAL_CHUNKS[4].join('')
    expect(chunksForLine({ number: 4, chinese: line4 })).toEqual(CANONICAL_CHUNKS[4])
    expect(chunksForLine({ number: 4, chinese: line4 }).length).toBe(6)
  })

  test('falls back to punctuation splits when the line was edited', () => {
    const edited = '我叫张居信，现在住在美国。'
    expect(chunksForLine({ number: 2, chinese: edited })).toEqual(splitByPunctuation(edited))
    expect(splitByPunctuation(edited)).toEqual(['我叫张居信，', '现在住在美国。'])
  })

  test('all 13 canonical lines have chunks that rejoin the line', () => {
    for (const [num, chunks] of Object.entries(CANONICAL_CHUNKS)) {
      const joined = chunks.join('')
      expect(chunksForLine({ number: Number(num), chinese: joined }).join('')).toBe(joined)
    }
  })
})
