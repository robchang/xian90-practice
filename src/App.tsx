import { useEffect, useMemo, useState } from 'react'
import type { SpeechLine, DailyLesson, VocabWord, UserProgress, SpeakAttempt } from './types'
import { getProgress, getSpeakAttempts } from './storage'
import TodayScreen from './screens/TodayScreen'
import SpeechScreen from './screens/SpeechScreen'
import SpeakScreen from './screens/SpeakScreen'
import QuizScreen from './screens/QuizScreen'
import ArchiveScreen from './screens/ArchiveScreen'
import ProgressScreen from './screens/ProgressScreen'
import { assetUrl } from './assetUrl'
import { buildTodayFocus, computeWeaknesses, type FocusItem } from './focusSession'
import './App.css'

type Screen = 'today' | 'speak' | 'speech' | 'quiz' | 'archive' | 'progress'
type SpeakDemo = 'prompt' | 'result' | 'drill'

function readDemo(): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('demo')
}

function lessonLines(lesson: DailyLesson | undefined, speechLines: SpeechLine[]): SpeechLine[] {
  if (!lesson) return []
  return lesson.practiceLines
    .map((line) => {
      const chinese = typeof line === 'string' ? line : line.chinese
      const match = speechLines.find((s) => s.chinese.replace(/[，。！？、：；“”"]/g, '') === chinese.replace(/[，。！？、：；“”"]/g, '') || s.chinese.includes(chinese) || chinese.includes(s.chinese))
      if (match) return match
      if (typeof line === 'string') return undefined
      return {
        number: 0,
        chinese: line.chinese,
        pinyin: line.pinyin,
        english: line.english,
      } satisfies SpeechLine
    })
    .filter((l): l is SpeechLine => !!l)
}

function demoAttempts(speechLines: SpeechLine[]): SpeakAttempt[] {
  const now = Date.now()
  const line4 = speechLines.find((l) => l.number === 4)
  return [
    {
      id: 'd1',
      itemId: 'word:抗日',
      kind: 'word',
      chinese: '抗日',
      score: 42,
      syllableScores: [],
      speed: 'normal',
      timestamp: now,
      source: 'whisper',
    },
    {
      id: 'd2',
      itemId: 'line-4',
      kind: 'line',
      chinese: line4?.chinese ?? '发动了西安事变。',
      score: 55,
      syllableScores: [],
      speed: 'normal',
      timestamp: now - 2000,
      source: 'whisper',
    },
    {
      id: 'd3',
      itemId: 'line-4',
      kind: 'line',
      chinese: line4?.chinese ?? '发动了西安事变。',
      score: 50,
      syllableScores: [],
      speed: 'slow',
      timestamp: now - 4000,
      source: 'whisper',
    },
    {
      id: 'd4',
      itemId: 'line-1',
      kind: 'line',
      chinese: speechLines[0]?.chinese ?? '大家好！',
      score: 96,
      syllableScores: [],
      speed: 'normal',
      timestamp: now,
      source: 'whisper',
    },
    {
      id: 'd5',
      itemId: 'line-1',
      kind: 'line',
      chinese: speechLines[0]?.chinese ?? '大家好！',
      score: 94,
      syllableScores: [],
      speed: 'normal',
      timestamp: now - 1000,
      source: 'whisper',
    },
  ]
}

function App() {
  const demo = readDemo()
  const speakDemo: SpeakDemo | null =
    demo === 'prompt' || demo === 'result' || demo === 'drill' ? demo : null
  const [currentScreen, setCurrentScreen] = useState<Screen>(
    speakDemo ? 'speak' : 'today'
  )
  const [speechLines, setSpeechLines] = useState<SpeechLine[]>([])
  const [lessons, setLessons] = useState<DailyLesson[]>([])
  const [glossary, setGlossary] = useState<VocabWord[]>([])
  const [progress, setProgress] = useState<UserProgress | null>(null)
  const [attempts, setAttempts] = useState<SpeakAttempt[]>([])
  const [loading, setLoading] = useState(true)
  const [autoStartSpeak, setAutoStartSpeak] = useState(false)

  useEffect(() => {
    void loadData()
  }, [])

  async function loadData() {
    try {
      const [speechRes, glossaryRes, lessonsIndexRes, progressData, storedAttempts] = await Promise.all([
        fetch(assetUrl('data/speech.json')),
        fetch(assetUrl('data/glossary.json')),
        fetch(assetUrl('data/lessons/index.json')),
        getProgress(),
        getSpeakAttempts(),
      ])
      const speechData = await speechRes.json()
      const glossaryData = await glossaryRes.json()
      const lessonsIndex = await lessonsIndexRes.json()
      setSpeechLines(speechData)
      setGlossary(glossaryData)
      setProgress(progressData)
      setAttempts(demo === 'today-focus' ? demoAttempts(speechData) : storedAttempts)
      const lessonPromises = lessonsIndex.lessons.map((l: { file: string }) =>
        fetch(assetUrl(`data/lessons/${l.file}`)).then((r) => r.json())
      )
      setLessons(await Promise.all(lessonPromises))
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function refreshProgress() {
    const [progressData, storedAttempts] = await Promise.all([getProgress(), getSpeakAttempts()])
    setProgress(progressData)
    if (demo !== 'today-focus') setAttempts(storedAttempts)
  }

  const currentLesson = useMemo(() => {
    if (!progress) return lessons[0]
    return lessons.find((l) => l.day === progress.currentDay) || lessons[0]
  }, [lessons, progress])

  const todayLessonLines = useMemo(
    () => lessonLines(currentLesson, speechLines),
    [currentLesson, speechLines]
  )

  const effectiveAttempts = attempts
  const focusItems: FocusItem[] = useMemo(
    () =>
      buildTodayFocus({
        attempts: effectiveAttempts,
        speechLines,
        todayLessonLines,
        limit: 6,
      }),
    [effectiveAttempts, speechLines, todayLessonLines]
  )
  const troubleWords = useMemo(
    () => computeWeaknesses(effectiveAttempts).filter((w) => w.kind === 'word' || !w.id.startsWith('line-')).slice(0, 5),
    [effectiveAttempts]
  )

  if (loading || !progress) {
    return (
      <div className="app loading">
        <div className="loading-spinner">Loading...</div>
      </div>
    )
  }

  const targetDate = new Date('2026-12-12T00:00:00+08:00')

  const goFocus = () => {
    setAutoStartSpeak(true)
    setCurrentScreen('speak')
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>西安90</h1>
        <p className="subtitle">Xi'an Incident 90th Anniversary</p>
      </header>

      <main className="app-main">
        {currentScreen === 'today' && (
          <TodayScreen
            lessons={lessons}
            progress={progress}
            targetDate={targetDate}
            onRefresh={refreshProgress}
            focusItems={focusItems}
            troubleWords={troubleWords}
            onStartFocus={goFocus}
            onOpenArchive={() => setCurrentScreen('archive')}
          />
        )}
        {currentScreen === 'speak' && (
          <SpeakScreen
            speechLines={speechLines}
            focusItems={focusItems}
            onRefresh={refreshProgress}
            autoStart={autoStartSpeak}
            demo={speakDemo}
          />
        )}
        {currentScreen === 'speech' && <SpeechScreen speechLines={speechLines} />}
        {currentScreen === 'quiz' && (
          <QuizScreen
            lessons={lessons}
            glossary={glossary}
            progress={progress}
            onRefresh={refreshProgress}
          />
        )}
        {currentScreen === 'archive' && <ArchiveScreen lessons={lessons} progress={progress} />}
        {currentScreen === 'progress' && (
          <ProgressScreen
            progress={progress}
            speechLines={speechLines}
            attempts={effectiveAttempts}
            todayLessonLines={todayLessonLines}
            onRefresh={refreshProgress}
            onOpenArchive={() => setCurrentScreen('archive')}
          />
        )}
      </main>

      <nav className="app-nav">
        <button className={currentScreen === 'today' ? 'active' : ''} onClick={() => setCurrentScreen('today')}>
          <span className="nav-icon" aria-hidden="true">📅</span>
          Today
        </button>
        <button
          className={currentScreen === 'speak' ? 'active' : ''}
          onClick={() => {
            setAutoStartSpeak(false)
            setCurrentScreen('speak')
          }}
        >
          <span className="nav-icon" aria-hidden="true">🎤</span>
          Speak
        </button>
        <button className={currentScreen === 'speech' ? 'active' : ''} onClick={() => setCurrentScreen('speech')}>
          <span className="nav-icon" aria-hidden="true">📜</span>
          Speech
        </button>
        <button className={currentScreen === 'quiz' ? 'active' : ''} onClick={() => setCurrentScreen('quiz')}>
          <span className="nav-icon" aria-hidden="true">✏️</span>
          Quiz
        </button>
        <button className={currentScreen === 'progress' ? 'active' : ''} onClick={() => setCurrentScreen('progress')}>
          <span className="nav-icon" aria-hidden="true">📊</span>
          Progress
        </button>
      </nav>
    </div>
  )
}

export default App
