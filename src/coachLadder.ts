import { pinyin } from 'pinyin-pro'
import { hanChars } from './scoring'
import type { SyllableScore } from './types'

export const PASS_THRESHOLD = 85
export const MAX_ATTEMPTS_PER_PHRASE = 8

export type SpeedName = 'normal' | 'slow' | 'slower'

export interface CoachItem {
  id: string
  kind: 'line' | 'chunk' | 'word'
  chinese: string
  pinyin: string
  english?: string
  audioUrl?: string
  parentId?: string
  speed: SpeedName
  playbackRate: number
}

export interface LadderEvent {
  kind: 'passed' | 'slow-down' | 'word-drill' | 'rebuild' | 'needs-work'
  message: string
}

export type LadderStage = 'full' | 'slow-retry' | 'word-drill' | 'rebuild' | 'done'

export interface LadderSession {
  queue: CoachItem[]
  current: CoachItem
  stage: LadderStage
  failCountOnCurrent: number
  attemptsOnPhrase: number
  phraseRoot: CoachItem
  drillQueue: CoachItem[]
  events: LadderEvent[]
  needsWorkIds: string[]
  passedIds: string[]
  done: boolean
}

export type CoachItemInput = Omit<CoachItem, 'speed' | 'playbackRate'> &
  Partial<Pick<CoachItem, 'speed' | 'playbackRate'>>

export function playbackRateFor(speed: SpeedName): number {
  if (speed === 'slow') return 0.75
  if (speed === 'slower') return 0.6
  return 1
}

export function withSpeed(item: CoachItem, speed: SpeedName): CoachItem {
  return { ...item, speed, playbackRate: playbackRateFor(speed) }
}

function withPinyin(chinese: string, existing?: string): string {
  if (existing && existing.trim()) return existing
  const chars = hanChars(chinese)
  if (chars.length === 0) return ''
  return (pinyin(chars.join(''), { toneType: 'symbol', type: 'array', toneSandhi: true }) as string[]).join(' ')
}

export function splitIntoChunks(chinese: string): { chinese: string }[] {
  const parts = chinese
    .split(/[，。、：；;,!?！？]+/)
    .map((s) => s.replace(/[“”"「」『』'"：:]+/g, '').trim())
    .filter((s) => hanChars(s).length > 0)
  return parts.map((p) => ({ chinese: p }))
}

export function missedWordUnits(
  _chinese: string,
  syllables: Array<Pick<SyllableScore, 'character'> & { color?: string }>
): { chinese: string }[] {
  const units: { chinese: string }[] = []
  let buf = ''
  for (const s of syllables) {
    if (s.color && s.color !== 'green') {
      buf += s.character
    } else if (buf) {
      units.push({ chinese: buf })
      buf = ''
    }
  }
  if (buf) units.push({ chinese: buf })
  return units
}

function toItem(input: CoachItemInput, speed: SpeedName = 'normal'): CoachItem {
  return {
    ...input,
    pinyin: withPinyin(input.chinese, input.pinyin),
    speed,
    playbackRate: playbackRateFor(speed),
  }
}

export function createLadder(items: CoachItemInput[]): LadderSession {
  const full = items.map((item) => toItem(item, 'normal'))
  if (full.length === 0) {
    throw new Error('createLadder requires at least one item')
  }
  return {
    queue: full.slice(1),
    current: full[0],
    stage: 'full',
    failCountOnCurrent: 0,
    attemptsOnPhrase: 0,
    phraseRoot: full[0],
    drillQueue: [],
    events: [],
    needsWorkIds: [],
    passedIds: [],
    done: false,
  }
}

function moveToNext(session: LadderSession, event: LadderEvent): LadderSession {
  if (session.queue.length === 0) {
    return {
      ...session,
      events: [event],
      done: true,
      stage: 'done',
    }
  }
  const [next, ...rest] = session.queue
  return {
    ...session,
    queue: rest,
    current: withSpeed(next, 'normal'),
    phraseRoot: next,
    stage: 'full',
    failCountOnCurrent: 0,
    attemptsOnPhrase: 0,
    drillQueue: [],
    events: [event],
    done: false,
  }
}

function markNeedsWork(session: LadderSession, attempts: number): LadderSession {
  const id = session.phraseRoot.id
  return moveToNext(
    {
      ...session,
      attemptsOnPhrase: attempts,
      needsWorkIds: session.needsWorkIds.includes(id)
        ? session.needsWorkIds
        : [...session.needsWorkIds, id],
    },
    {
      kind: 'needs-work',
      message: "We'll come back to this one together. You're building it — let's keep going.",
    }
  )
}

export function applyScore(
  session: LadderSession,
  score: number,
  syllables: Array<Pick<SyllableScore, 'character'> & { color?: string }>
): LadderSession {
  const passed = score >= PASS_THRESHOLD
  const attempts = session.attemptsOnPhrase + 1
  const root = session.phraseRoot

  if (!passed && attempts >= MAX_ATTEMPTS_PER_PHRASE) {
    return markNeedsWork(session, attempts)
  }

  if (session.stage === 'word-drill') {
    if (passed) {
      if (session.current.speed !== 'normal') {
        return {
          ...session,
          attemptsOnPhrase: attempts,
          failCountOnCurrent: 0,
          current: withSpeed(session.current, 'normal'),
          events: [{ kind: 'passed', message: 'Nice — now once at normal speed.' }],
        }
      }
      if (session.drillQueue.length > 0) {
        const [next, ...rest] = session.drillQueue
        return {
          ...session,
          attemptsOnPhrase: attempts,
          failCountOnCurrent: 0,
          drillQueue: rest,
          current: withSpeed(next, 'slower'),
          events: [{ kind: 'word-drill', message: `Good. Let's work on ${next.chinese} next.` }],
        }
      }
      return {
        ...session,
        attemptsOnPhrase: attempts,
        failCountOnCurrent: 0,
        stage: 'rebuild',
        current: withSpeed(root, 'slow'),
        events: [
          {
            kind: 'rebuild',
            message: "Let's put the whole line back together, a little slower.",
          },
        ],
      }
    }
    return {
      ...session,
      attemptsOnPhrase: attempts,
      current: withSpeed(session.current, 'slower'),
      events: [
        {
          kind: 'slow-down',
          message: 'Again, slowly. Hear it once more, then you try.',
        },
      ],
    }
  }

  if (session.stage === 'rebuild') {
    if (passed) {
      if (session.current.speed !== 'normal') {
        return {
          ...session,
          attemptsOnPhrase: attempts,
          failCountOnCurrent: 0,
          current: withSpeed(root, 'normal'),
          events: [{ kind: 'rebuild', message: 'Almost there — once more at normal speed.' }],
        }
      }
      return moveToNext(
        {
          ...session,
          attemptsOnPhrase: attempts,
          passedIds: session.passedIds.includes(root.id) ? session.passedIds : [...session.passedIds, root.id],
        },
        { kind: 'passed', message: 'Yes. That line is yours now.' }
      )
    }
    if (session.failCountOnCurrent >= 1) {
      return markNeedsWork(session, attempts)
    }
    return {
      ...session,
      attemptsOnPhrase: attempts,
      failCountOnCurrent: session.failCountOnCurrent + 1,
      current: withSpeed(root, 'slower'),
      events: [{ kind: 'slow-down', message: "Let's take the whole line even slower." }],
    }
  }

  // full or slow-retry
  if (passed) {
    return moveToNext(
      {
        ...session,
        attemptsOnPhrase: attempts,
        passedIds: session.passedIds.includes(root.id) ? session.passedIds : [...session.passedIds, root.id],
      },
      { kind: 'passed', message: 'Clear and steady. On to the next one.' }
    )
  }

  const fails = session.failCountOnCurrent + 1
  if (fails === 1) {
    return {
      ...session,
      attemptsOnPhrase: attempts,
      failCountOnCurrent: 1,
      stage: 'slow-retry',
      current: withSpeed(root, 'slow'),
      events: [{ kind: 'slow-down', message: "Let's try that again a little slower." }],
    }
  }

  let units = missedWordUnits(root.chinese, syllables)
  if (units.length === 0) {
    units = splitIntoChunks(root.chinese)
  }
  const drills: CoachItem[] = units.map((unit, i) =>
    toItem(
      {
        id: `${root.id}-word-${i}-${unit.chinese}`,
        kind: 'word',
        chinese: unit.chinese,
        pinyin: '',
        parentId: root.id,
      },
      'slower'
    )
  )
  const first = drills[0]
  return {
    ...session,
    attemptsOnPhrase: attempts,
    failCountOnCurrent: fails,
    stage: 'word-drill',
    drillQueue: drills.slice(1),
    current: first,
    events: [
      {
        kind: 'word-drill',
        message: `Let's concentrate on ${first.chinese} together.`,
      },
    ],
  }
}
