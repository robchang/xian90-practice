/** Breath / pause chunks for the approved 13-line speech (from the MAIN slash marks). */
export const CANONICAL_CHUNKS: Record<number, string[]> = {
  1: ['尊敬的各位领导、', '各位来宾：', '大家好！'],
  2: ['我叫张居信，', '是张学良将军的孙子。'],
  3: ['感谢主办方', '邀请我来到北京。'],
  4: ['九十年前，', '我的祖父', '和杨虎城将军，', '为了停止内战、', '一致抗日、', '发动了西安事变。'],
  5: ['此后，', '他失去自由', '五十多年。'],
  6: ['我的祖母赵一荻，', '一直陪在他身边。'],
  7: ['我从一岁起，', '每年都去台湾', '看望祖父。'],
  8: ['他失去了那么多，', '可是我从来没有', '看到他有一点怨恨。'],
  9: ['后来我明白了。', '祖父九十岁时说过：', '做事情，', '要问心无愧。'],
  10: ['因为他心里想的，', '不是自己，', '而是国家和同胞。'],
  11: ['我们不能忘记', '这样的爱国将领。'],
  12: ['也要让下一代', '记住这段历史。'],
  13: ['愿中华民族', '团结、', '和平、', '繁荣！', '谢谢大家！'],
}

function compact(text: string): string {
  return text.replace(/\s+/g, '')
}

/** Split an edited line on punctuation, keeping the marks with the preceding chunk. */
export function splitByPunctuation(chinese: string): string[] {
  const parts = chinese.split(/(?<=[，。！？、：；,.!?;:])/)
  const chunks = parts.map((p) => p.trim()).filter(Boolean)
  return chunks.length ? chunks : [chinese]
}

export function chunksForLine(line: { number: number; chinese: string }): string[] {
  const canonical = CANONICAL_CHUNKS[line.number]
  if (canonical && compact(canonical.join('')) === compact(line.chinese)) {
    return canonical
  }
  return splitByPunctuation(line.chinese)
}
