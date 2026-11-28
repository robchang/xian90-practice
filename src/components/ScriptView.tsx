import { useEffect, useRef } from 'react'
import { charPinyinUnits } from '../speechPinyin'
import { chunksForLine } from '../scriptChunks'
import type { SpeechLine } from '../types'

interface ScriptViewProps {
  lines: SpeechLine[]
  unknownChars: string[]
  showAllPinyin: boolean
  activeLineIndex?: number
  onToggleChar?: (ch: string) => void
  onSeekLine?: (index: number) => void
}

export default function ScriptView({
  lines,
  unknownChars,
  showAllPinyin,
  activeLineIndex = -1,
  onToggleChar,
  onSeekLine,
}: ScriptViewProps) {
  const unknown = new Set(unknownChars)
  const lineRefs = useRef<Array<HTMLElement | null>>([])

  useEffect(() => {
    const el = lineRefs.current[activeLineIndex]
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [activeLineIndex])

  return (
    <div className="script-view" data-testid="script-view">
      {lines.map((line, idx) => {
        const chunks = chunksForLine(line)
        let cursor = 0
        const units = charPinyinUnits(line.chinese)
        return (
          <article
            key={line.number}
            ref={(el) => {
              lineRefs.current[idx] = el
            }}
            className={`script-line${idx === activeLineIndex ? ' is-active' : ''}`}
            data-testid={idx === activeLineIndex ? 'script-line-active' : undefined}
            onClick={() => onSeekLine?.(idx)}
          >
            <div className="script-line-num">{line.number}</div>
            <div className="script-chunks">
              {chunks.map((chunk, ci) => {
                const slice = units.slice(cursor, cursor + chunk.length)
                cursor += chunk.length
                return (
                  <span key={`${line.number}-${ci}`} className="script-chunk">
                    {ci > 0 && (
                      <span className="script-slash" aria-hidden="true">
                        /
                      </span>
                    )}
                    {slice.map((unit, ui) => {
                      const isHan = /[\u4e00-\u9fff]/.test(unit.char)
                      const showPy = isHan && (showAllPinyin || unknown.has(unit.char))
                      if (!isHan) {
                        return (
                          <span key={`${ci}-${ui}`} className="script-punct">
                            {unit.char}
                          </span>
                        )
                      }
                      return (
                        <button
                          key={`${ci}-${ui}`}
                          type="button"
                          className={`script-char${unknown.has(unit.char) ? ' is-unknown' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            onToggleChar?.(unit.char)
                          }}
                          aria-label={
                            unknown.has(unit.char)
                              ? `${unit.char}, marked unknown`
                              : `${unit.char}, known`
                          }
                        >
                          <span className="script-py">{showPy ? unit.pinyin : '\u00a0'}</span>
                          <span className="script-han">{unit.char}</span>
                        </button>
                      )
                    })}
                  </span>
                )
              })}
            </div>
          </article>
        )
      })}
    </div>
  )
}
