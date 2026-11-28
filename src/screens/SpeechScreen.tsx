import { useEffect, useRef, useState } from 'react'
import type { SpeechLine } from '../types'
import { assetUrl } from '../assetUrl'
import { playReference } from '../speakAudio'
import { lineNeedsNewAudio } from '../speechRevision'
import WordsAudioPlayer from '../components/WordsAudioPlayer'
import ScriptView from '../components/ScriptView'
import {
  activeLineIndex,
  fetchTimings,
  timingsUrlFor,
  type LineTimings,
} from '../wordsTimings'

interface SpeechScreenProps {
  speechLines: SpeechLine[]
  originals?: SpeechLine[]
  unknownChars?: string[]
  onToggleChar?: (ch: string) => void
  initialView?: ViewMode
  autoOpenWords?: boolean
}

type ViewMode = 'script' | 'lines' | 'podium'

function readDemoView(): ViewMode | null {
  if (typeof window === 'undefined') return null
  const demo = new URLSearchParams(window.location.search).get('demo')
  if (demo === 'script' || demo === 'tricky-words') return 'script'
  return null
}

export default function SpeechScreen({
  speechLines,
  originals = [],
  unknownChars = [],
  onToggleChar,
  initialView,
  autoOpenWords = false,
}: SpeechScreenProps) {
  const [showPinyin, setShowPinyin] = useState(true)
  const [showEnglish, setShowEnglish] = useState(true)
  const [showAllPinyin, setShowAllPinyin] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>(initialView || readDemoView() || 'script')
  const [shadowingMode, setShadowingMode] = useState(false)
  const [currentLineIndex, setCurrentLineIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [speechTime, setSpeechTime] = useState(0)
  const [speechPlaying, setSpeechPlaying] = useState(false)
  const [speechKind, setSpeechKind] = useState<'normal' | 'slow' | 'shadowing' | null>(null)
  const [normalTimings, setNormalTimings] = useState<LineTimings | null>(null)
  const [slowTimings, setSlowTimings] = useState<LineTimings | null>(null)

  const normalUrl = assetUrl('/audio/full_speech_normal.mp3')
  const slowUrl = assetUrl('/audio/full_speech_slow.mp3')
  const shadowUrl = assetUrl('/audio/shadowing_drill.mp3')

  useEffect(() => {
    void fetchTimings<LineTimings>(assetUrl(timingsUrlFor('/audio/full_speech_normal.mp3'))).then(setNormalTimings)
    void fetchTimings<LineTimings>(assetUrl(timingsUrlFor('/audio/full_speech_slow.mp3'))).then(setSlowTimings)
  }, [])

  const activeTimings = speechKind === 'slow' ? slowTimings : speechKind === 'normal' ? normalTimings : null
  const spokenLine = activeTimings ? activeLineIndex(speechTime, activeTimings.lines) : -1

  const playLine = (index: number) => {
    const line = speechLines[index]
    const needs = originals.length ? lineNeedsNewAudio(line, originals) : !line.audioUrl
    void playReference({
      audioUrl: needs ? undefined : line.audioUrl,
      text: line.chinese,
    })
  }

  const handleShadowingNext = () => {
    if (currentLineIndex < speechLines.length - 1) {
      const nextIndex = currentLineIndex + 1
      setCurrentLineIndex(nextIndex)
      playLine(nextIndex)

      setTimeout(() => {
        setIsPaused(true)
        setTimeout(() => {
          setIsPaused(false)
        }, 3000)
      }, 2000)
    } else {
      setShadowingMode(false)
      setCurrentLineIndex(0)
    }
  }

  const startShadowing = () => {
    setShadowingMode(true)
    setCurrentLineIndex(0)
    playLine(0)
    setTimeout(() => {
      setIsPaused(true)
      setTimeout(() => {
        setIsPaused(false)
      }, 3000)
    }, 2000)
  }

  useEffect(() => {
    if (shadowingMode && !isPaused) {
      const timer = setTimeout(handleShadowingNext, 1000)
      return () => clearTimeout(timer)
    }
  }, [shadowingMode, isPaused, currentLineIndex])

  const playFull = (kind: 'normal' | 'slow' | 'shadowing', start?: number) => {
    const audio = audioRef.current
    if (!audio) return
    const url = kind === 'normal' ? normalUrl : kind === 'slow' ? slowUrl : shadowUrl
    const already = audio.src && audio.src.endsWith(url.replace(/^\.\//, ''))
    if (!already) audio.src = url
    setSpeechKind(kind)
    if (typeof start === 'number') audio.currentTime = start
    void audio.play()
  }

  const seekScriptLine = (index: number) => {
    const kind: 'normal' | 'slow' = speechKind === 'slow' ? 'slow' : 'normal'
    const timings = kind === 'slow' ? slowTimings : normalTimings
    const row = timings?.lines[index]
    playFull(kind, row?.start ?? 0)
  }

  if (viewMode === 'podium') {
    return (
      <div className="screen podium-view">
        <button className="back-button" onClick={() => setViewMode('script')}>
          ← Back
        </button>
        <div className="podium-content">
          {speechLines.map((line) => (
            <div key={line.number} className="podium-line">
              <div className="podium-chinese">{line.chinese}</div>
              {showPinyin && <div className="podium-pinyin">{line.pinyin}</div>}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="screen speech-screen">
      <audio
        ref={audioRef}
        playsInline
        preload="metadata"
        onTimeUpdate={(e) => setSpeechTime((e.target as HTMLAudioElement).currentTime)}
        onPlay={() => setSpeechPlaying(true)}
        onPause={() => setSpeechPlaying(false)}
        onEnded={() => setSpeechPlaying(false)}
      />

      <div className="speech-view-tabs" role="tablist">
        <button
          type="button"
          className={viewMode === 'script' ? 'active' : ''}
          onClick={() => setViewMode('script')}
          data-testid="view-script"
        >
          Script
        </button>
        <button
          type="button"
          className={viewMode === 'lines' ? 'active' : ''}
          onClick={() => setViewMode('lines')}
          data-testid="view-lines"
        >
          Lines
        </button>
        <button type="button" className="" onClick={() => setViewMode('podium')}>
          Podium
        </button>
      </div>

      {viewMode === 'script' && (
        <>
          <p className="script-lead">
            Big characters, with a slash at each breath. Pinyin sits only above characters you marked
            as not yet known. Tap a character to mark or unmark it, or turn on all pinyin.
          </p>
          <div className="controls">
            <label>
              <input
                type="checkbox"
                checked={showAllPinyin}
                onChange={(e) => setShowAllPinyin(e.target.checked)}
                data-testid="show-all-pinyin"
              />
              Show all pinyin
            </label>
          </div>
        </>
      )}

      {viewMode === 'lines' && (
        <div className="controls">
          <label>
            <input
              type="checkbox"
              checked={showPinyin}
              onChange={(e) => setShowPinyin(e.target.checked)}
            />
            Show Pinyin
          </label>
          <label>
            <input
              type="checkbox"
              checked={showEnglish}
              onChange={(e) => setShowEnglish(e.target.checked)}
            />
            Show English
          </label>
        </div>
      )}

      <div className="full-speech-controls">
        <h3>Full Speech Audio</h3>
        <div className="audio-buttons">
          <button type="button" onClick={() => (speechPlaying && speechKind === 'normal' ? audioRef.current?.pause() : playFull('normal'))}>
            {speechPlaying && speechKind === 'normal' ? 'Pause' : 'Play normal speed'}
          </button>
          <button type="button" onClick={() => (speechPlaying && speechKind === 'slow' ? audioRef.current?.pause() : playFull('slow'))}>
            {speechPlaying && speechKind === 'slow' ? 'Pause' : 'Play slow speed'}
          </button>
          <button type="button" onClick={() => (speechPlaying && speechKind === 'shadowing' ? audioRef.current?.pause() : playFull('shadowing'))}>
            {speechPlaying && speechKind === 'shadowing' ? 'Pause' : 'Shadowing drill'}
          </button>
        </div>
        {spokenLine >= 0 && <p className="now-playing-line">Now: line {speechLines[spokenLine]?.number}</p>}
      </div>

      {viewMode === 'script' && (
        <ScriptView
          lines={speechLines}
          unknownChars={unknownChars}
          showAllPinyin={showAllPinyin}
          activeLineIndex={spokenLine}
          onToggleChar={onToggleChar}
          onSeekLine={seekScriptLine}
        />
      )}

      {viewMode === 'lines' && (
        <>
          <div className="speech-actions">
            <button onClick={startShadowing} className="action-button" disabled={shadowingMode}>
              Start line-by-line shadowing
            </button>
          </div>

          {shadowingMode && (
            <div className="shadowing-indicator">
              <h3>Shadowing Mode Active</h3>
              <p>
                Line {currentLineIndex + 1} of {speechLines.length}
              </p>
              {isPaused && <p className="pulse">Your turn - repeat now!</p>}
            </div>
          )}

          <div className="speech-lines">
            {speechLines.map((line, idx) => (
              <div
                key={line.number}
                className={`speech-line${
                  (shadowingMode && idx === currentLineIndex) || (!shadowingMode && idx === spokenLine)
                    ? ' active'
                    : ''
                }`}
              >
                <div className="line-number">{line.number}</div>
                <div className="line-content">
                  <div className="line-chinese">{line.chinese}</div>
                  {showPinyin && <div className="line-pinyin">{line.pinyin}</div>}
                  {showEnglish && <div className="line-english">{line.english}</div>}
                  {originals.length > 0 && lineNeedsNewAudio(line, originals) && (
                    <p className="audio-needed">New audio needed — playing a device voice for this line.</p>
                  )}
                  <button className="play-button" onClick={() => playLine(idx)} disabled={shadowingMode}>
                    Play
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className={autoOpenWords ? 'tricky-words-section is-demo' : 'tricky-words-section'}>
        <WordsAudioPlayer audioUrl="/audio/tricky_words.mp3" title="Tricky words audio" />
      </div>
    </div>
  )
}
