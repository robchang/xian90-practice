import { hanChars } from './scoring'

export const UNKNOWN_CHARS_KEY = 'unknown_chars_v1'

export function uniqueSpeechChars(lines: Array<{ chinese: string }>): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const line of lines) {
    for (const ch of hanChars(line.chinese)) {
      if (!seen.has(ch)) {
        seen.add(ch)
        out.push(ch)
      }
    }
  }
  return out
}

export function loadUnknownChars(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(UNKNOWN_CHARS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((c): c is string => typeof c === 'string' && c.length === 1)
  } catch {
    return []
  }
}

export function saveUnknownChars(chars: string[]): void {
  if (typeof window === 'undefined') return
  const unique = Array.from(new Set(chars.filter((c) => c.length === 1)))
  window.localStorage.setItem(UNKNOWN_CHARS_KEY, JSON.stringify(unique))
}

export function toggleUnknownChar(ch: string, current: string[]): string[] {
  const set = new Set(current)
  if (set.has(ch)) set.delete(ch)
  else set.add(ch)
  const next = Array.from(set)
  saveUnknownChars(next)
  return next
}
