import { describe, expect, test } from 'vitest'
import { spokenPinyin } from './speechPinyin'
import { CREED, PROTECTED_NAMES, SIMPLER_OPTIONS } from './simplerSpeech'
import { markHardWords } from './hsk'
import {
  buildCoachSpeechExport,
  lineNeedsNewAudio,
  moveLine,
  pushHistory,
  SPEECH_HISTORY_LIMIT,
  syncSpeechAudio,
  sameLineText,
  editedLineNumbers,
  resolvePracticeLine,
  migrateSpeechDocument,
  CANONICAL_SPEECH_VERSION,
} from './speechRevision'
import type { SpeechLine } from './types'

const originals: SpeechLine[] = [
  { number: 1, chinese: '尊敬的各位领导、各位来宾：大家好！', pinyin: 'x', english: 'Hello', audioUrl: '/audio/lines/line_01.mp3' },
  { number: 4, chinese: '九十年前，我的祖父和杨虎城将军，为了停止内战、一致抗日，发动了西安事变。', pinyin: 'x', english: 'Incident', audioUrl: '/audio/lines/line_04.mp3' },
  { number: 9, chinese: '后来我明白了。祖父九十岁时说过：做事情，要问心无愧。', pinyin: 'x', english: 'Conscience', audioUrl: '/audio/lines/line_09.mp3' },
]

describe('spoken pinyin sandhi', () => {
  test('一 / 不 use spoken sandhi', () => {
    const bu = spokenPinyin('不怕死')
    expect(bu.replace(/\s+/g, '')).toMatch(/bú|bú/i)
    expect(spokenPinyin('一致')).toMatch(/yí/i)
    expect(spokenPinyin('一直')).toMatch(/yì/i)
  })
})

describe('simpler options stay faithful', () => {
  test('问心无愧 is unchanged in every line-9 option', () => {
    const opts = SIMPLER_OPTIONS[9]
    expect(opts.length).toBeGreaterThanOrEqual(1)
    for (const opt of opts) {
      expect(opt.chinese).toContain(CREED)
    }
  })

  test('protected names appear in the lines that are about them', () => {
    const all = Object.entries(SIMPLER_OPTIONS)
      .flatMap(([, opts]) => opts.map((o) => o.chinese))
      .join('\n')
    for (const name of PROTECTED_NAMES) {
      expect(all).toContain(name)
    }
    expect(SIMPLER_OPTIONS[4].every((o) => o.chinese.includes('杨虎城') && o.chinese.includes('西安事变') && o.chinese.includes('内战') && o.chinese.includes('抗日'))).toBe(true)
    expect(SIMPLER_OPTIONS[2].every((o) => o.chinese.includes('张居信') && o.chinese.includes('张学良'))).toBe(true)
    expect(SIMPLER_OPTIONS[6].every((o) => o.chinese.includes('赵一荻'))).toBe(true)
  })
})

describe('hard-word hints', () => {
  test('marks formal words and leaves basic / name words alone', () => {
    const tokens = markHardWords('尊敬的各位领导，我叫张居信，在北京。')
    const hard = tokens.filter((t) => t.hard).map((t) => t.text)
    const easy = tokens.filter((t) => !t.hard).map((t) => t.text)
    expect(hard).toContain('尊敬')
    expect(hard).toContain('领导')
    expect(hard).not.toContain('各位')
    expect(easy.join('')).toContain('张居信')
    expect(easy.join('')).toContain('北京')
    expect(easy.join('')).toContain('我叫')
    expect(easy.join('')).toContain('各位')
  })

  test('问心无愧 is marked as one hard phrase', () => {
    const tokens = markHardWords('做事情，要问心无愧。')
    const hard = tokens.filter((tok) => tok.hard).map((tok) => tok.text)
    expect(hard).toContain('问心无愧')

  })
})

describe('audio sync and history', () => {
  test('unchanged text keeps the recording; edited text drops it', () => {
    const lines = syncSpeechAudio(
      [
        { number: 1, chinese: originals[0].chinese, pinyin: '', english: originals[0].english },
        { number: 2, chinese: '谢谢你们请我来北京。', pinyin: '', english: 'Thanks' },
      ],
      originals
    )
    expect(lines[0].audioUrl).toBe('/audio/lines/line_01.mp3')
    expect(lines[1].audioUrl).toBeUndefined()
    expect(lineNeedsNewAudio(lines[1], originals)).toBe(true)
    expect(lineNeedsNewAudio(lines[0], originals)).toBe(false)
  })

  test('reorder and history cap', () => {
    const moved = moveLine(originals, 0, 1)
    expect(moved[0].chinese).toBe(originals[1].chinese)
    expect(moved[0].number).toBe(1)
    expect(moved[1].number).toBe(2)
    let history: ReturnType<typeof pushHistory> = []
    for (let i = 0; i < 12; i++) {
      history = pushHistory(history, originals, i)
    }
    expect(history.length).toBe(SPEECH_HISTORY_LIMIT)
    expect(history[0].savedAt).toBe(12 - SPEECH_HISTORY_LIMIT)
  })

  test('export flags changed lines', () => {
    const current = syncSpeechAudio(
      [{ ...originals[0] }, { number: 2, chinese: '谢谢你们请我来北京。', pinyin: 'xièxie', english: 'Thanks' }],
      originals
    )
    const exp = buildCoachSpeechExport(current, originals, 'speak-r4')
    expect(exp.plainText).toContain('谢谢你们请我来北京。')
    expect(exp.lines[0].changed).toBe(false)
    expect(exp.lines[1].changed).toBe(true)
    expect(exp.build).toBe('speak-r4')
  })

  test('editedLineNumbers', () => {
    const prev = originals
    const next = [{ ...originals[0], chinese: '大家好！' }, originals[1], originals[2]]
    expect(editedLineNumbers(next, prev)).toContain(1)
    expect(sameLineText('不怕死，不爱钱。', '不怕死，不爱钱。')).toBe(true)
  })
})

test('resolvePracticeLine maps a canonical lesson line to the revised speech line', () => {
  const canonical = originals
  const revised = syncSpeechAudio(
    originals.map((line) =>
      line.number === 1
        ? { ...line, chinese: '各位领导、各位朋友：大家好！', english: 'Leaders, friends: hello, everyone!' }
        : line
    ),
    originals
  )
  const found = resolvePracticeLine('尊敬的各位领导、各位来宾：大家好！', revised, canonical)
  expect(found?.number).toBe(1)
  expect(found?.chinese).toBe('各位领导、各位朋友：大家好！')
  expect(found?.audioUrl).toBeUndefined()
})


test('migrateSpeechDocument parks an old draft in history and uses the new canonical text', () => {
  const oldDraft: SpeechLine[] = [
    { number: 1, chinese: '尊敬的各位领导、各位来宾：大家好！', pinyin: 'x', english: 'Hello' },
    { number: 12, chinese: '祖父做人的原则是："不怕死，不爱钱。"', pinyin: 'x', english: 'Creed' },
  ]
  const stored = { version: 1 as const, canonicalVersion: 1, current: oldDraft, history: [] }
  const { doc, migrated, staleLineNumbers } = migrateSpeechDocument(stored, originals, 1_700_000_000_000)
  expect(migrated).toBe(true)
  expect(doc?.canonicalVersion).toBe(CANONICAL_SPEECH_VERSION)
  expect(doc?.current).toEqual(originals)
  expect(doc?.history[0].label).toBe('Previous 14-line draft')
  expect(doc?.history[0].lines[1].chinese).toContain('不怕死')
  expect(staleLineNumbers).toContain(12)
  expect(staleLineNumbers).not.toContain(1)
})
