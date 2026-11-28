import { useEffect, useRef, useState } from 'react'
import { assetUrl } from '../assetUrl'
import {
  activeWordIndex,
  fetchTimings,
  timingsUrlFor,
  wordSeekTime,
  type WordsTimings,
} from '../wordsTimings'

interface WordsAudioPlayerProps {
  audioUrl: string
  title?: string
  timingsUrl?: string
}

export default function WordsAudioPlayer({ audioUrl, title = 'Words audio', timingsUrl }: WordsAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const rowRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [timings, setTimings] = useState<WordsTimings | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [loadError, setLoadError] = useState(false)

  const src = assetUrl(audioUrl)
  const jsonUrl = assetUrl(timingsUrl || timingsUrlFor(audioUrl))
  const active = timings ? activeWordIndex(currentTime, timings.words) : -1

  useEffect(() => {
    let cancelled = false
    setLoadError(false)
    void fetchTimings<WordsTimings>(jsonUrl).then((data) => {
      if (cancelled) return
      if (!data?.words?.length) setLoadError(true)
      else setTimings(data)
    })
    return () => {
      cancelled = true
    }
  }, [jsonUrl])

  useEffect(() => {
    const el = rowRefs.current[active]
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [active])

  const playFrom = (time?: number) => {
    const audio = audioRef.current
    if (!audio) return
    if (!audio.src) audio.src = src
    if (typeof time === 'number') audio.currentTime = time
    void audio.play()
  }

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      return
    }
    playFrom()
  }

  const restart = () => {
    playFrom(0)
  }

  const jumpTo = (index: number) => {
    const word = timings?.words[index]
    if (!word) return
    playFrom(wordSeekTime(word))
  }

  return (
    <div className="words-player" data-testid="words-player">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        playsInline
        onTimeUpdate={(e) => setCurrentTime((e.target as HTMLAudioElement).currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
      <div className="words-player-head">
        <h3>{title}</h3>
        <div className="words-player-controls">
          <button type="button" className="action-button" onClick={togglePlay} data-testid="words-play">
            {playing ? 'Pause' : 'Play'}
          </button>
          <button type="button" className="action-button" onClick={restart}>
            Restart
          </button>
        </div>
        <p className="words-player-hint">Each word is said twice, slowly. Tap a word to jump to it.</p>
      </div>
      {loadError && <p className="words-player-error">Timing data is missing, so highlighting is off. You can still play the audio.</p>}
      {timings && (
        <ol className="words-player-list">
          {timings.words.map((word, i) => (
            <li key={`${word.chinese}-${i}`}>
              <button
                type="button"
                ref={(el) => {
                  rowRefs.current[i] = el
                }}
                className={`word-row${i === active ? ' is-active' : ''}`}
                onClick={() => jumpTo(i)}
                data-testid={i === active ? 'word-active' : undefined}
                data-word-index={i}
              >
                <span className="word-zh">{word.chinese}</span>
                <span className="word-py">{word.pinyin}</span>
                <span className="word-en">{word.english}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
