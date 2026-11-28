import { uniqueSpeechChars, toggleUnknownChar, saveUnknownChars } from '../unknownChars'
import type { SpeechLine } from '../types'

interface CharsScreenProps {
  canonicalLines: SpeechLine[]
  unknownChars: string[]
  onUnknownChange: (chars: string[]) => void
  onOpenScript?: () => void
}

export default function CharsScreen({
  canonicalLines,
  unknownChars,
  onUnknownChange,
  onOpenScript,
}: CharsScreenProps) {
  const tiles = uniqueSpeechChars(canonicalLines)
  const unknown = new Set(unknownChars)

  const toggle = (ch: string) => {
    onUnknownChange(toggleUnknownChar(ch, unknownChars))
  }

  const clearAll = () => {
    saveUnknownChars([])
    onUnknownChange([])
  }

  return (
    <div className="screen chars-screen" data-testid="chars-screen">
      <h2>Know my characters</h2>
      <p className="chars-lead">
        These are every unique character in your speech, in the order they first appear. Tap the ones
        you do <strong>not</strong> know yet. The Speech script will show pinyin only above those.
      </p>
      <p className="chars-count" data-testid="chars-count">
        {unknownChars.length} of {tiles.length} marked as not yet known
      </p>
      <div className="chars-actions">
        {onOpenScript && (
          <button type="button" className="action-button" onClick={onOpenScript}>
            Open speech script
          </button>
        )}
        <button type="button" className="action-button" onClick={clearAll} disabled={!unknownChars.length}>
          Clear marks
        </button>
      </div>
      <div className="chars-grid" data-testid="chars-grid">
        {tiles.map((ch) => (
          <button
            key={ch}
            type="button"
            className={`char-tile${unknown.has(ch) ? ' is-unknown' : ''}`}
            onClick={() => toggle(ch)}
            aria-pressed={unknown.has(ch)}
            data-char={ch}
          >
            {ch}
          </button>
        ))}
      </div>
    </div>
  )
}
