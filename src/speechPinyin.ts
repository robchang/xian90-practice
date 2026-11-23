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
