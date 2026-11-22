import { useState, useEffect } from 'react';
import type { SpeechLine, DailyLesson, VocabWord, UserProgress } from './types';
import { getProgress } from './storage';
import TodayScreen from './screens/TodayScreen';
import SpeechScreen from './screens/SpeechScreen';
import RecordScreen from './screens/RecordScreen';
import QuizScreen from './screens/QuizScreen';
import ArchiveScreen from './screens/ArchiveScreen';
import ProgressScreen from './screens/ProgressScreen';
import { assetUrl } from './assetUrl';
import './App.css';

type Screen = 'today' | 'speech' | 'record' | 'quiz' | 'archive' | 'progress';

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('today');
  const [speechLines, setSpeechLines] = useState<SpeechLine[]>([]);
  const [lessons, setLessons] = useState<DailyLesson[]>([]);
  const [glossary, setGlossary] = useState<VocabWord[]>([]);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [speechRes, glossaryRes, lessonsIndexRes, progressData] = await Promise.all([
        fetch(assetUrl('data/speech.json')),
        fetch(assetUrl('data/glossary.json')),
        fetch(assetUrl('data/lessons/index.json')),
        getProgress()
      ]);

      const speechData = await speechRes.json();
      const glossaryData = await glossaryRes.json();
      const lessonsIndex = await lessonsIndexRes.json();

      setSpeechLines(speechData);
      setGlossary(glossaryData);
      setProgress(progressData);

      const lessonPromises = lessonsIndex.lessons.map((l: any) =>
        fetch(assetUrl(`data/lessons/${l.file}`)).then(r => r.json())
      );
      const lessonsData = await Promise.all(lessonPromises);
      setLessons(lessonsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function refreshProgress() {
    const progressData = await getProgress();
    setProgress(progressData);
  }

  if (loading || !progress) {
    return (
      <div className="app loading">
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  const targetDate = new Date('2026-12-12T00:00:00+08:00');

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
          />
        )}
        {currentScreen === 'speech' && (
          <SpeechScreen
            speechLines={speechLines}
          />
        )}
        {currentScreen === 'record' && (
          <RecordScreen
            speechLines={speechLines}
            progress={progress}
            onRefresh={refreshProgress}
          />
        )}
        {currentScreen === 'quiz' && (
          <QuizScreen
            lessons={lessons}
            glossary={glossary}
            progress={progress}
            onRefresh={refreshProgress}
          />
        )}
        {currentScreen === 'archive' && (
          <ArchiveScreen
            lessons={lessons}
            progress={progress}
          />
        )}
        {currentScreen === 'progress' && (
          <ProgressScreen
            progress={progress}
            speechLines={speechLines}
            onRefresh={refreshProgress}
          />
        )}
      </main>

      <nav className="app-nav">
        <button
          className={currentScreen === 'today' ? 'active' : ''}
          onClick={() => setCurrentScreen('today')}
        >
          📅 Today
        </button>
        <button
          className={currentScreen === 'speech' ? 'active' : ''}
          onClick={() => setCurrentScreen('speech')}
        >
          📜 Speech
        </button>
        <button
          className={currentScreen === 'record' ? 'active' : ''}
          onClick={() => setCurrentScreen('record')}
        >
          🎤 Record
        </button>
        <button
          className={currentScreen === 'quiz' ? 'active' : ''}
          onClick={() => setCurrentScreen('quiz')}
        >
          ✏️ Quiz
        </button>
        <button
          className={currentScreen === 'archive' ? 'active' : ''}
          onClick={() => setCurrentScreen('archive')}
        >
          📚 Archive
        </button>
        <button
          className={currentScreen === 'progress' ? 'active' : ''}
          onClick={() => setCurrentScreen('progress')}
        >
          📊 Progress
        </button>
      </nav>
    </div>
  );
}

export default App;
