import { pinyin } from 'pinyin-pro'

/** Spoken-tone pinyin for display (sandhi for 一 / 不 applied). */
export function spokenPinyin(chinese: string): string {
  if (!chinese.trim()) return ''
  const raw = pinyin(chinese, {
    toneType: 'symbol',
    toneSandhi: true,
    nonZh: 'consecutive',
  }) as string
  return raw.replace(/\s+([，。！？、：；,.!?;:”’'"\)])/g, '$1').replace(/([，。！？、：；,.!?;:“‘'"\(])\s+/g, '$1 ')
}

export function citationPinyin(chinese: string): string {
  if (!chinese.trim()) return ''
  return pinyin(chinese, {
    toneType: 'symbol',
    toneSandhi: false,
  }) as string
}

export function withSpokenPinyin<T extends { chinese: string; pinyin?: string }>(line: T): T & { pinyin: string } {
  return { ...line, pinyin: spokenPinyin(line.chinese) }
}


export type CharPinyinUnit = { char: string; pinyin: string }

/** Per-character spoken pinyin for a line (sandhi applied to the whole line). */
export function charPinyinUnits(chinese: string): CharPinyinUnit[] {
  const han = Array.from(chinese).filter((c) => /[\u4e00-\u9fff]/.test(c)).join('')
  const pys = han
    ? (pinyin(han, { toneType: 'symbol', type: 'array', toneSandhi: true }) as string[])
    : []
  let i = 0
  return Array.from(chinese).map((ch) => {
    if (/[\u4e00-\u9fff]/.test(ch)) {
      const py = pys[i] ?? ''
      i += 1
      return { char: ch, pinyin: py }
    }
    return { char: ch, pinyin: '' }
  })
}
