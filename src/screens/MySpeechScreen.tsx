import { useEffect, useMemo, useState } from 'react'
import type { SpeechLine } from '../types'
import { spokenPinyin } from '../speechPinyin'
import { SIMPLER_OPTIONS } from '../simplerSpeech'
import { markHardWords, type HardToken } from '../hsk'
import {
  formatSpeechPlain,
  lineNeedsNewAudio,
  makeBlankLine,
  moveLine,
  renumber,
  serializeCoachSpeechExport,
  buildCoachSpeechExport,
  sameLineText,
  type SpeechSnapshot,
} from '../speechRevision'
import { playReference, warmSpeechVoices } from '../speakAudio'
import { buildLabel } from '../buildInfo'

interface MySpeechScreenProps {
  originals: SpeechLine[]
  lines: SpeechLine[]
  history: SpeechSnapshot[]
  onSave: (lines: SpeechLine[]) => Promise<void> | void
  onRestore: (snapshot: SpeechSnapshot) => Promise<void> | void
  onRevertAll: () => Promise<void> | void
  demo?: 'editor' | 'simple' | null
}

function HardText({ tokens }: { tokens: HardToken[] }) {
  const [open, setOpen] = useState<string | null>(null)
  return (
    <span className="hard-text">
      {tokens.map((tok, i) =>
        tok.hard ? (
          <button
            type="button"
            key={`${tok.start}-${i}`}
            className="hard-word"
            onClick={() => setOpen(open === tok.text ? null : tok.text)}
          >
            {tok.text}
            {open === tok.text && (
              <span className="hard-tip">
                {tok.meaning || 'This word is above about HSK 3.'}
              </span>
            )}
          </button>
        ) : (
          <span key={`${tok.start}-${i}`}>{tok.text}</span>
        )
      )}
    </span>
  )
}

export default function MySpeechScreen({
  originals,
  lines: savedLines,
  history,
  onSave,
  onRestore,
  onRevertAll,
  demo = null,
}: MySpeechScreenProps) {
  const [draft, setDraft] = useState<SpeechLine[]>(savedLines)
  const [editing, setEditing] = useState<number | null>(demo === 'editor' ? 0 : null)
  const [showSimpleFor, setShowSimpleFor] = useState<number | null>(demo === 'simple' ? 0 : null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setDraft(savedLines)
  }, [savedLines])

  useEffect(() => {
    warmSpeechVoices()
  }, [])

  const dirty = useMemo(() => {
    if (draft.length !== savedLines.length) return true
    return draft.some((line, i) => !sameLineText(line.chinese, savedLines[i].chinese) || line.english !== savedLines[i].english)
  }, [draft, savedLines])

  const updateLine = (index: number, patch: Partial<SpeechLine>) => {
    setDraft((cur) =>
      cur.map((line, i) => {
        if (i !== index) return line
        const next = { ...line, ...patch }
        if (patch.chinese !== undefined) next.pinyin = spokenPinyin(patch.chinese)
        return next
      })
    )
  }

  const originalFor = (line: SpeechLine, index: number) => {
    return originals.find((o) => o.number === (line.number || index + 1)) || originals[index]
  }

  const handleSave = async () => {
    setBusy(true)
    try {
      await onSave(renumber(draft.map((l) => ({ ...l, pinyin: spokenPinyin(l.chinese) }))))
      setNote('Saved on this phone.')
      setEditing(null)
    } finally {
      setBusy(false)
    }
  }

  const revertLine = (index: number) => {
    const orig = originalFor(draft[index], index)
    if (!orig) return
    updateLine(index, { chinese: orig.chinese, english: orig.english, pinyin: orig.pinyin, audioUrl: orig.audioUrl })
  }

  const applySimple = (index: number, chinese: string, english: string) => {
    updateLine(index, { chinese, english, pinyin: spokenPinyin(chinese) })
    setShowSimpleFor(index)
    setEditing(index)
  }

  const exportSpeech = async () => {
    const text = serializeCoachSpeechExport(buildCoachSpeechExport(draft, originals, buildLabel()))
    try {
      if (navigator.share) {
        try {
          await navigator.share({ title: 'My speech draft', text })
          setNote('Opened the share sheet.')
          return
        } catch {
          /* fall through */
        }
      }
      await navigator.clipboard.writeText(text)
      setNote('Copied the speech (plain text + JSON). Paste it in our chat.')
    } catch {
      setNote('Could not copy. You can select the text after opening diagnostics, or try again.')
    }
  }

  return (
    <div className="screen my-speech-screen" data-testid="my-speech">
      <h2>My Speech</h2>
      <p className="focus-lead">
        Read every line, simplify words where you can, and save. Practice uses this draft on this phone.
        I will not change the names, the words “问心无愧,” or the core history.
      </p>

      <div className="myspeech-toolbar">
        <button className="coach-primary" onClick={() => void handleSave()} disabled={!dirty || busy} data-testid="speech-save">
          Save draft
        </button>
        <button className="coach-secondary" onClick={() => void exportSpeech()} data-testid="speech-export">
          Export / send to coach
        </button>
        <button className="text-link" onClick={() => void onRevertAll()}>
          Revert all to original
        </button>
      </div>
      {note && <p className="share-note">{note}</p>}
      {dirty && <p className="myspeech-dirty">You have unsaved changes.</p>}

      {history.length > 0 && (
        <label className="myspeech-history">
          Restore a previous save
          <select
            defaultValue=""
            onChange={(e) => {
              const i = Number(e.target.value)
              if (!Number.isNaN(i) && history[i]) void onRestore(history[i])
              e.target.value = ''
            }}
          >
            <option value="">Choose a save…</option>
            {[...history].reverse().map((snap, revI) => {
              const i = history.length - 1 - revI
              const when = new Date(snap.savedAt).toLocaleString('en-US', {
                timeZone: 'America/Los_Angeles',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })
              return (
                <option key={snap.savedAt} value={i}>
                  {when} PT · {snap.lines.length} lines{snap.label ? ` · ${snap.label}` : ''}
                </option>
              )
            })}
          </select>
        </label>
      )}

      <ol className="myspeech-list">
        {draft.map((line, index) => {
          const needsAudio = lineNeedsNewAudio(line, originals)
          const orig = originalFor(line, index)
          const simple = (orig && SIMPLER_OPTIONS[orig.number]) || SIMPLER_OPTIONS[line.number] || []
          const isEditing = editing === index
          const showSimple = showSimpleFor === index
          return (
            <li key={`line-${index}`} className="myspeech-card" data-testid={`speech-line-${index}`}>
              <div className="myspeech-card-head">
                <span className="myspeech-num">Line {line.number}</span>
                <div className="myspeech-card-actions">
                  <button type="button" className="icon-btn" onClick={() => setDraft((d) => moveLine(d, index, -1))} disabled={index === 0} aria-label="Move up">↑</button>
                  <button type="button" className="icon-btn" onClick={() => setDraft((d) => moveLine(d, index, 1))} disabled={index === draft.length - 1} aria-label="Move down">↓</button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => {
                      if (draft.length <= 1) return
                      setDraft((d) => renumber(d.filter((_, i) => i !== index)))
                      setEditing(null)
                    }}
                    aria-label="Delete line"
                  >
                    ×
                  </button>
                </div>
              </div>

              {isEditing ? (
                <>
                  <label className="myspeech-label">
                    Chinese
                    <textarea
                      className="myspeech-input"
                      rows={3}
                      value={line.chinese}
                      onChange={(e) => updateLine(index, { chinese: e.target.value })}
                      data-testid={`speech-edit-${index}`}
                    />
                  </label>
                  <p className="line-pinyin">{line.pinyin || spokenPinyin(line.chinese)}</p>
                  <label className="myspeech-label">
                    English
                    <textarea
                      className="myspeech-input"
                      rows={2}
                      value={line.english}
                      onChange={(e) => updateLine(index, { english: e.target.value })}
                    />
                  </label>
                </>
              ) : (
                <>
                  <p className="line-chinese">
                    <HardText tokens={markHardWords(line.chinese)} />
                  </p>
                  <p className="line-pinyin">{line.pinyin || spokenPinyin(line.chinese)}</p>
                  <p className="line-english">{line.english}</p>
                </>
              )}

              {needsAudio && <p className="audio-needed">New audio needed — I’ll play a device voice until we record this line.</p>}

              <div className="myspeech-row-btns">
                <button
                  type="button"
                  className="coach-secondary"
                  onClick={() =>
                    void playReference({
                      audioUrl: needsAudio ? undefined : line.audioUrl,
                      text: line.chinese,
                    })
                  }
                  data-testid={`speech-play-${index}`}
                >
                  Play
                </button>
                <button type="button" className="coach-secondary" onClick={() => setEditing(isEditing ? null : index)}>
                  {isEditing ? 'Done editing' : 'Edit'}
                </button>
                <button type="button" className="coach-secondary" onClick={() => revertLine(index)} disabled={!orig}>
                  Revert to original
                </button>
                {simple.length > 0 && (
                  <button
                    type="button"
                    className="coach-secondary"
                    data-testid={`speech-simple-${index}`}
                    onClick={() => setShowSimpleFor(showSimple ? null : index)}
                  >
                    {showSimple ? 'Hide simpler options' : 'Simpler option'}
                  </button>
                )}
              </div>

              {showSimple && simple.length > 0 && (
                <ul className="simple-options" data-testid={`simple-list-${index}`}>
                  {simple.map((opt) => (
                    <li key={opt.chinese}>
                      <p className="line-chinese">{opt.chinese}</p>
                      <p className="line-pinyin">{spokenPinyin(opt.chinese)}</p>
                      <p className="line-english">{opt.english}</p>
                      <button
                        type="button"
                        className="coach-primary"
                        data-testid={`apply-simple-${index}`}
                        onClick={() => applySimple(index, opt.chinese, opt.english)}
                      >
                        Use this line
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ol>

      <button
        type="button"
        className="coach-secondary"
        onClick={() => {
          setDraft((d) => renumber([...d, makeBlankLine(d.length)]))
          setEditing(draft.length)
        }}
      >
        Add a line
      </button>

      <pre className="myspeech-preview" hidden>{formatSpeechPlain(draft)}</pre>
    </div>
  )
}
